"use client";

import { useEffect, useRef, useState } from "react";

import { CmsModal } from "@/components/cms/cms-modal";
import { Button } from "@/components/ui/button";
import type { CmsCategory } from "@/lib/cms-data";

import { generateSeo } from "./products-api";
import { SeoFieldsSection } from "./seo-fields-section";
import type { CategoryFormState } from "./types";
import { categoryToFormState, slugify } from "./utils";

type CategoryFormModalProps = {
  open: boolean;
  category: CmsCategory | null;
  siblingMetaTitles?: string[];
  onClose: () => void;
  onSave: (state: CategoryFormState) => Promise<void>;
  isSaving: boolean;
  error: string | null;
};

export function CategoryFormModal({
  open,
  category,
  siblingMetaTitles = [],
  onClose,
  onSave,
  isSaving,
  error,
}: CategoryFormModalProps) {
  const [formState, setFormState] = useState<CategoryFormState>(() =>
    categoryToFormState(category),
  );

  const slugTouched = useRef(false);

  useEffect(() => {
    if (open) {
      setFormState(categoryToFormState(category));
      slugTouched.current = Boolean(category);
    }
  }, [open, category]);

  const handleChange = (field: keyof CategoryFormState, value: string | boolean) => {
    if (field === "slug") {
      slugTouched.current = true;
    }
    setFormState((current) => {
      const next = { ...current, [field]: value };
      if (field === "name" && !slugTouched.current) {
        next.slug = slugify(String(value));
      }
      return next;
    });
  };

  const [isGeneratingSeo, setIsGeneratingSeo] = useState(false);

  const handleGenerateSeo = async () => {
    if (!formState.name.trim()) return;
    setIsGeneratingSeo(true);
    try {
      const result = await generateSeo({
        type: "category",
        name: formState.name,
      });
      setFormState((prev) => ({
        ...prev,
        metaTitle: result.meta_title,
        metaDescription: result.meta_description,
        keywords: result.keywords,
        ogTitle: result.og_title,
        ogDescription: result.og_description,
      }));
    } catch (err) {
      console.error("SEO generation failed:", err);
    } finally {
      setIsGeneratingSeo(false);
    }
  };

  const handleSubmit = async () => {
    await onSave(formState);
  };

  const inputClass =
    "mt-1 w-full rounded-xl border border-[var(--border)]/50 bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none transition focus:border-slate-300";

  const labelClass =
    "text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted-foreground)]";

  return (
    <CmsModal
      open={open}
      title={category ? "Edit category" : "Add category"}
      description="Keep names and slugs aligned for storefront navigation."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? "Saving..." : category ? "Save changes" : "Create category"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Name</span>
          <input
            value={formState.name}
            onChange={(event) => handleChange("name", event.target.value)}
            className={inputClass}
            placeholder="Wedding Gifts"
          />
        </label>
        <label className="block">
          <span className={labelClass}>Slug</span>
          <input
            value={formState.slug}
            onChange={(event) => handleChange("slug", event.target.value)}
            className={inputClass}
            placeholder="wedding-gifts"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Sort order</span>
          <input
            value={formState.sortOrder}
            onChange={(event) => handleChange("sortOrder", event.target.value)}
            className={inputClass}
            type="number"
          />
        </label>
        <label className="flex items-center gap-3 rounded-xl border border-[var(--border)]/50 bg-white px-3 py-2 text-sm text-[var(--foreground)]">
          <input
            type="checkbox"
            checked={formState.isVisible}
            onChange={(event) => handleChange("isVisible", event.target.checked)}
          />
          Visible on storefront
        </label>
      </div>

      <SeoFieldsSection
        metaTitle={formState.metaTitle}
        metaDescription={formState.metaDescription}
        keywords={formState.keywords}
        ogTitle={formState.ogTitle}
        ogDescription={formState.ogDescription}
        canonicalUrl={formState.canonicalUrl}
        ogImageUrl={formState.ogImageUrl}
        robotsNoindex={formState.robotsNoindex}
        sitemapPriority={formState.sitemapPriority === "" ? null : Number(formState.sitemapPriority)}
        sitemapChangefreq={(formState.sitemapChangefreq || "") as "" | "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never"}
        entityName={formState.name}
        entitySlug={formState.slug}
        entityType="category"
        siblingMetaTitles={siblingMetaTitles}
        structuredDataOverrides={formState.structuredDataOverrides}
        onChange={(field, value) => handleChange(field as keyof CategoryFormState, value)}
        onGenerate={handleGenerateSeo}
        isGenerating={isGeneratingSeo}
      />

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </CmsModal>
  );
}
