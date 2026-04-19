export const dynamic = "force-dynamic";

import { requireStaffAccess } from "@/lib/staff-auth";

type AltRequest = {
  name: string;
  description?: string;
  category?: string;
  subcategory?: string;
};

type AltResponse = {
  alt_text: string;
};

const SYSTEM_PROMPT = `You generate concise, descriptive alt text for product photography at Kiyani Galleria — a handmade gifting brand from Arifwala, Pakistan making paper crafts, hand-painted textiles, wooden keepsakes, balloon gifts, crochet, and decorated nikaah namas.

RULES:
- Max 125 characters
- Describe the product objectively — material, color, visible detail, context
- Skip "image of", "photo of", brand/site name, marketing language
- Natural English, no keyword stuffing
- End with a period
- Return JSON: { "alt_text": "..." }`;

function stripFences(text: string): string {
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

  let input: AltRequest;
  try {
    input = (await request.json()) as AltRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!input.name?.trim()) {
    return Response.json({ error: "Name is required." }, { status: 400 });
  }

  const userPrompt = [
    `Product: ${input.name}`,
    input.category ? `Category: ${input.category}` : "",
    input.subcategory ? `Subcategory: ${input.subcategory}` : "",
    input.description ? `Description: ${input.description}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 256,
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) {
      return Response.json(
        { error: "AI rate limit reached. Please wait a moment and try again." },
        { status: 429 },
      );
    }
    if (!res.ok) {
      const errorText = await res.text();
      console.error("Groq API error:", res.status, errorText);
      return Response.json({ error: "AI service unavailable." }, { status: 502 });
    }

    const body = await res.json();
    const content = body?.choices?.[0]?.message?.content;
    if (!content) return Response.json({ error: "AI returned empty response." }, { status: 502 });

    let parsed: AltResponse;
    try {
      parsed = JSON.parse(stripFences(content));
    } catch {
      return Response.json({ error: "AI returned invalid format." }, { status: 502 });
    }

    return Response.json({ alt_text: String(parsed.alt_text || "").slice(0, 125) });
  } catch (error) {
    console.error("Alt-text generation error:", error);
    return Response.json({ error: "Failed to generate alt text." }, { status: 500 });
  }
}
