"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { CmsModal } from "@/components/cms/cms-modal";
import { Button } from "@/components/ui/button";
import type { CmsCategory, CmsProduct, CmsSubcategory } from "@/lib/cms-data";

import { Trash2, ImagePlus } from "lucide-react";
import { AiDescriptionButton } from "./ai-description-button";
import { deleteProductImage, extractFileId, generateDescription, generateSeo } from "./products-api";
import { SeoFieldsSection } from "./seo-fields-section";
import type { ProductFormState, RecordStatus } from "./types";
import { fromRecordStatus, parseFeatures, productToFormState, slugify } from "./utils";

type ProductFormModalProps = {
  open: boolean;
  product: CmsProduct | null;
  mode: "create" | "edit" | "clone";
  categories: CmsCategory[];
  subcategories: CmsSubcategory[];
  fallbackCategoryId?: string;
  defaultSku?: string;
  siblingMetaTitles?: string[];
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
  defaultSku,
  siblingMetaTitles = [],
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
  const [isGeneratingSeo, setIsGeneratingSeo] = useState(false);
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const [isDeletingImage, setIsDeletingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const slugTouched = useRef(false);

  const handleDeleteImage = async () => {
    if (!formState.imageUrl) return;
    const fileId = extractFileId(formState.imageUrl);
    setIsDeletingImage(true);
    try {
      if (fileId) {
        await deleteProductImage(fileId);
      }
      setFormState((prev) => ({ ...prev, imageUrl: "", imageAlt: "" }));
      setImageFile(null);
      setPreviewUrl(null);
    } catch (err) {
      console.error("Image delete failed:", err);
    } finally {
      setIsDeletingImage(false);
    }
  };

  const handleGenerateDescription = async () => {
    if (!formState.name.trim()) return;
    setIsGeneratingDesc(true);
    try {
      const desc = await generateDescription({
        type: "product",
        name: formState.name,
        category: categories.find((c) => c.id === formState.categoryId)?.name,
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
        type: "product",
        name: formState.name,
        description: formState.description || undefined,
        category: categories.find((c) => c.id === formState.categoryId)?.name,
        price: Number(formState.pricePkr) || undefined,
        features: parseFeatures(formState.featuresText),
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

  useEffect(() => {
    if (open) {
      const initial = productToFormState(product, fallbackCategoryId);
      if (!product && defaultSku) {
        initial.sku = defaultSku;
      }
      setFormState(initial);
      setImageFile(null);
      setPreviewUrl(null);
      slugTouched.current = Boolean(product);
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
            placeholder="Hand-painted Dupatta Set"
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
            placeholder="hand-painted-dupatta-set"
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

      <div className="block">
        <span className="flex items-center gap-2">
          <span className={labelClass}>Description</span>
          <AiDescriptionButton onClick={handleGenerateDescription} isGenerating={isGeneratingDesc} />
        </span>
        <textarea
          value={formState.description}
          onChange={(event) => handleChange("description", event.target.value)}
          className={`${inputClass} min-h-[80px]`}
          placeholder="Capture the product story and materials."
        />
      </div>

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

      <div>
        <span className={labelClass}>Product Image</span>
        <div className="mt-2 grid gap-4 sm:grid-cols-[0.7fr_1.3fr]">
          <div className="relative rounded-xl border border-[var(--border)]/50 bg-white p-2 text-center text-xs text-[var(--muted-foreground)]">
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" className="h-36 w-full rounded-lg object-cover" />
            ) : formState.imageUrl ? (
              <>
                <img
                  src={formState.imageUrl}
                  alt={formState.imageAlt || "Product image"}
                  className="h-36 w-full rounded-lg object-cover"
                />
                <button
                  type="button"
                  onClick={handleDeleteImage}
                  disabled={isDeletingImage}
                  className="absolute top-3 right-3 flex items-center justify-center size-7 rounded-full bg-red-500 text-white shadow-md hover:bg-red-600 transition-colors disabled:opacity-50"
                  title="Remove image"
                >
                  <Trash2 size={14} />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-36 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 transition-colors cursor-pointer"
              >
                <ImagePlus size={24} className="text-[var(--muted-foreground)]" />
                <span>Click to upload</span>
              </button>
            )}
          </div>
          <div className="space-y-3">
            <label className="block">
              <span className={labelClass}>Image alt text</span>
              <input
                value={formState.imageAlt}
                onChange={(event) => handleChange("imageAlt", event.target.value)}
                className={inputClass}
                placeholder="Painted dupatta on wooden surface"
              />
            </label>
            <label className="block">
              <span className={labelClass}>{formState.imageUrl ? "Replace image" : "Upload image"}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
                className={`${inputClass} !py-1`}
              />
            </label>
          </div>
        </div>
      </div>

      <label className="block">
        <span className={labelClass}>Feature bullets (one per line)</span>
        <textarea
          value={formState.featuresText}
          onChange={(event) => handleChange("featuresText", event.target.value)}
          className={`${inputClass} min-h-[120px]`}
          placeholder="Hand-painted floral design&#10;Premium cotton fabric&#10;Gift-ready packaging"
        />
      </label>

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
        entityType="product"
        entityImageUrl={formState.imageUrl}
        siblingMetaTitles={siblingMetaTitles}
        structuredDataOverrides={formState.structuredDataOverrides}
        onChange={(field, value) => handleChange(field as keyof ProductFormState, value)}
        onGenerate={handleGenerateSeo}
        isGenerating={isGeneratingSeo}
      />

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </CmsModal>
  );
}
