export const dynamic = "force-dynamic";

type AuthUserResponse = {
  id: string;
};

type ProfileRoleResponse = {
  data?: {
    profiles_by_pk: {
      role: "admin" | "manager" | "customer" | null;
    } | null;
  };
  errors?: Array<{ message: string }>;
};

function resolveGraphqlUrl() {
  const explicit = process.env.NEXT_PUBLIC_NHOST_GRAPHQL_URL;
  if (explicit) return explicit;
  const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
  const region = process.env.NEXT_PUBLIC_NHOST_REGION;
  if (!subdomain || !region) throw new Error("Missing Nhost GraphQL configuration.");
  return `https://${subdomain}.graphql.${region}.nhost.run/v1`;
}

function resolveAuthUrl() {
  const explicit = process.env.NEXT_PUBLIC_NHOST_AUTH_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
  const region = process.env.NEXT_PUBLIC_NHOST_REGION;
  if (!subdomain || !region) throw new Error("Missing Nhost Auth configuration.");
  return `https://${subdomain}.auth.${region}.nhost.run/v1`;
}

function resolveStorageUrl() {
  const explicit = process.env.NEXT_PUBLIC_NHOST_STORAGE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
  const region = process.env.NEXT_PUBLIC_NHOST_REGION;
  if (!subdomain || !region) throw new Error("Missing Nhost Storage configuration.");
  return `https://${subdomain}.storage.${region}.nhost.run/v1`;
}

async function requireStaffAccess(request: Request, adminSecret: string) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return Response.json({ error: "Missing bearer token." }, { status: 401 });
  }

  const authResponse = await fetch(`${resolveAuthUrl()}/user`, {
    headers: { Authorization: authorization },
  });
  if (!authResponse.ok) {
    return Response.json({ error: "Authentication failed." }, { status: 401 });
  }

  const user = (await authResponse.json()) as AuthUserResponse;
  if (!user.id) {
    return Response.json({ error: "User id not returned." }, { status: 401 });
  }

  const roleResponse = await fetch(resolveGraphqlUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hasura-admin-secret": adminSecret,
    },
    body: JSON.stringify({
      query: `query CurrentProfileRole($id: uuid!) { profiles_by_pk(id: $id) { role } }`,
      variables: { id: user.id },
    }),
  });

  const roleBody = (await roleResponse.json()) as ProfileRoleResponse;
  const role = roleBody.data?.profiles_by_pk?.role ?? null;
  if (role !== "admin" && role !== "manager") {
    return Response.json({ error: "Admin access is required." }, { status: 403 });
  }

  return null;
}

export async function POST(request: Request) {
  const adminSecret = process.env.HASURA_ADMIN_SECRET;
  if (!adminSecret) {
    return Response.json({ error: "HASURA_ADMIN_SECRET is not configured." }, { status: 500 });
  }

  const authError = await requireStaffAccess(request, adminSecret);
  if (authError) return authError;

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof Blob)) {
    return Response.json({ error: "No file provided." }, { status: 400 });
  }

  const storageUrl = resolveStorageUrl();

  // First, ensure the "public" bucket exists (Nhost creates it if we reference it)
  // Upload to the "public" bucket so files are accessible without auth
  const uploadForm = new FormData();
  uploadForm.append("file[]", file);
  uploadForm.append("bucket-id", "public");

  let uploadResponse = await fetch(`${storageUrl}/files`, {
    method: "POST",
    headers: {
      "x-hasura-admin-secret": adminSecret,
    },
    body: uploadForm,
  });

  // If "public" bucket doesn't exist, fall back to default bucket
  if (!uploadResponse.ok) {
    const fallbackForm = new FormData();
    fallbackForm.append("file[]", file);

    uploadResponse = await fetch(`${storageUrl}/files`, {
      method: "POST",
      headers: {
        "x-hasura-admin-secret": adminSecret,
      },
      body: fallbackForm,
    });
  }

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    console.error("Storage upload failed:", uploadResponse.status, errorText);
    return Response.json(
      { error: "Image upload failed. Please try again." },
      { status: uploadResponse.status },
    );
  }

  const uploadBody = await uploadResponse.json();
  const fileId = uploadBody.processedFiles?.[0]?.id;

  if (!fileId) {
    return Response.json({ error: "Upload did not return a file id." }, { status: 502 });
  }

  // Make file publicly readable via Hasura metadata update
  const graphqlUrl = resolveGraphqlUrl();
  try {
    await fetch(graphqlUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hasura-admin-secret": adminSecret,
      },
      body: JSON.stringify({
        query: `
          mutation MakeFilePublic($id: uuid!) {
            updateFile(pk_columns: { id: $id }, _set: { isUploaded: true }) {
              id
            }
          }
        `,
        variables: { id: fileId },
      }),
    });
  } catch {
    // Non-critical
  }

  return Response.json({
    fileId,
    url: `${storageUrl}/files/${fileId}`,
  });
}

export async function DELETE(request: Request) {
  const adminSecret = process.env.HASURA_ADMIN_SECRET;
  if (!adminSecret) {
    return Response.json({ error: "HASURA_ADMIN_SECRET is not configured." }, { status: 500 });
  }

  const authError = await requireStaffAccess(request, adminSecret);
  if (authError) return authError;

  let body: { fileId?: string };
  try {
    body = (await request.json()) as { fileId?: string };
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const fileId = body.fileId;
  if (!fileId) {
    return Response.json({ error: "fileId is required." }, { status: 400 });
  }

  const storageUrl = resolveStorageUrl();

  // Try to delete from Nhost Storage — non-critical if it fails
  try {
    await fetch(`${storageUrl}/files/${fileId}`, {
      method: "DELETE",
      headers: {
        "x-hasura-admin-secret": adminSecret,
      },
    });
  } catch {
    // Storage deletion failed — file may be orphaned but product will be updated
  }

  // Also try to delete the file record via Hasura GraphQL
  const graphqlUrl = resolveGraphqlUrl();
  try {
    await fetch(graphqlUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hasura-admin-secret": adminSecret,
      },
      body: JSON.stringify({
        query: `mutation DeleteFile($id: uuid!) { deleteFile(id: $id) { id } }`,
        variables: { id: fileId },
      }),
    });
  } catch {
    // Non-critical
  }

  return Response.json({ success: true });
}
