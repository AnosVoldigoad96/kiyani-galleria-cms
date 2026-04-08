export const dynamic = "force-dynamic";

type SeoRequest = {
  type: "product" | "category" | "subcategory";
  name: string;
  description?: string;
  category?: string;
  subcategory?: string;
  price?: number;
  features?: string[];
};

type SeoResponse = {
  meta_title: string;
  meta_description: string;
  keywords: string;
  og_title: string;
  og_description: string;
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
    return Response.json({ error: "Authenticated user id was not returned." }, { status: 401 });
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

function buildPrompt(input: SeoRequest): string {
  const parts: string[] = [`Type: ${input.type}`, `Name: ${input.name}`];
  if (input.description) parts.push(`Description: ${input.description}`);
  if (input.category) parts.push(`Category: ${input.category}`);
  if (input.subcategory) parts.push(`Subcategory: ${input.subcategory}`);
  if (input.price) parts.push(`Price: PKR ${input.price}`);
  if (input.features?.length) parts.push(`Features: ${input.features.join(", ")}`);

  return parts.join("\n");
}

function stripMarkdownFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
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

  let input: SeoRequest;
  try {
    input = (await request.json()) as SeoRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!input.name?.trim()) {
    return Response.json({ error: "Name is required to generate SEO." }, { status: 400 });
  }

  const systemPrompt = `You are an SEO specialist for Kiyani Galleria — a sister-run handmade gifting brand from Arifwala, Punjab, Pakistan. Tagline: "Where Every Gift Tells a Story."

BRAND CONTEXT:
- Founded by a circle of sisters who craft gifts across MULTIPLE mediums — not just one
- Crafts: paper crafts (shadow boxes, 3D arrangements, decorative cards), painting on canvas & cloth (hand-painted dupattas, cushion covers), wooden crafts (name plaques, keepsake boxes, milestone boards), balloon-packed gifts (styled reveal packages), yarn knitted & crochet creations (baby blankets, soft toys, knitted sets), decorated nikaah namas
- Occasions: weddings/nikah, baby showers, Eid, birthdays, sisters day, mehndi, custom events
- Tone: warm, personal, heartfelt — NOT corporate or generic. Every piece is made with someone specific in mind
- Audience: Pakistani women (and families) shopping online for meaningful handmade gifts
- Location: Arifwala, Punjab — shipping across Pakistan
- Key differentiator: multi-craft fluency. The sisters choose the RIGHT medium for each occasion — paper, paint, wood, yarn, balloon, or a combination

SEO RULES:
Return a JSON object with exactly these keys:
- "meta_title": Max 60 chars. Include "Kiyani Galleria" when space allows. Focus on what the product IS and who it's FOR.
- "meta_description": Max 160 chars. Warm, specific, includes a call-to-action like "Shop now", "Order today", "Send love". Avoid generic filler.
- "keywords": 15-25 comma-separated terms. Mix: product-specific (e.g. "hand-painted dupatta", "wooden name plaque", "crochet bouquet", "balloon gift box"), occasion (e.g. "nikah gift", "Eid hamper"), craft/material (e.g. "paper craft Pakistan", "handmade wooden gift"), location (e.g. "online gift shop Pakistan", "handmade gifts Arifwala"), emotional (e.g. "meaningful gift", "personalized present"). Include Urdu-transliterated terms where natural (e.g. "mehndi gifts", "nikah nama decoration").
- "og_title": Max 70 chars. Engaging for social sharing — can be warmer/more conversational than meta_title.
- "og_description": Max 200 chars. Written to make someone stop scrolling. Personal, vivid, shareable.

Return ONLY valid JSON. No markdown, no explanation, no wrapping.`;

  const userPrompt = buildPrompt(input);

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
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (groqResponse.status === 429) {
      return Response.json(
        { error: "AI rate limit reached. Please wait a moment and try again." },
        { status: 429 },
      );
    }

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error("Groq API error:", groqResponse.status, errorText);
      return Response.json(
        { error: "AI service unavailable. Please try again later." },
        { status: 502 },
      );
    }

    const groqBody = await groqResponse.json();
    const content = groqBody.choices?.[0]?.message?.content;

    if (!content) {
      return Response.json({ error: "AI returned empty response." }, { status: 502 });
    }

    const cleaned = stripMarkdownFences(content);
    let seo: SeoResponse;
    try {
      seo = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", cleaned);
      return Response.json({ error: "AI returned invalid format. Please try again." }, { status: 502 });
    }

    return Response.json({
      meta_title: String(seo.meta_title || "").slice(0, 60),
      meta_description: String(seo.meta_description || "").slice(0, 160),
      keywords: String(seo.keywords || ""),
      og_title: String(seo.og_title || "").slice(0, 70),
      og_description: String(seo.og_description || "").slice(0, 200),
    });
  } catch (error) {
    console.error("SEO generation error:", error);
    return Response.json({ error: "Failed to generate SEO content." }, { status: 500 });
  }
}
