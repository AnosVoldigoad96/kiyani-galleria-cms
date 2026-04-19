"use client";

import { useState } from "react";
import { ChevronDown, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ChangeFreq =
  | ""
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never";

type SeoFieldsSectionProps = {
  metaTitle: string;
  metaDescription: string;
  keywords: string;
  ogTitle: string;
  ogDescription: string;
  onChange: (field: string, value: string | boolean) => void;
  onGenerate: () => void;
  isGenerating: boolean;

  // Entity context for previews (optional)
  entityName?: string;
  entitySlug?: string;
  entityType?: "product" | "category" | "subcategory";
  entityImageUrl?: string | null;
  siteDomain?: string;

  // v2 fields (optional — callers that haven't adopted them can omit)
  canonicalUrl?: string;
  ogImageUrl?: string;
  robotsNoindex?: boolean;
  sitemapPriority?: number | null;
  sitemapChangefreq?: ChangeFreq;

  // Duplicate-title detection. Pass lowercased meta_titles from sibling entities
  // (excluding this one). If the current metaTitle matches any, render a warning.
  siblingMetaTitles?: string[];

  // Raw JSON text for per-entity structured-data overrides (JSON-LD).
  structuredDataOverrides?: string;
};

const CHANGE_FREQ_OPTIONS: ChangeFreq[] = [
  "",
  "always",
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "never",
];

export function SeoFieldsSection({
  metaTitle,
  metaDescription,
  keywords,
  ogTitle,
  ogDescription,
  onChange,
  onGenerate,
  isGenerating,
  entityName,
  entitySlug,
  entityType = "product",
  entityImageUrl,
  siteDomain = "https://www.kiyanigalleria.com",
  canonicalUrl = "",
  ogImageUrl = "",
  robotsNoindex = false,
  sitemapPriority = null,
  sitemapChangefreq = "",
  siblingMetaTitles = [],
  structuredDataOverrides = "",
}: SeoFieldsSectionProps) {
  const metaTitleNormalized = metaTitle.trim().toLowerCase();
  const hasDuplicateMetaTitle =
    metaTitleNormalized.length > 0 &&
    siblingMetaTitles.some((t) => t.trim().toLowerCase() === metaTitleNormalized);

  let structuredDataError: string | null = null;
  if (structuredDataOverrides.trim()) {
    try {
      JSON.parse(structuredDataOverrides);
    } catch (err) {
      structuredDataError = err instanceof Error ? err.message : "Invalid JSON";
    }
  }

  const [isOpen, setIsOpen] = useState(
    Boolean(
      metaTitle ||
        metaDescription ||
        keywords ||
        ogTitle ||
        ogDescription ||
        canonicalUrl ||
        ogImageUrl ||
        robotsNoindex ||
        sitemapPriority !== null ||
        sitemapChangefreq,
    ),
  );

  const inputClass =
    "mt-1 w-full rounded-xl border border-[var(--border)]/50 bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none transition focus:border-slate-300";
  const labelClass =
    "text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted-foreground)]";

  const metaTitleLen = metaTitle.length;
  const metaDescLen = metaDescription.length;

  const slugPath =
    entityType === "product"
      ? `/products/${entitySlug ?? ""}`
      : entityType === "category"
        ? `/categories/${entitySlug ?? ""}`
        : `/categories/${entitySlug ?? ""}`;

  const previewTitle = (metaTitle || entityName || "").trim() || "Untitled";
  const previewDesc =
    (metaDescription || "Preview description for search results.").trim();
  const previewUrl = `${siteDomain.replace(/\/+$/, "")}${slugPath}`;
  const socialTitle = (ogTitle || metaTitle || entityName || "").trim();
  const socialDesc = (ogDescription || metaDescription || "").trim();
  const socialImage = ogImageUrl || entityImageUrl || null;

  return (
    <div className="rounded-xl border border-[var(--border)]/50 bg-[var(--muted)]/30 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[var(--muted)]/50 transition-colors"
      >
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--foreground)]">
          SEO & Open Graph
        </span>
        <ChevronDown
          size={16}
          className={cn(
            "text-[var(--muted-foreground)] transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen && (
        <div className="border-t border-[var(--border)]/50 px-4 pb-4 pt-3 space-y-4">
          {/* Generate Button */}
          <button
            type="button"
            onClick={onGenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-bold uppercase tracking-widest text-white transition-all hover:opacity-90 disabled:opacity-50"
          >
            {isGenerating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            {isGenerating ? "Generating..." : "Generate with AI"}
          </button>

          {/* SERP preview */}
          <div className="rounded-lg border border-[var(--border)]/40 bg-white px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted-foreground)] mb-2">
              Google preview
            </div>
            <div className="space-y-1">
              <div className="text-xs text-emerald-700">{previewUrl}</div>
              <div className="text-base text-blue-700 font-medium line-clamp-1">
                {previewTitle}
              </div>
              <div className="text-sm text-neutral-600 line-clamp-2">
                {previewDesc}
              </div>
            </div>
          </div>

          {/* Social preview */}
          <div className="rounded-lg border border-[var(--border)]/40 bg-white overflow-hidden">
            <div className="px-4 pt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
              Social share preview
            </div>
            <div className="px-4 pb-3 pt-2">
              <div className="rounded-md border border-neutral-200 overflow-hidden">
                {socialImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={socialImage}
                    alt=""
                    className="h-32 w-full object-cover"
                  />
                ) : (
                  <div className="h-32 w-full bg-gradient-to-br from-amber-50 to-amber-200" />
                )}
                <div className="bg-neutral-50 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-neutral-500">
                    {siteDomain.replace(/^https?:\/\//, "")}
                  </div>
                  <div className="text-sm font-semibold text-neutral-900 line-clamp-1">
                    {socialTitle || "Untitled"}
                  </div>
                  <div className="text-xs text-neutral-600 line-clamp-2">
                    {socialDesc || "No description provided."}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Meta Title */}
          <label className="block">
            <span className="flex items-center justify-between">
              <span className={labelClass}>Meta Title</span>
              <span
                className={cn(
                  "text-[10px] font-bold tabular-nums",
                  metaTitleLen > 60 ? "text-rose-500" : "text-[var(--muted-foreground)]",
                )}
              >
                {metaTitleLen}/60
              </span>
            </span>
            <input
              value={metaTitle}
              onChange={(e) => onChange("metaTitle", e.target.value)}
              className={inputClass}
              placeholder="SEO page title (max 60 chars)"
            />
            {hasDuplicateMetaTitle ? (
              <span className="mt-1 block text-[11px] font-semibold text-amber-700">
                ⚠ Another {entityType} already uses this exact meta title — search
                engines prefer unique titles per page.
              </span>
            ) : null}
          </label>

          {/* Meta Description */}
          <label className="block">
            <span className="flex items-center justify-between">
              <span className={labelClass}>Meta Description</span>
              <span
                className={cn(
                  "text-[10px] font-bold tabular-nums",
                  metaDescLen > 160 ? "text-rose-500" : "text-[var(--muted-foreground)]",
                )}
              >
                {metaDescLen}/160
              </span>
            </span>
            <textarea
              value={metaDescription}
              onChange={(e) => onChange("metaDescription", e.target.value)}
              className={`${inputClass} min-h-[60px]`}
              placeholder="Compelling description for search results (max 160 chars)"
            />
          </label>

          {/* Keywords */}
          <label className="block">
            <span className={labelClass}>Keywords</span>
            <textarea
              value={keywords}
              onChange={(e) => onChange("keywords", e.target.value)}
              className={`${inputClass} min-h-[60px]`}
              placeholder="Comma-separated search keywords"
            />
          </label>

          {/* OG Title & Description */}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>OG Title</span>
              <input
                value={ogTitle}
                onChange={(e) => onChange("ogTitle", e.target.value)}
                className={inputClass}
                placeholder="Social sharing title"
              />
            </label>
            <label className="block">
              <span className={labelClass}>OG Description</span>
              <input
                value={ogDescription}
                onChange={(e) => onChange("ogDescription", e.target.value)}
                className={inputClass}
                placeholder="Social sharing description"
              />
            </label>
          </div>

          {/* OG Image URL */}
          <label className="block">
            <span className={labelClass}>OG Image URL (override)</span>
            <input
              value={ogImageUrl}
              onChange={(e) => onChange("ogImageUrl", e.target.value)}
              className={inputClass}
              placeholder="https://... (falls back to product image)"
            />
          </label>

          {/* Canonical URL */}
          <label className="block">
            <span className={labelClass}>Canonical URL (override)</span>
            <input
              value={canonicalUrl}
              onChange={(e) => onChange("canonicalUrl", e.target.value)}
              className={inputClass}
              placeholder="Leave blank to auto-generate from slug"
            />
          </label>

          {/* Indexing + sitemap */}
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={robotsNoindex}
                onChange={(e) => onChange("robotsNoindex", e.target.checked)}
                className="h-4 w-4"
              />
              <span className={labelClass}>Hide from search (noindex)</span>
            </label>

            <label className="block">
              <span className={labelClass}>Sitemap priority</span>
              <input
                type="number"
                step="0.1"
                min={0}
                max={1}
                value={sitemapPriority ?? ""}
                onChange={(e) => {
                  // Emits a string to stay compatible with existing form state handlers.
                  // Empty string ⇒ null at persist time.
                  onChange("sitemapPriority", e.target.value);
                }}
                className={inputClass}
                placeholder="0.0 – 1.0"
              />
            </label>

            <label className="block">
              <span className={labelClass}>Sitemap change freq</span>
              <select
                value={sitemapChangefreq}
                onChange={(e) =>
                  onChange("sitemapChangefreq", e.target.value as ChangeFreq)
                }
                className={inputClass}
              >
                {CHANGE_FREQ_OPTIONS.map((opt) => (
                  <option key={opt || "default"} value={opt}>
                    {opt || "— default —"}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Structured data override (JSON-LD escape hatch) */}
          <label className="block">
            <span className="flex items-center justify-between">
              <span className={labelClass}>Structured data overrides (JSON-LD)</span>
              {structuredDataError ? (
                <span className="text-[10px] font-bold text-rose-500">
                  {structuredDataError}
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground">
                  Object merges over defaults · Array appends extra nodes
                </span>
              )}
            </span>
            <textarea
              value={structuredDataOverrides}
              onChange={(e) => onChange("structuredDataOverrides", e.target.value)}
              className={`${inputClass} min-h-[100px] font-mono text-xs`}
              placeholder={`{ "audience": { "@type": "PeopleAudience", "suggestedGender": "female" } }`}
            />
          </label>
        </div>
      )}
    </div>
  );
}
