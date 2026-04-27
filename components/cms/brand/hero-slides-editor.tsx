"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { GripVertical, Plus, Save, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { surfaceClassName } from "@/components/cms/cms-shared";
import { upsertBrandSetting } from "@/components/cms/brand/brand-api";
import { uploadProductImage, deleteProductImage, extractFileId } from "@/components/cms/products/products-api";

export type HeroSlide = {
  imageUrl: string;
  subtitle: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaLink: string;
};

type HeroSlidesEditorProps = {
  initialSlides: HeroSlide[];
  onRefresh?: () => void;
};

const DEFAULT_SLIDE: HeroSlide = {
  imageUrl: "",
  subtitle: "",
  title: "",
  description: "",
  ctaLabel: "Shop Collection",
  ctaLink: "/shop",
};

const inputClass =
  "mt-1 w-full rounded-xl border border-[var(--border)]/50 bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none transition focus:border-slate-400";
const labelClass =
  "text-xs font-bold uppercase tracking-[0.15em] text-[var(--muted-foreground)]";

export function HeroSlidesEditor({ initialSlides, onRefresh }: HeroSlidesEditorProps) {
  const [slides, setSlides] = useState<HeroSlide[]>(
    initialSlides.length ? initialSlides : [{ ...DEFAULT_SLIDE }],
  );
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  // Sync when initial slides arrive
  useEffect(() => {
    if (initialSlides.length) {
      setSlides(initialSlides);
    }
  }, [initialSlides]);

  const updateSlide = (index: number, patch: Partial<HeroSlide>) => {
    setSlides((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const addSlide = () => {
    setSlides((prev) => [...prev, { ...DEFAULT_SLIDE }]);
  };

  const removeSlide = async (index: number) => {
    const slide = slides[index];
    if (slide.imageUrl) {
      const fileId = extractFileId(slide.imageUrl);
      if (fileId) {
        await deleteProductImage(fileId).catch(() => {});
      }
    }
    setSlides((prev) => prev.filter((_, i) => i !== index));
  };

  const moveSlide = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= slides.length) return;
    setSlides((prev) => {
      const copy = [...prev];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  };

  const handleImageUpload = async (index: number, file: File) => {
    setUploadingIndex(index);
    try {
      // Delete old image if replacing
      const old = slides[index].imageUrl;
      if (old) {
        const oldFileId = extractFileId(old);
        if (oldFileId) await deleteProductImage(oldFileId).catch(() => {});
      }
      const upload = await uploadProductImage(file);
      updateSlide(index, { imageUrl: upload.url });
      toast.success("Image uploaded.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Image upload failed.";
      toast.error(message);
    } finally {
      setUploadingIndex(null);
    }
  };

  const handleSave = async () => {
    // Validate
    const invalid = slides.findIndex(
      (s) => !s.imageUrl || !s.title.trim() || !s.ctaLabel.trim() || !s.ctaLink.trim(),
    );
    if (invalid !== -1) {
      toast.error(`Slide ${invalid + 1} is missing required fields (image, title, CTA).`);
      return;
    }

    setIsSaving(true);
    try {
      await upsertBrandSetting({
        key: "hero_slides",
        value: { slides } as unknown as Record<string, unknown>,
      });
      toast.success("Hero slides saved.");
      onRefresh?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save hero slides.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className={surfaceClassName()}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Homepage Hero Slides</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage rotating hero images and content. Slides auto-rotate every 5 seconds.
          </p>
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

      <div className="space-y-6">
        {slides.map((slide, index) => (
          <SlideCard
            key={index}
            slide={slide}
            index={index}
            isFirst={index === 0}
            isLast={index === slides.length - 1}
            isUploading={uploadingIndex === index}
            onUpdate={(patch) => updateSlide(index, patch)}
            onUpload={(file) => handleImageUpload(index, file)}
            onRemove={() => removeSlide(index)}
            onMove={(dir) => moveSlide(index, dir)}
          />
        ))}

        <button
          type="button"
          onClick={addSlide}
          className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border py-8 text-sm font-medium text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
        >
          <Plus className="size-4" />
          Add another slide
        </button>
      </div>
    </section>
  );
}

function SlideCard({
  slide,
  index,
  isFirst,
  isLast,
  isUploading,
  onUpdate,
  onUpload,
  onRemove,
  onMove,
}: {
  slide: HeroSlide;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isUploading: boolean;
  onUpdate: (patch: Partial<HeroSlide>) => void;
  onUpload: (file: File) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <GripVertical className="size-4 text-muted-foreground" />
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Slide {index + 1}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={isFirst}
            className="rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={isLast}
            className="rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-30"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors"
            aria-label="Remove slide"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-[280px_1fr]">
        {/* Image preview + upload */}
        <div className="space-y-2">
          <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-muted border border-border">
            {slide.imageUrl ? (
              <Image
                src={slide.imageUrl}
                alt={slide.title || `Slide ${index + 1}`}
                fill
                sizes="280px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                No image
              </div>
            )}
          </div>
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
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50"
          >
            <Upload className="size-3.5" />
            {isUploading ? "Uploading..." : slide.imageUrl ? "Replace image" : "Upload image"}
          </button>
        </div>

        {/* Fields */}
        <div className="space-y-3">
          <label className="block">
            <span className={labelClass}>Subtitle (eyebrow)</span>
            <input
              type="text"
              value={slide.subtitle}
              onChange={(e) => onUpdate({ subtitle: e.target.value })}
              className={inputClass}
              placeholder="Handcrafted with love"
            />
          </label>
          <label className="block">
            <span className={labelClass}>Title *</span>
            <input
              type="text"
              value={slide.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              className={inputClass}
              placeholder="Where every gift tells a story"
            />
          </label>
          <label className="block">
            <span className={labelClass}>Description</span>
            <textarea
              value={slide.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              className={`${inputClass} min-h-[60px] resize-none`}
              placeholder="Paper, paint, wood, yarn & more — crafted by sisters in Arifwala"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>CTA Label *</span>
              <input
                type="text"
                value={slide.ctaLabel}
                onChange={(e) => onUpdate({ ctaLabel: e.target.value })}
                className={inputClass}
                placeholder="Shop Collection"
              />
            </label>
            <label className="block">
              <span className={labelClass}>CTA Link *</span>
              <input
                type="text"
                value={slide.ctaLink}
                onChange={(e) => onUpdate({ ctaLink: e.target.value })}
                className={inputClass}
                placeholder="/shop"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
