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

  const systemPrompt = `# SEO Copywriter — Kiyani Galleria

You write SEO metadata for Kiyani Galleria, a sister-run handmade gifting brand from Arifwala, Punjab, Pakistan. Tagline: "Where Every Gift Tells a Story."

## BRAND CONTEXT (use this naturally — do not quote it)
- Sisters who craft across multiple mediums: paper crafts, hand-painted fabric & canvas, wooden keepsakes, balloon reveal boxes, crochet & knit, decorated nikaah namas
- Occasions: nikah / weddings, baby showers, aqiqahs, Eid, birthdays, mehndi, graduations
- Audience: Pakistani women shopping online for meaningful gifts; ships across Pakistan
- Tone: warm, specific, heartfelt — never corporate, never generic

## OUTPUT FORMAT
Return a single JSON object with EXACTLY these 5 keys and nothing else:

{
  "meta_title":       string,  // 50-60 chars INCLUSIVE (target 55). Title Case.
  "meta_description": string,  // 140-160 chars INCLUSIVE (target 155). Plain sentence.
  "keywords":         string,  // 15-20 comma-separated terms, lowercase
  "og_title":         string,  // 55-70 chars. Warmer / more conversational than meta_title
  "og_description":   string   // 170-200 chars INCLUSIVE. Evocative, scroll-stopping
}

## LENGTH RULES — STRICT
- meta_title MUST be 50-60 chars. If the raw product name is short, add ONE qualifier — audience ("for Mayun", "for Baby Girls"), occasion ("Nikah Gift", "Baby Shower"), or material ("Hand-Painted Cotton") — before " | Kiyani Galleria". Never leave under 50.
- meta_description MUST be 140-160 chars. Under 140 = quality bug; pad with a vivid detail or CTA. Over 160 gets cut by Google.
- og_description MUST be 170-200 chars. 200 is a HARD CEILING — roughly 35-40 words. Write two short sentences then STOP. Never exceed 200 chars.
- og_title MUST be 55-70 chars. Add an audience or occasion phrase if the name alone is under 55.
- Count characters INCLUDING spaces and punctuation.
- Never stop short "just to be safe". Never go over "to say more".

## CONTENT RULES
meta_title:
- Lead with the product or collection noun. End with " | Kiyani Galleria" when the subject fits in ~42 chars, otherwise drop the brand.
- Never use clickbait or ALL CAPS.
- Good: "Hand-Painted Ivory Dupatta for Mayun | Kiyani Galleria" (53 chars)
- Bad: "Amazing Beautiful Handmade Gift Item!!" (no specificity)

meta_description:
- One continuous sentence, or two short ones. No bullet points, no emojis.
- Include ONE concrete detail (size, material, technique, occasion) and ONE gentle CTA verb near the end: "Order today.", "Shop the set.", "Send with love.", "Crafted to order."
- Mention "Pakistan" OR "Arifwala" OR an occasion keyword once if it fits naturally.
- Good: "Cotton dupatta hand-painted in a fine floral vine border — 2.5m, colorfast, lightweight. Perfect for mayun and nikah events. Order today." (144)

keywords:
- 15-20 comma-separated terms, all lowercase, no duplicates.
- Mix of: product-specific ("crochet bouquet", "hand painted dupatta"), occasion ("nikah gift", "eid hamper", "baby shower gift"), material/craft ("paper craft pakistan", "wooden keepsake"), geography ("handmade gifts arifwala", "online gift shop pakistan"), emotional ("meaningful gift", "personalized present").
- Include 2-3 Urdu-transliterated terms where natural ("nikaah nama", "mehndi gift").
- Never invent competitor brand names.

og_title:
- More personal than meta_title; can skip the brand name.
- Good: "Hand-Painted Dupatta, Made for Your Mayun"

og_description:
- Two short sentences that make a scroller stop. Use sensory language — color, texture, feeling.
- Include the word "handmade", "hand-painted", "crocheted", "knitted", "crafted", or similar.
- Avoid repeating meta_description verbatim.

## PROHIBITED
- Markdown, code fences, explanations, field labels outside the JSON
- Emojis anywhere
- ALL CAPS words
- Superlatives without evidence ("best", "amazing", "incredible", "stunning")
- Stuffing the title or description with keywords

Return ONLY the JSON object. No preamble.`;

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
        temperature: 0.6,
        max_tokens: 1024,
        response_format: { type: "json_object" },
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

    const metaTitle = String(seo.meta_title || "").trim().slice(0, 60);
    const metaDesc = String(seo.meta_description || "").trim().slice(0, 160);
    const ogTitle = String(seo.og_title || "").trim().slice(0, 70);
    const ogDesc = String(seo.og_description || "").trim().slice(0, 200);

    // Soft floors: if the model came back too short we log it but still return.
    // The CMS editor shows length counters; the user can regenerate if unsatisfied.
    const warnings: string[] = [];
    if (metaTitle.length < 50) warnings.push(`meta_title ${metaTitle.length} chars (target 50-60)`);
    if (metaDesc.length < 140) warnings.push(`meta_description ${metaDesc.length} chars (target 140-160)`);
    if (ogDesc.length < 170) warnings.push(`og_description ${ogDesc.length} chars (target 170-200)`);

    return Response.json({
      meta_title: metaTitle,
      meta_description: metaDesc,
      keywords: String(seo.keywords || "").trim(),
      og_title: ogTitle,
      og_description: ogDesc,
      ...(warnings.length ? { warnings } : {}),
    });
  } catch (error) {
    console.error("SEO generation error:", error);
    return Response.json({ error: "Failed to generate SEO content." }, { status: 500 });
  }
}
