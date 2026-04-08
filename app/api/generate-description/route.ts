export const dynamic = "force-dynamic";

type DescriptionRequest = {
  type: "product" | "category" | "subcategory";
  name: string;
  category?: string;
};

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

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey || groqKey === "your-groq-api-key-here") {
    return Response.json({ error: "GROQ_API_KEY is not configured." }, { status: 500 });
  }

  const authError = await requireStaffAccess(request, adminSecret);
  if (authError) return authError;

  let input: DescriptionRequest;
  try {
    input = (await request.json()) as DescriptionRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!input.name?.trim()) {
    return Response.json({ error: "Name is required." }, { status: 400 });
  }

  const systemPrompt = `You write short product/category descriptions for Kiyani Galleria — a sister-run handmade gifting brand from Arifwala, Punjab, Pakistan.

The brand works across multiple crafts: paper crafts, painting on canvas & cloth, wooden crafts, balloon-packed gifts, yarn knitted & crochet creations, and decorated nikaah namas.

Write a warm, personal, 2-3 sentence description. Focus on what makes this item special, who it's for, and the feeling it creates. Avoid generic marketing language. Write as if a sister is describing what she made and why.

Return ONLY the description text. No quotes, no JSON, no labels.`;

  const userPrompt =
    input.type === "product"
      ? `Write a product description for "${input.name}"${input.category ? ` in the "${input.category}" category` : ""}.`
      : input.type === "subcategory"
        ? `Write a subcategory description for "${input.name}"${input.category ? ` under "${input.category}"` : ""}.`
        : `Write a category description for "${input.name}".`;

  try {
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 256,
      }),
    });

    if (groqResponse.status === 429) {
      return Response.json({ error: "Rate limit reached. Wait a moment and try again." }, { status: 429 });
    }

    if (!groqResponse.ok) {
      return Response.json({ error: "AI service unavailable." }, { status: 502 });
    }

    const body = await groqResponse.json();
    const content = body.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return Response.json({ error: "AI returned empty response." }, { status: 502 });
    }

    return Response.json({ description: content });
  } catch (error) {
    console.error("Description generation error:", error);
    return Response.json({ error: "Failed to generate description." }, { status: 500 });
  }
}
