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
  if (explicit) {
    return explicit;
  }

  const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
  const region = process.env.NEXT_PUBLIC_NHOST_REGION;
  if (!subdomain || !region) {
    throw new Error("Missing Nhost GraphQL configuration.");
  }

  return `https://${subdomain}.graphql.${region}.nhost.run/v1`;
}

function resolveAuthUrl() {
  const explicit = process.env.NEXT_PUBLIC_NHOST_AUTH_URL;
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
  const region = process.env.NEXT_PUBLIC_NHOST_REGION;
  if (!subdomain || !region) {
    throw new Error("Missing Nhost Auth configuration.");
  }

  return `https://${subdomain}.auth.${region}.nhost.run/v1`;
}

export async function GET(request: Request) {
  const adminSecret = process.env.HASURA_ADMIN_SECRET;

  if (!adminSecret) {
    return Response.json(
      { errors: [{ message: "HASURA_ADMIN_SECRET is not configured." }] },
      { status: 500 },
    );
  }

  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return Response.json(
      { errors: [{ message: "Missing bearer token." }] },
      { status: 401 },
    );
  }

  const authResponse = await fetch(`${resolveAuthUrl()}/user`, {
    headers: {
      Authorization: authorization,
    },
  });

  if (!authResponse.ok) {
    return Response.json(
      { errors: [{ message: "Authentication failed." }] },
      { status: 401 },
    );
  }

  const user = (await authResponse.json()) as AuthUserResponse;

  if (!user.id) {
    return Response.json(
      { errors: [{ message: "Authenticated user id was not returned." }] },
      { status: 401 },
    );
  }

  const roleResponse = await fetch(resolveGraphqlUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hasura-admin-secret": adminSecret,
    },
    body: JSON.stringify({
      query: `
        query CurrentProfileRole($id: uuid!) {
          profiles_by_pk(id: $id) {
            role
          }
        }
      `,
      variables: {
        id: user.id,
      },
    }),
  });

  const roleBody = (await roleResponse.json()) as ProfileRoleResponse;

  if (roleBody.errors?.length) {
    return Response.json({ errors: roleBody.errors }, { status: 500 });
  }

  return Response.json(
    {
      userId: user.id,
      role: roleBody.data?.profiles_by_pk?.role ?? null,
    },
    { status: 200 },
  );
}
