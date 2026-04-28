"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Save, Trash2, Upload } from "lucide-react";
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
  /** Index into the images array (0-based). */
  index: number;
  label: string;
  hint: string;
  /** Tailwind classes positioning this slot inside the preview frame. */
  previewClass: string;
};

type Props = {
  /** Section heading shown at the top of the card. */
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
  onRefresh?: () => void;
};

const inputClass =
  "mt-1 w-full rounded-xl border border-[var(--border)]/50 bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none transition focus:border-slate-400";
const labelClass =
  "text-xs font-bold uppercase tracking-[0.15em] text-[var(--muted-foreground)]";

function emptyImage(): CollectionImage {
  return { imageUrl: "", alt: "" };
}

export function ImageCollectionEditor({
  title,
  description,
  settingKey,
  slots,
  initialImages,
  previewAspect = "aspect-square",
  onRefresh,
}: Props) {
  const slotCount = slots.length;
  const padded = [...initialImages];
  while (padded.length < slotCount) padded.push(emptyImage());

  const [images, setImages] = useState<CollectionImage[]>(padded.slice(0, slotCount));
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

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

  return (
    <section className={surfaceClassName()}>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-full bg-foreground text-white hover:bg-black"
        >
          <Save className="size-4 mr-2" />
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
        {/* Live preview */}
        <div className="space-y-2">
          <p className={labelClass}>Live preview</p>
          <div className={`relative w-full ${previewAspect} rounded-2xl bg-muted/30 border border-border p-2`}>
            {slots.map((slot) => {
              const img = images[slot.index];
              return (
                <div
                  key={slot.index}
                  className={`${slot.previewClass} overflow-hidden bg-primary/5 border border-border/50 shadow-sm`}
                >
                  {img?.imageUrl ? (
                    <Image
                      src={img.imageUrl}
                      alt={img.alt || `Slot ${slot.index + 1}`}
                      fill
                      sizes="200px"
                      className="object-cover"
                    />
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
        <div className="space-y-4">
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
    </section>
  );
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
            <Image
              src={image.imageUrl}
              alt={image.alt || label}
              fill
              sizes="80px"
              className="object-cover"
            />
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

          <div className="flex items-center gap-2">
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
