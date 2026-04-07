"use client";

import { useEffect, useState } from "react";

import { CmsModal } from "@/components/cms/cms-modal";
import { Button } from "@/components/ui/button";
import type { CmsCategory } from "@/lib/cms-data";

import type { CategoryFormState } from "./types";
import { categoryToFormState, slugify } from "./utils";

type CategoryFormModalProps = {
  open: boolean;
  category: CmsCategory | null;
  onClose: () => void;
  onSave: (state: CategoryFormState) => Promise<void>;
  isSaving: boolean;
  error: string | null;
};

export function CategoryFormModal({
  open,
  category,
  onClose,
  onSave,
  isSaving,
  error,
}: CategoryFormModalProps) {
  const [formState, setFormState] = useState<CategoryFormState>(() =>
    categoryToFormState(category),
  );

  useEffect(() => {
    if (open) {
      setFormState(categoryToFormState(category));
    }
  }, [open, category]);

  const handleChange = (field: keyof CategoryFormState, value: string | boolean) => {
    setFormState((current) => {
      const next = { ...current, [field]: value };
      if (field === "name" && !current.slug) {
        next.slug = slugify(String(value));
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
            placeholder="Crochet gifts"
          />
        </label>
        <label className="block">
          <span className={labelClass}>Slug</span>
          <input
            value={formState.slug}
            onChange={(event) => handleChange("slug", event.target.value)}
            className={inputClass}
            placeholder="crochet-gifts"
          />
        </label>
      </div>

      <label className="block">
        <span className={labelClass}>Description</span>
        <textarea
          value={formState.description}
          onChange={(event) => handleChange("description", event.target.value)}
          className={`${inputClass} min-h-[80px]`}
          placeholder="Short customer-facing category description."
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
        <label className="flex items-center gap-3 rounded-xl border border-[var(--border)]/50 bg-white px-3 py-2 text-sm text-[var(--foreground)]">
          <input
            type="checkbox"
            checked={formState.isVisible}
            onChange={(event) => handleChange("isVisible", event.target.checked)}
          />
          Visible on storefront
        </label>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </CmsModal>
  );
}
