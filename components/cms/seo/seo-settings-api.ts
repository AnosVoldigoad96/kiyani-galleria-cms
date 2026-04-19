"use client";

import { requestAdminGraphql } from "@/lib/admin-graphql-client";
import { upsertBrandSetting } from "@/components/cms/brand/brand-api";

export type SeoSettingKey =
  | "seo_global"
  | "seo_social"
  | "seo_robots"
  | "seo_verification"
  | "seo_sitemap"
  | "seo_organization";

export const SEO_SETTING_KEYS: SeoSettingKey[] = [
  "seo_global",
  "seo_social",
  "seo_robots",
  "seo_verification",
  "seo_sitemap",
  "seo_organization",
];

type BrandSettingRow = {
  key: SeoSettingKey;
  value: Record<string, unknown>;
};

type FetchResponse = {
  body: {
    data?: { brand_settings: BrandSettingRow[] };
    errors?: Array<{ message: string }>;
  };
};

export async function fetchAllSeoSettings(): Promise<
  Record<SeoSettingKey, Record<string, unknown>>
> {
  const response = (await requestAdminGraphql<{
    brand_settings: BrandSettingRow[];
  }>(
    `
      query SeoSettingsAll($keys: [String!]!) {
        brand_settings(where: { key: { _in: $keys } }) {
          key
          value
        }
      }
    `,
    { keys: SEO_SETTING_KEYS },
  )) as FetchResponse;

  if (response.body.errors?.length) {
    throw new Error(response.body.errors.map((e) => e.message).join(", "));
  }

  const map = {} as Record<SeoSettingKey, Record<string, unknown>>;
  for (const key of SEO_SETTING_KEYS) map[key] = {};
  for (const row of response.body.data?.brand_settings ?? []) {
    map[row.key] = row.value ?? {};
  }
  return map;
}

export async function saveSeoSetting(
  key: SeoSettingKey,
  value: Record<string, unknown>,
) {
  await upsertBrandSetting({ key, value });
}

// ───────────────────────────────────────────────────────────── SEO audit ──

export type AuditEntity = {
  kind: "product" | "category" | "subcategory";
  id: string;
  name: string;
  slug: string;
  metaTitle: string | null;
  metaDescription: string | null;
  keywords: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  robotsNoindex: boolean;
};

export type AuditIssue =
  | "missing_meta_title"
  | "missing_meta_description"
  | "meta_title_too_long"
  | "meta_description_too_long"
  | "missing_keywords"
  | "missing_og";

export const ISSUE_LABEL: Record<AuditIssue, string> = {
  missing_meta_title: "No meta title",
  missing_meta_description: "No meta description",
  meta_title_too_long: "Meta title > 60 chars",
  meta_description_too_long: "Meta description > 160 chars",
  missing_keywords: "No keywords",
  missing_og: "No OG title/description",
};

export function auditEntity(entity: AuditEntity): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const mt = (entity.metaTitle ?? "").trim();
  const md = (entity.metaDescription ?? "").trim();
  const kw = (entity.keywords ?? "").trim();
  const og = (entity.ogTitle ?? "").trim() || (entity.ogDescription ?? "").trim();

  if (!mt) issues.push("missing_meta_title");
  if (!md) issues.push("missing_meta_description");
  if (mt.length > 60) issues.push("meta_title_too_long");
  if (md.length > 160) issues.push("meta_description_too_long");
  if (!kw) issues.push("missing_keywords");
  if (!og) issues.push("missing_og");

  return issues;
}

type AuditResponse = {
  body: {
    data?: {
      products: Array<{
        id: string;
        name: string;
        slug: string;
        meta_title: string | null;
        meta_description: string | null;
        keywords: string | null;
        og_title: string | null;
        og_description: string | null;
        robots_noindex: boolean | null;
      }>;
      categories: Array<{
        id: string;
        name: string;
        slug: string;
        meta_title: string | null;
        meta_description: string | null;
        keywords: string | null;
        og_title: string | null;
        og_description: string | null;
        robots_noindex: boolean | null;
      }>;
      subcategories: Array<{
        id: string;
        name: string;
        slug: string;
        meta_title: string | null;
        meta_description: string | null;
        keywords: string | null;
        og_title: string | null;
        og_description: string | null;
        robots_noindex: boolean | null;
      }>;
    };
    errors?: Array<{ message: string }>;
  };
};

export async function fetchAuditData(): Promise<AuditEntity[]> {
  const response = (await requestAdminGraphql(`
    query SeoAudit {
      products(order_by: { created_at: desc }) {
        id name slug
        meta_title meta_description keywords og_title og_description robots_noindex
      }
      categories(order_by: { sort_order: asc }) {
        id name slug
        meta_title meta_description keywords og_title og_description robots_noindex
      }
      subcategories(order_by: { sort_order: asc }) {
        id name slug
        meta_title meta_description keywords og_title og_description robots_noindex
      }
    }
  `)) as AuditResponse;

  if (response.body.errors?.length) {
    throw new Error(response.body.errors.map((e) => e.message).join(", "));
  }
  const data = response.body.data;
  if (!data) return [];

  const toEntity = (kind: AuditEntity["kind"]) => (r: {
    id: string; name: string; slug: string;
    meta_title: string | null; meta_description: string | null;
    keywords: string | null; og_title: string | null; og_description: string | null;
    robots_noindex: boolean | null;
  }): AuditEntity => ({
    kind,
    id: r.id,
    name: r.name,
    slug: r.slug,
    metaTitle: r.meta_title,
    metaDescription: r.meta_description,
    keywords: r.keywords,
    ogTitle: r.og_title,
    ogDescription: r.og_description,
    robotsNoindex: Boolean(r.robots_noindex),
  });

  return [
    ...data.categories.map(toEntity("category")),
    ...data.subcategories.map(toEntity("subcategory")),
    ...data.products.map(toEntity("product")),
  ];
}

