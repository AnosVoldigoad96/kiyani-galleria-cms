"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { CmsModal } from "@/components/cms/cms-modal";
import { Button } from "@/components/ui/button";
import type { CmsCategory, CmsSubcategory } from "@/lib/cms-data";

import { AiDescriptionButton } from "./ai-description-button";
import { generateDescription, generateSeo } from "./products-api";
import { SeoFieldsSection } from "./seo-fields-section";
import type { SubcategoryFormState } from "./types";
import { fromSubcategoryStatus, slugify, subcategoryToFormState } from "./utils";

type SubcategoryFormModalProps = {
  open: boolean;
  categories: CmsCategory[];
  subcategory: CmsSubcategory | null;
  fallbackCategoryId?: string;
  onClose: () => void;
  onSave: (state: SubcategoryFormState) => Promise<void>;
  isSaving: boolean;
  error: string | null;
};

export function SubcategoryFormModal({
  open,
  categories,
  subcategory,
  fallbackCategoryId,
  onClose,
  onSave,
  isSaving,
  error,
}: SubcategoryFormModalProps) {
  const [formState, setFormState] = useState<SubcategoryFormState>(() =>
    subcategoryToFormState(subcategory, fallbackCategoryId),
  );

  const slugTouched = useRef(false);

  useEffect(() => {
    if (open) {
      setFormState(subcategoryToFormState(subcategory, fallbackCategoryId));
      slugTouched.current = Boolean(subcategory);
    }
  }, [open, subcategory, fallbackCategoryId]);

  const selectedCategory = useMemo(
    () => categories.find((item) => item.id === formState.categoryId),
    [categories, formState.categoryId],
  );

  const handleChange = (field: keyof SubcategoryFormState, value: string) => {
    if (field === "slug") {
      slugTouched.current = true;
    }
    setFormState((current) => {
      const next = { ...current, [field]: value };
      if (field === "name" && !slugTouched.current) {
        next.slug = slugify(value);
      }
      return next;
    });
  };

  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const [isGeneratingSeo, setIsGeneratingSeo] = useState(false);

  const handleGenerateDescription = async () => {
    if (!formState.name.trim()) return;
    setIsGeneratingDesc(true);
    try {
      const desc = await generateDescription({
        type: "subcategory",
        name: formState.name,
        category: selectedCategory?.name,
      });
      setFormState((prev) => ({ ...prev, description: desc }));
    } catch (err) {
      console.error("Description generation failed:", err);
    } finally {
      setIsGeneratingDesc(false);
    }
  };

  const handleGenerateSeo = async () => {
    if (!formState.name.trim()) return;
    setIsGeneratingSeo(true);
    try {
      const result = await generateSeo({
        type: "subcategory",
        name: formState.name,
        description: formState.description || undefined,
        category: selectedCategory?.name,
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
      title={subcategory ? "Edit subcategory" : "Add subcategory"}
      description="Group products into clean sections for browsing."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? "Saving..." : subcategory ? "Save changes" : "Create subcategory"}
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
            placeholder="Painted Dupattas"
          />
        </label>
        <label className="block">
          <span className={labelClass}>Slug</span>
          <input
            value={formState.slug}
            onChange={(event) => handleChange("slug", event.target.value)}
            className={inputClass}
            placeholder="painted-dupattas"
          />
        </label>
      </div>

      <label className="block">
        <span className={labelClass}>Category</span>
        <select
          value={formState.categoryId}
          onChange={(event) => handleChange("categoryId", event.target.value)}
          className={inputClass}
        >
          <option value="" disabled>
            Select category
          </option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        {selectedCategory?.description ? (
          <p className="mt-2 text-xs text-[var(--muted-foreground)]">{selectedCategory.description}</p>
        ) : null}
      </label>

      <div className="block">
        <span className="flex items-center gap-2">
          <span className={labelClass}>Description</span>
          <AiDescriptionButton onClick={handleGenerateDescription} isGenerating={isGeneratingDesc} />
        </span>
        <textarea
          value={formState.description}
          onChange={(event) => handleChange("description", event.target.value)}
          className={`${inputClass} min-h-[80px]`}
          placeholder="Short customer-facing subcategory description."
        />
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
        <label className="block">
          <span className={labelClass}>Status</span>
          <select
            value={formState.status}
            onChange={(event) => handleChange("status", event.target.value)}
            className={inputClass}
          >
            {(["live", "draft"] as const).map((value) => (
              <option key={value} value={value}>
                {fromSubcategoryStatus(value)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <SeoFieldsSection
        metaTitle={formState.metaTitle}
        metaDescription={formState.metaDescription}
        keywords={formState.keywords}
        ogTitle={formState.ogTitle}
        ogDescription={formState.ogDescription}
        onChange={(field, value) => handleChange(field as keyof SubcategoryFormState, value)}
        onGenerate={handleGenerateSeo}
        isGenerating={isGeneratingSeo}
      />

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </CmsModal>
  );
}
