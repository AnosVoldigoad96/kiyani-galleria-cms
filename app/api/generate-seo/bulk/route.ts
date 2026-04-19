export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { requireStaffAccess, resolveGraphqlUrl } from "@/lib/staff-auth";

type BulkInput = {
  kinds?: Array<"product" | "category" | "subcategory">;
  onlyMissing?: boolean;
  limit?: number;
};

type Entity = {
  kind: "product" | "category" | "subcategory";
  id: string;
  name: string;
  description: string | null;
  category?: string | null;
  subcategory?: string | null;
  price?: number | null;
  features?: string[];
  meta_title?: string | null;
  meta_description?: string | null;
};

type SeoFields = {
  meta_title: string;
  meta_description: string;
  keywords: string;
  og_title: string;
  og_description: string;
};

const SYSTEM_PROMPT = `You are an SEO specialist for Kiyani Galleria — a sister-run handmade gifting brand from Arifwala, Punjab, Pakistan. Tagline: "Where Every Gift Tells a Story."

Return a JSON object with exactly these keys: "meta_title" (<=60 chars), "meta_description" (<=160 chars), "keywords" (15-25 comma-separated), "og_title" (<=70 chars), "og_description" (<=200 chars). JSON only, no markdown.`;

function stripFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function buildPrompt(e: Entity): string {
  const parts: string[] = [`Type: ${e.kind}`, `Name: ${e.name}`];
  if (e.description) parts.push(`Description: ${e.description}`);
  if (e.category) parts.push(`Category: ${e.category}`);
  if (e.subcategory) parts.push(`Subcategory: ${e.subcategory}`);
  if (e.price) parts.push(`Price: PKR ${e.price}`);
  if (e.features?.length) parts.push(`Features: ${e.features.join(", ")}`);
  return parts.join("\n");
}

async function generateOne(groqKey: string, entity: Entity): Promise<SeoFields> {
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
        { role: "user", content: buildPrompt(entity) },
      ],
      temperature: 0.7,
      max_tokens: 1024,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Groq ${res.status}: ${txt.slice(0, 200)}`);
  }
  const body = await res.json();
  const content = body?.choices?.[0]?.message?.content;
  if (!content) throw new Error("empty response");
  const raw = JSON.parse(stripFences(content)) as SeoFields;
  return {
    meta_title: String(raw.meta_title || "").slice(0, 60),
    meta_description: String(raw.meta_description || "").slice(0, 160),
    keywords: String(raw.keywords || ""),
    og_title: String(raw.og_title || "").slice(0, 70),
    og_description: String(raw.og_description || "").slice(0, 200),
  };
}

async function adminGraphql<T>(sql: string, variables?: Record<string, unknown>): Promise<T> {
  const url = resolveGraphqlUrl();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hasura-admin-secret": process.env.HASURA_ADMIN_SECRET ?? "",
    },
    body: JSON.stringify({ query: sql, variables }),
  });
  const payload = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (payload.errors?.length) throw new Error(payload.errors.map((e) => e.message).join(", "));
  if (!payload.data) throw new Error("no data");
  return payload.data;
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

  let input: BulkInput = {};
  try {
    input = (await request.json()) as BulkInput;
  } catch {
    // empty body is fine — defaults apply
  }

  const kinds = input.kinds?.length
    ? input.kinds
    : (["product", "category", "subcategory"] as const);
  const onlyMissing = input.onlyMissing ?? true;
  const limit = Math.max(1, Math.min(200, input.limit ?? 50));

  // Collect entities
  const missingFilter = onlyMissing
    ? `{ _or: [{ meta_title: { _is_null: true } }, { meta_title: { _eq: "" } }, { meta_description: { _is_null: true } }, { meta_description: { _eq: "" } }] }`
    : `{}`;

  const pieces: string[] = [];
  if (kinds.includes("product")) {
    pieces.push(`products(where: ${missingFilter}, limit: ${limit}) {
      id name description category { name } subcategory { name } price_pkr
      meta_title meta_description
      product_features(order_by: { sort_order: asc }) { feature }
    }`);
  }
  if (kinds.includes("category")) {
    pieces.push(`categories(where: ${missingFilter}, limit: ${limit}) {
      id name description
      meta_title meta_description
    }`);
  }
  if (kinds.includes("subcategory")) {
    pieces.push(`subcategories(where: ${missingFilter}, limit: ${limit}) {
      id name description category { name }
      meta_title meta_description
    }`);
  }
  const query = `query BulkSeoCandidates { ${pieces.join("\n")} }`;

  let data: Record<string, Array<Record<string, unknown>>>;
  try {
    data = await adminGraphql<Record<string, Array<Record<string, unknown>>>>(query);
  } catch (err) {
    return Response.json({ error: `GraphQL read failed: ${String(err)}` }, { status: 500 });
  }

  const entities: Entity[] = [];
  for (const p of data.products ?? []) {
    entities.push({
      kind: "product",
      id: String(p.id),
      name: String(p.name),
      description: (p.description as string | null) ?? null,
      category: (p.category as { name?: string } | null)?.name ?? null,
      subcategory: (p.subcategory as { name?: string } | null)?.name ?? null,
      price: typeof p.price_pkr === "number" ? p.price_pkr : null,
      features: ((p.product_features as Array<{ feature: string }>) ?? []).map(
        (f) => f.feature,
      ),
      meta_title: (p.meta_title as string | null) ?? null,
      meta_description: (p.meta_description as string | null) ?? null,
    });
  }
  for (const c of data.categories ?? []) {
    entities.push({
      kind: "category",
      id: String(c.id),
      name: String(c.name),
      description: (c.description as string | null) ?? null,
    });
  }
  for (const s of data.subcategories ?? []) {
    entities.push({
      kind: "subcategory",
      id: String(s.id),
      name: String(s.name),
      description: (s.description as string | null) ?? null,
      category: (s.category as { name?: string } | null)?.name ?? null,
    });
  }

  if (entities.length === 0) {
    return Response.json({ processed: 0, updated: 0, errors: [] });
  }

  // Generate + update one at a time to respect Groq rate limits (serial is safest).
  const results: Array<{ kind: string; id: string; ok: boolean; error?: string }> = [];
  let updated = 0;

  for (const e of entities) {
    try {
      const seo = await generateOne(groqKey, e);
      const table = e.kind === "product" ? "products" : e.kind === "category" ? "categories" : "subcategories";
      const mutation = `
        mutation UpdateBulkSeo($id: uuid!, $set: ${table}_set_input!) {
          update_${table}_by_pk(pk_columns: { id: $id }, _set: $set) { id }
        }
      `;
      await adminGraphql(mutation, { id: e.id, set: seo });
      updated++;
      results.push({ kind: e.kind, id: e.id, ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ kind: e.kind, id: e.id, ok: false, error: message });
    }
    // small spacing for rate limiting
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return Response.json({
    processed: entities.length,
    updated,
    errors: results.filter((r) => !r.ok),
  });
}
