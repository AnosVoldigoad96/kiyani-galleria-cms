"use client";

import { useEffect, useMemo, useState } from "react";

import { CmsModal } from "@/components/cms/cms-modal";
import { Button } from "@/components/ui/button";
import type { CmsCategory, CmsProduct, CmsSubcategory } from "@/lib/cms-data";

import type { ProductFormState, RecordStatus } from "./types";
import { fromRecordStatus, productToFormState, slugify } from "./utils";

type ProductFormModalProps = {
  open: boolean;
  product: CmsProduct | null;
  mode: "create" | "edit" | "clone";
  categories: CmsCategory[];
  subcategories: CmsSubcategory[];
  fallbackCategoryId?: string;
  onClose: () => void;
  onSave: (state: ProductFormState, imageFile: File | null) => Promise<void>;
  isSaving: boolean;
  error: string | null;
};

export function ProductFormModal({
  open,
  product,
  mode,
  categories,
  subcategories,
  fallbackCategoryId,
  onClose,
  onSave,
  isSaving,
  error,
}: ProductFormModalProps) {
  const [formState, setFormState] = useState<ProductFormState>(() =>
    productToFormState(product, fallbackCategoryId),
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFormState(productToFormState(product, fallbackCategoryId));
      setImageFile(null);
      setPreviewUrl(null);
    }
  }, [open, product, fallbackCategoryId]);

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(imageFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile]);

  const availableSubcategories = useMemo(() => {
    if (!formState.categoryId) {
      return subcategories;
    }

    return subcategories.filter((item) => item.categoryId === formState.categoryId);
  }, [formState.categoryId, subcategories]);

  const handleChange = (
    field: keyof ProductFormState,
    value: string | boolean,
  ) => {
    setFormState((current) => {
      const next = { ...current, [field]: value };
      if (field === "name" && !current.slug) {
        next.slug = slugify(String(value));
      }
      return next;
    });
  };

  const handleStatusChange = (value: RecordStatus) => {
    setFormState((current) => ({ ...current, status: value }));
  };

  const handleSubmit = async () => {
    await onSave(formState, imageFile);
  };

  const inputClass =
    "mt-1 w-full rounded-xl border border-[var(--border)]/50 bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none transition focus:border-slate-300";
  const labelClass =
    "text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted-foreground)]";

  const heading = mode === "edit" ? "Edit product" : mode === "clone" ? "Clone product" : "Add product";

  return (
    <CmsModal
      open={open}
      title={heading}
      description="Update catalog essentials, pricing, and visibility."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? "Saving..." : mode === "edit" ? "Save changes" : "Save product"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Product name</span>
          <input
            value={formState.name}
            onChange={(event) => handleChange("name", event.target.value)}
            className={inputClass}
            placeholder="Spring crochet bouquet"
          />
        </label>
        <label className="block">
          <span className={labelClass}>SKU</span>
          <input
            value={formState.sku}
            onChange={(event) => handleChange("sku", event.target.value)}
            className={inputClass}
            placeholder="CK-BOUQ-001"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Slug</span>
          <input
            value={formState.slug}
            onChange={(event) => handleChange("slug", event.target.value)}
            className={inputClass}
            placeholder="spring-crochet-bouquet"
          />
        </label>
        <label className="block">
          <span className={labelClass}>Status</span>
          <select
            value={formState.status}
            onChange={(event) => handleStatusChange(event.target.value as RecordStatus)}
            className={inputClass}
          >
            {(["live", "draft", "archived"] as const).map((value) => (
              <option key={value} value={value}>
                {fromRecordStatus(value)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className={labelClass}>Description</span>
        <textarea
          value={formState.description}
          onChange={(event) => handleChange("description", event.target.value)}
          className={`${inputClass} min-h-[80px]`}
          placeholder="Capture the product story and materials."
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-4">
        <label className="block">
          <span className={labelClass}>Price (PKR)</span>
          <input
            value={formState.pricePkr}
            onChange={(event) => handleChange("pricePkr", event.target.value)}
            className={inputClass}
            type="number"
            min="0"
          />
        </label>
        <label className="block">
          <span className={labelClass}>Our price (PKR)</span>
          <input
            value={formState.ourPricePkr}
            onChange={(event) => handleChange("ourPricePkr", event.target.value)}
            className={inputClass}
            type="number"
            min="0"
          />
        </label>
        <label className="block">
          <span className={labelClass}>Rating</span>
          <input
            value={formState.rating}
            onChange={(event) => handleChange("rating", event.target.value)}
            className={inputClass}
            type="number"
            min="0"
            max="5"
            step="0.1"
          />
        </label>
        <label className="block">
          <span className={labelClass}>Stock quantity</span>
          <input
            value={formState.stockQuantity}
            onChange={(event) => handleChange("stockQuantity", event.target.value)}
            className={inputClass}
            type="number"
            min="0"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Stock label</span>
          <input
            value={formState.stockLabel}
            onChange={(event) => handleChange("stockLabel", event.target.value)}
            className={inputClass}
            placeholder="12 units"
          />
        </label>
        <label className="block">
          <span className={labelClass}>Discount percent</span>
          <input
            value={formState.discountPercent}
            onChange={(event) => handleChange("discountPercent", event.target.value)}
            className={inputClass}
            type="number"
            min="0"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
        </label>
        <label className="block">
          <span className={labelClass}>Subcategory</span>
          <select
            value={formState.subcategoryId}
            onChange={(event) => handleChange("subcategoryId", event.target.value)}
            className={inputClass}
          >
            <option value="">No subcategory</option>
            {availableSubcategories.map((subcategory) => (
              <option key={subcategory.id} value={subcategory.id}>
                {subcategory.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex items-center gap-3 rounded-xl border border-[var(--border)]/50 bg-white px-3 py-2 text-sm text-[var(--foreground)]">
        <input
          type="checkbox"
          checked={formState.discountEnabled}
          onChange={(event) => handleChange("discountEnabled", event.target.checked)}
        />
        Discount enabled
      </label>

      <div>
        <p className={labelClass}>Flags</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {[
            ["isTrending", "Trending"],
            ["isBestSeller", "Best seller"],
            ["isNewArrival", "New arrival"],
            ["isTopRated", "Top rated"],
            ["isDealOfDay", "Deal of day"],
          ].map(([key, label]) => (
            <label
              key={key}
              className="flex items-center gap-3 rounded-xl border border-[var(--border)]/50 bg-white px-3 py-2 text-sm text-[var(--foreground)]"
            >
              <input
                type="checkbox"
                checked={formState[key as keyof ProductFormState] as boolean}
                onChange={(event) =>
                  handleChange(key as keyof ProductFormState, event.target.checked)
                }
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1.2fr_0.8fr]">
        <label className="block">
          <span className={labelClass}>Image alt text</span>
          <input
            value={formState.imageAlt}
            onChange={(event) => handleChange("imageAlt", event.target.value)}
            className={inputClass}
            placeholder="Bouquet on pastel background"
          />
        </label>
        <label className="block">
          <span className={labelClass}>Upload image</span>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
            className={`${inputClass} !py-1`}
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-[0.7fr_1.3fr]">
        <div className="rounded-xl border border-[var(--border)]/50 bg-white p-2 text-center text-xs text-[var(--muted-foreground)]">
          {previewUrl ? (
            <img src={previewUrl} alt="Preview" className="h-32 w-full rounded-lg object-cover" />
          ) : formState.imageUrl ? (
            <img
              src={formState.imageUrl}
              alt={formState.imageAlt || "Product image"}
              className="h-32 w-full rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-[var(--border)]">
              No image uploaded
            </div>
          )}
        </div>
        <label className="block">
          <span className={labelClass}>Feature bullets (one per line)</span>
          <textarea
            value={formState.featuresText}
            onChange={(event) => handleChange("featuresText", event.target.value)}
            className={`${inputClass} min-h-[145px]`}
            placeholder="Soft crochet finish&#10;Custom color palette&#10;Gift ready packaging"
          />
        </label>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </CmsModal>
  );
}
