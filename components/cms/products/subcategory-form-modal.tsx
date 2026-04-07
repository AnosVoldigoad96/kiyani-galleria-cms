"use client";

import { useEffect, useMemo, useState } from "react";

import { CmsModal } from "@/components/cms/cms-modal";
import { Button } from "@/components/ui/button";
import type { CmsCategory, CmsSubcategory } from "@/lib/cms-data";

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

  useEffect(() => {
    if (open) {
      setFormState(subcategoryToFormState(subcategory, fallbackCategoryId));
    }
  }, [open, subcategory, fallbackCategoryId]);

  const selectedCategory = useMemo(
    () => categories.find((item) => item.id === formState.categoryId),
    [categories, formState.categoryId],
  );

  const handleChange = (field: keyof SubcategoryFormState, value: string) => {
    setFormState((current) => {
      const next = { ...current, [field]: value };
      if (field === "name" && !current.slug) {
        next.slug = slugify(value);
      }
      return next;
    });
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
            placeholder="Handmade bouquets"
          />
        </label>
        <label className="block">
          <span className={labelClass}>Slug</span>
          <input
            value={formState.slug}
            onChange={(event) => handleChange("slug", event.target.value)}
            className={inputClass}
            placeholder="handmade-bouquets"
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

      <label className="block">
        <span className={labelClass}>Description</span>
        <textarea
          value={formState.description}
          onChange={(event) => handleChange("description", event.target.value)}
          className={`${inputClass} min-h-[80px]`}
          placeholder="Short customer-facing subcategory description."
        />
      </label>

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

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </CmsModal>
  );
}
