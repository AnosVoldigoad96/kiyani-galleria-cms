"use client";

import { useState } from "react";
import { ChevronDown, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type SeoFieldsSectionProps = {
  metaTitle: string;
  metaDescription: string;
  keywords: string;
  ogTitle: string;
  ogDescription: string;
  onChange: (field: string, value: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
};

export function SeoFieldsSection({
  metaTitle,
  metaDescription,
  keywords,
  ogTitle,
  ogDescription,
  onChange,
  onGenerate,
  isGenerating,
}: SeoFieldsSectionProps) {
  const [isOpen, setIsOpen] = useState(
    Boolean(metaTitle || metaDescription || keywords || ogTitle || ogDescription),
  );

  const inputClass =
    "mt-1 w-full rounded-xl border border-[var(--border)]/50 bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none transition focus:border-slate-300";
  const labelClass =
    "text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted-foreground)]";

  const metaTitleLen = metaTitle.length;
  const metaDescLen = metaDescription.length;

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
        </div>
      )}
    </div>
  );
}
