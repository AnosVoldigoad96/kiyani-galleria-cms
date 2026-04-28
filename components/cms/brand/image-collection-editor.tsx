"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronDown, Save, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { surfaceClassName } from "@/components/cms/cms-shared";
import { upsertBrandSetting } from "@/components/cms/brand/brand-api";
import {
  uploadBrandImage,
  deleteProductImage,
  extractFileId,
} from "@/components/cms/products/products-api";

export type CollectionImage = {
  imageUrl: string;
  alt: string;
};

export type SlotConfig = {
  index: number;
  label: string;
  hint: string;
  /** Tailwind classes positioning this slot inside the preview frame. */
  previewClass: string;
};

type Props = {
  /** Eyebrow label shown above the heading (uppercase). */
  eyebrow: string;
  /** Section heading. */
  title: string;
  /** Helper text under the title. */
  description: string;
  /** brand_settings key the value will be written under. */
  settingKey: string;
  /** Slot definitions — order = render order in the right column. */
  slots: SlotConfig[];
  /** Existing images loaded from brand_settings. */
  initialImages: CollectionImage[];
  /** Aspect ratio of the live preview frame. Defaults to square. */
  previewAspect?: string;
  /** Whether the section starts collapsed. Defaults to true. */
  defaultCollapsed?: boolean;
  onRefresh?: () => void;
};

const inputClass =
  "mt-1 w-full rounded-xl border border-[var(--border)]/50 bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none transition focus:border-slate-400";
const labelClass =
  "text-xs font-bold uppercase tracking-[0.15em] text-[var(--muted-foreground)]";

function emptyImage(): CollectionImage {
  return { imageUrl: "", alt: "" };
}

function isExternalUrl(url: string): boolean {
  return /^https?:\/\//.test(url);
}

export function ImageCollectionEditor({
  eyebrow,
  title,
  description,
  settingKey,
  slots,
  initialImages,
  previewAspect = "aspect-square",
  defaultCollapsed = true,
  onRefresh,
}: Props) {
  const slotCount = slots.length;
  const padded = [...initialImages];
  while (padded.length < slotCount) padded.push(emptyImage());

  const [images, setImages] = useState<CollectionImage[]>(padded.slice(0, slotCount));
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  useEffect(() => {
    if (initialImages.length) {
      const next = [...initialImages];
      while (next.length < slotCount) next.push(emptyImage());
      setImages(next.slice(0, slotCount));
    }
  }, [initialImages, slotCount]);

  const updateImage = (index: number, patch: Partial<CollectionImage>) => {
    setImages((prev) => prev.map((img, i) => (i === index ? { ...img, ...patch } : img)));
  };

  const handleUpload = async (index: number, file: File) => {
    setUploadingIndex(index);
    try {
      const old = images[index].imageUrl;
      if (old) {
        const oldFileId = extractFileId(old);
        if (oldFileId) await deleteProductImage(oldFileId).catch(() => {});
      }
      const result = await uploadBrandImage(file);
      updateImage(index, { imageUrl: result.url });
      toast.success("Image uploaded.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Image upload failed.");
    } finally {
      setUploadingIndex(null);
    }
  };

  const handleRemove = async (index: number) => {
    const old = images[index].imageUrl;
    if (old) {
      const fileId = extractFileId(old);
      if (fileId) await deleteProductImage(fileId).catch(() => {});
    }
    updateImage(index, { imageUrl: "", alt: "" });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await upsertBrandSetting({
        key: settingKey,
        value: { images } as unknown as Record<string, unknown>,
      });
      toast.success(`${title} saved.`);
      onRefresh?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to save ${title.toLowerCase()}.`);
    } finally {
      setIsSaving(false);
    }
  };

  const filledCount = images.filter((img) => img.imageUrl).length;

  return (
    <section className={surfaceClassName("p-5 sm:p-8")}>
      {/* Header — matches brand-section style, clickable to collapse */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4 text-left"
      >
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--muted-foreground)]">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-2xl sm:text-3xl font-bold text-[var(--foreground)] flex items-center gap-3">
            {title}
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {filledCount}/{slotCount}
            </span>
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
        <ChevronDown
          className={`size-5 text-muted-foreground transition-transform ${collapsed ? "" : "rotate-180"}`}
        />
      </button>

      {!collapsed && (
        <>
          <div className="mt-6 flex justify-end">
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-lg bg-foreground px-5 text-xs font-bold text-white hover:bg-foreground/90"
            >
              <Save className="mr-2 size-4" />
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
            {/* Live preview */}
            <div className="space-y-2">
              <p className={labelClass}>Live preview</p>
              <div className={`relative w-full ${previewAspect} rounded-2xl bg-muted/40 border border-border p-2`}>
                {slots.map((slot) => {
                  const img = images[slot.index];
                  return (
                    <div
                      key={slot.index}
                      className={`${slot.previewClass} overflow-hidden bg-primary/5 border border-border/50 shadow-sm`}
                    >
                      {img?.imageUrl ? (
                        <PreviewImage url={img.imageUrl} alt={img.alt || `Slot ${slot.index + 1}`} />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-widest text-muted-foreground/60">
                          Slot {slot.index + 1}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Slot editors */}
            <div className="space-y-3">
              {slots.map((slot) => (
                <SlotEditor
                  key={slot.index}
                  label={slot.label}
                  hint={slot.hint}
                  image={images[slot.index] ?? emptyImage()}
                  isUploading={uploadingIndex === slot.index}
                  onUpload={(file) => handleUpload(slot.index, file)}
                  onRemove={() => handleRemove(slot.index)}
                  onAltChange={(alt) => updateImage(slot.index, { alt })}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

/**
 * Renders any image URL safely:
 * - Internal Nhost URLs → Next.js <Image> for optimization
 * - External fallback URLs (Unsplash defaults) → plain <img> to avoid
 *   needing every external host whitelisted
 */
function PreviewImage({ url, alt }: { url: string; alt: string }) {
  if (isExternalUrl(url) && !url.includes("nhost.run")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={alt} className="absolute inset-0 h-full w-full object-cover" />
    );
  }
  return <Image src={url} alt={alt} fill sizes="200px" className="object-cover" />;
}

function SlotEditor({
  label,
  hint,
  image,
  isUploading,
  onUpload,
  onRemove,
  onAltChange,
}: {
  label: string;
  hint: string;
  image: CollectionImage;
  isUploading: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
  onAltChange: (alt: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="flex items-start gap-4">
        <div className="relative h-20 w-20 shrink-0 rounded-lg overflow-hidden bg-muted border border-border">
          {image.imageUrl ? (
            <PreviewImage url={image.imageUrl} alt={image.alt || label} />
          ) : (
            <div className="flex h-full items-center justify-center text-[9px] text-muted-foreground/60">
              Empty
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div>
            <p className="text-sm font-bold text-foreground">{label}</p>
            <p className="text-[11px] text-muted-foreground italic">{hint}</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUpload(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50"
            >
              <Upload className="size-3.5" />
              {isUploading ? "Uploading..." : image.imageUrl ? "Replace" : "Upload"}
            </button>
            {image.imageUrl && (
              <button
                type="button"
                onClick={onRemove}
                className="flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50/50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
              >
                <Trash2 className="size-3.5" />
                Remove
              </button>
            )}
          </div>

          <label className="block">
            <span className={labelClass}>Alt text (for accessibility & SEO)</span>
            <input
              type="text"
              value={image.alt}
              onChange={(e) => onAltChange(e.target.value)}
              className={inputClass}
              placeholder="Hand-painted floral dupatta closeup"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
