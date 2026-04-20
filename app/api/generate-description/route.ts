export const dynamic = "force-dynamic";

type DescriptionRequest = {
  type: "product";
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

  const systemPrompt = `# Product Description Writer — Kiyani Galleria

You write SHORT product descriptions for Kiyani Galleria, a sister-run handmade gifting brand from Arifwala, Punjab, Pakistan.

The brand makes paper crafts, hand-painted fabric, wooden keepsakes, balloon reveal boxes, crochet & knit, and decorated nikaah namas — for weddings / nikah, baby showers, Eid, birthdays, and mehndi.

## LENGTH — STRICT
- EXACTLY 2 sentences.
- 200-360 characters TOTAL (target 280). Never longer.
- Count spaces. If your first draft is longer, shorten it before replying.

## STRUCTURE (both sentences, in order)
1. First sentence — WHAT it is: material / technique + one defining detail (size, finish, colour, or motif).
2. Second sentence — WHO / WHEN: the occasion or feeling it fits, in warm language.

## VOICE
Warm, specific, confident. Like a sister quietly describing what she made. Avoid superlatives, emojis, and marketing clichés ("exquisite", "stunning", "amazing", "perfect for everyone", "one of a kind").

## EXAMPLES
Good (258 chars):
"Hand-crocheted blush bouquet of seven cotton-yarn roses, wrapped in a kraft sleeve and finished with a twine bow. A softer alternative to fresh flowers for an engagement, mayun, or a birthday that deserves something kept."

Good (221 chars):
"Walnut-finish plaque, laser-cut to your chosen name and hand-painted with a fine script detail. Ships ready-to-mount — a quiet gift for a new home, an anniversary, or the couple who collect the dates that mattered."

Bad — too long / too marketing:
"Our absolutely stunning hand-painted dupatta is an incredible heirloom piece that you will cherish forever because every single detail has been obsessed over by our talented artisans..."

Return ONLY the description text. No quotes, no JSON, no labels, no preamble.`;

  const userPrompt = `Write a product description for "${input.name}"${
    input.category ? ` in the "${input.category}" category` : ""
  }.`;

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
        temperature: 0.6,
        max_tokens: 180, // ~360 chars worth — hard ceiling so it can't go long
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

    // Server-side ceiling: 360 chars matches the prompt's upper bound. If the
    // model slipped past it, trim to the last sentence boundary under 360.
    let description = content.replace(/^["']+|["']+$/g, "").trim();
    if (description.length > 360) {
      const slice = description.slice(0, 360);
      const lastStop = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("? "), slice.lastIndexOf("! "));
      description = (lastStop > 200 ? slice.slice(0, lastStop + 1) : slice).trim();
    }

    return Response.json({ description });
  } catch (error) {
    console.error("Description generation error:", error);
    return Response.json({ error: "Failed to generate description." }, { status: 500 });
  }
}
