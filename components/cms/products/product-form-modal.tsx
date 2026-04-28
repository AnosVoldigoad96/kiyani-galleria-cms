"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { CmsModal } from "@/components/cms/cms-modal";
import { Button } from "@/components/ui/button";
import type { CmsCategory, CmsProduct, CmsSubcategory } from "@/lib/cms-data";

import { Trash2, ImagePlus } from "lucide-react";
import { AiDescriptionButton } from "./ai-description-button";
import {
  deleteProductImage,
  extractFileId,
  generateDescription,
  generateSeo,
  uploadProductImage,
} from "./products-api";
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
  onSave: (state: ProductFormState, imageFile: File | null, videoFile: File | null) => Promise<void>;
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
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGeneratingSeo, setIsGeneratingSeo] = useState(false);
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const [isDeletingImage, setIsDeletingImage] = useState(false);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const slugTouched = useRef(false);

  const handleGalleryUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploadingGallery(true);
    try {
      const uploads = await Promise.all(
        Array.from(files).map((file) => uploadProductImage(file)),
      );
      setFormState((prev) => ({
        ...prev,
        galleryImages: [
          ...prev.galleryImages,
          ...uploads.map((u) => ({ imageUrl: u.url, alt: "" })),
        ],
      }));
    } catch (err) {
      console.error("Gallery upload failed:", err);
    } finally {
      setIsUploadingGallery(false);
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  };

  const handleRemoveGalleryImage = async (index: number) => {
    const target = formState.galleryImages[index];
    if (target?.imageUrl) {
      const fileId = extractFileId(target.imageUrl);
      if (fileId) await deleteProductImage(fileId).catch(() => {});
    }
    setFormState((prev) => ({
      ...prev,
      galleryImages: prev.galleryImages.filter((_, i) => i !== index),
    }));
  };

  const updateGalleryAlt = (index: number, alt: string) => {
    setFormState((prev) => ({
      ...prev,
      galleryImages: prev.galleryImages.map((g, i) => (i === index ? { ...g, alt } : g)),
    }));
  };

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

  const handleRemoveVideo = async () => {
    if (!formState.videoUrl) return;
    const fileId = extractFileId(formState.videoUrl);
    if (fileId) {
      await deleteProductImage(fileId).catch((err) => {
        console.error("Video delete failed:", err);
      });
    }
    setFormState((prev) => ({ ...prev, videoUrl: "" }));
    setVideoFile(null);
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
      setVideoFile(null);
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
    await onSave(formState, imageFile, videoFile);
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

      {/* Variant options: sizes and/or yarn quality */}
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-3 rounded-xl border border-[var(--border)]/50 bg-white px-3 py-2 text-sm text-[var(--foreground)]">
            <input
              type="checkbox"
              checked={formState.hasSizes}
              onChange={(event) => handleChange("hasSizes", event.target.checked)}
            />
            Multiple sizes available
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-[var(--border)]/50 bg-white px-3 py-2 text-sm text-[var(--foreground)]">
            <input
              type="checkbox"
              checked={formState.hasQualityOptions}
              onChange={(event) => handleChange("hasQualityOptions", event.target.checked)}
            />
            Yarn quality (Local vs Imported)
          </label>
        </div>

        {/* Sizes editor */}
        {formState.hasSizes && (
          <div className="space-y-2 rounded-xl border border-[var(--border)]/50 bg-slate-50/50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--muted-foreground)]">
              {formState.hasQualityOptions
                ? "Sizes — enter local & imported yarn price for each"
                : "Sizes — each with its own price"}
            </p>
            {formState.sizes.length === 0 && (
              <p className="text-xs text-muted-foreground italic">No sizes added yet.</p>
            )}
            {formState.sizes.map((opt, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row sm:items-end gap-2">
                <label className="block flex-1 min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--muted-foreground)] sm:hidden">
                    Size
                  </span>
                  <input
                    type="text"
                    value={opt.size}
                    onChange={(e) => {
                      const next = [...formState.sizes];
                      next[idx] = { ...next[idx], size: e.target.value };
                      setFormState((p) => ({ ...p, sizes: next }));
                    }}
                    className={`${inputClass} !mt-1 sm:!mt-0`}
                    placeholder="Size (e.g. Small, A4, 12 inch)"
                  />
                </label>

                {formState.hasQualityOptions ? (
                  <>
                    <label className="block sm:w-32 shrink-0">
                      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--muted-foreground)] sm:hidden">
                        Local (PKR)
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={opt.localPrice}
                        onChange={(e) => {
                          const next = [...formState.sizes];
                          next[idx] = { ...next[idx], localPrice: e.target.value };
                          setFormState((p) => ({ ...p, sizes: next }));
                        }}
                        className={`${inputClass} !mt-1 sm:!mt-0`}
                        placeholder="Local"
                      />
                    </label>
                    <label className="block sm:w-32 shrink-0">
                      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--muted-foreground)] sm:hidden">
                        Imported (PKR)
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={opt.importedPrice}
                        onChange={(e) => {
                          const next = [...formState.sizes];
                          next[idx] = { ...next[idx], importedPrice: e.target.value };
                          setFormState((p) => ({ ...p, sizes: next }));
                        }}
                        className={`${inputClass} !mt-1 sm:!mt-0`}
                        placeholder="Imported"
                      />
                    </label>
                  </>
                ) : (
                  <label className="block sm:w-36 shrink-0">
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--muted-foreground)] sm:hidden">
                      Price (PKR)
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={opt.price}
                      onChange={(e) => {
                        const next = [...formState.sizes];
                        next[idx] = { ...next[idx], price: e.target.value };
                        setFormState((p) => ({ ...p, sizes: next }));
                      }}
                      className={`${inputClass} !mt-1 sm:!mt-0`}
                      placeholder="Price"
                    />
                  </label>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setFormState((p) => ({ ...p, sizes: p.sizes.filter((_, i) => i !== idx) }))
                  }
                  className="self-end sm:self-auto h-10 w-10 sm:w-auto sm:h-auto sm:p-2 rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600 flex items-center justify-center text-lg shrink-0"
                  aria-label="Remove size"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setFormState((p) => ({
                  ...p,
                  sizes: [...p.sizes, { size: "", price: "", localPrice: "", importedPrice: "" }],
                }))
              }
              className="mt-2 w-full rounded-lg border border-dashed border-[var(--border)] py-2 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary"
            >
              + Add size option
            </button>
          </div>
        )}

        {/* Standalone yarn quality (only when sizes is OFF) */}
        {formState.hasQualityOptions && !formState.hasSizes && (
          <div className="grid gap-3 rounded-xl border border-[var(--border)]/50 bg-slate-50/50 p-4 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Local yarn price (PKR)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formState.localPricePkr}
                onChange={(e) => handleChange("localPricePkr", e.target.value)}
                className={inputClass}
                placeholder="e.g. 1500"
              />
            </label>
            <label className="block">
              <span className={labelClass}>Imported yarn price (PKR)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formState.importedPricePkr}
                onChange={(e) => handleChange("importedPricePkr", e.target.value)}
                className={inputClass}
                placeholder="e.g. 2500"
              />
            </label>
          </div>
        )}
      </div>

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
            <label className="block">
              <span className={labelClass}>{formState.videoUrl ? "Replace hover video" : "Upload hover video"}</span>
              <input
                type="file"
                accept="video/webm,video/mp4"
                onChange={(event) => setVideoFile(event.target.files?.[0] ?? null)}
                className={`${inputClass} !py-1`}
              />
              <p className="mt-1 text-[10px] text-[var(--muted-foreground)]">
                WebM recommended (lighter). Plays on product card hover.
              </p>
            </label>
            {formState.videoUrl && !videoFile && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                <span>Video attached</span>
                <button
                  type="button"
                  onClick={() => void handleRemoveVideo()}
                  className="ml-auto text-red-500 hover:text-red-700 text-[10px] font-bold uppercase"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Gallery — additional product images beyond the cover */}
      <div className="space-y-3 rounded-2xl border border-[var(--border)]/50 bg-slate-50/50 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-bold text-[var(--foreground)]">Additional gallery images</p>
            <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
              Extra angles or detail shots. Cover image (above) is shown first; these appear after.
            </p>
          </div>
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => void handleGalleryUpload(event.target.files)}
          />
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            disabled={isUploadingGallery}
            className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50"
          >
            {isUploadingGallery ? "Uploading..." : "+ Add images"}
          </button>
        </div>

        {formState.galleryImages.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No additional images yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {formState.galleryImages.map((img, idx) => (
              <div key={idx} className="rounded-xl border border-border bg-white p-2 space-y-2">
                <div className="relative aspect-square rounded-lg overflow-hidden bg-muted border border-border/50">
                  <img
                    src={img.imageUrl}
                    alt={img.alt || `Gallery image ${idx + 1}`}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => void handleRemoveGalleryImage(idx)}
                    className="absolute top-1.5 right-1.5 size-7 rounded-full bg-white/90 backdrop-blur text-red-600 hover:bg-red-50 flex items-center justify-center text-sm shadow"
                    aria-label="Remove image"
                  >
                    ×
                  </button>
                </div>
                <input
                  type="text"
                  value={img.alt}
                  onChange={(e) => updateGalleryAlt(idx, e.target.value)}
                  placeholder="Alt text (optional)"
                  className={`${inputClass} !mt-0 !text-xs`}
                />
              </div>
            ))}
          </div>
        )}
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
