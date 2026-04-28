"use client";

import { useMemo, useState } from "react";

import { motion } from "framer-motion";
import { Save } from "lucide-react";
import { toast } from "sonner";

import type {
  CmsBrandFlag,
  CmsBrandToken,
  CmsHeroSlide,
  CmsPromiseImage,
  CmsStoryImage,
} from "@/lib/cms-data";

import { upsertBrandSettingsBatch } from "@/components/cms/brand/brand-api";
import { HeroSlidesEditor } from "@/components/cms/brand/hero-slides-editor";
import { PromiseCollageEditor } from "@/components/cms/brand/promise-collage-editor";
import { StoryImagesEditor } from "@/components/cms/brand/story-images-editor";
import { surfaceClassName } from "@/components/cms/cms-shared";
import { Button } from "@/components/ui/button";

type BrandSectionProps = {
  brandFlags: CmsBrandFlag[];
  brandTokens: CmsBrandToken[];
  heroSlides: CmsHeroSlide[];
  promiseImages: CmsPromiseImage[];
  storyImages: CmsStoryImage[];
  onRefresh?: () => void;
};

const inputClassName =
  "w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200";

function isHexColor(value: string) {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

export function BrandSection({ brandFlags, brandTokens, heroSlides, promiseImages, storyImages, onRefresh }: BrandSectionProps) {
  const [tokenValues, setTokenValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(brandTokens.map((token) => [token.key, token.value])),
  );
  const [flagTexts, setFlagTexts] = useState<Record<string, string>>(() =>
    Object.fromEntries(brandFlags.map((flag) => [flag.key, flag.text || flag.description])),
  );
  const [flagEnabled, setFlagEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(brandFlags.map((flag) => [flag.key, flag.enabled])),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasColorError = useMemo(
    () =>
      brandTokens.some((token) => {
        const value = tokenValues[token.key] ?? "";
        return !isHexColor(value);
      }),
    [brandTokens, tokenValues],
  );

  const saveBrandSettings = async () => {
    if (hasColorError) {
      setError("Every token must be a valid HEX color (e.g. #FF6F7D).");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const payload = [
        ...brandTokens.map((token) => ({
          key: token.key,
          value: {
            text: tokenValues[token.key]?.trim() || token.value,
          },
        })),
        ...brandFlags.map((flag) => ({
          key: flag.key,
          value: {
            text: flagTexts[flag.key]?.trim() || "",
            enabled: Boolean(flagEnabled[flag.key]),
          },
        })),
      ];

      await upsertBrandSettingsBatch(payload);
      toast.success("Brand settings saved.");
      onRefresh?.();
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Failed to save brand settings.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <HeroSlidesEditor initialSlides={heroSlides} onRefresh={onRefresh} />
      <PromiseCollageEditor initialImages={promiseImages} onRefresh={onRefresh} />
      <StoryImagesEditor initialImages={storyImages} onRefresh={onRefresh} />

      <section className={surfaceClassName("p-5 sm:p-8")}>
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--muted-foreground)]">
              Brand System
            </p>
            <h2 className="mt-2 text-3xl font-bold text-[var(--foreground)]">Visual identity & storefront messaging</h2>
          </div>
          <Button
            type="button"
            onClick={saveBrandSettings}
            disabled={isSaving}
            className="rounded-lg bg-foreground px-5 text-xs font-bold text-white hover:bg-foreground/90"
          >
            <Save className="mr-2 size-4" />
            {isSaving ? "Saving..." : "Save brand"}
          </Button>
        </div>
        {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className={surfaceClassName("p-8")}
        >
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--muted-foreground)]">
            System tokens
          </p>
          <h2 className="mt-2 text-3xl font-bold text-[var(--foreground)]">Visual identity</h2>
          <div className="mt-8 space-y-4">
            {brandTokens.map((token, index) => {
              const value = tokenValues[token.key] ?? token.value;
              const invalid = !isHexColor(value);
              return (
                <motion.div
                  key={token.key}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="rounded-2xl border border-white/50 bg-white/40 p-5 shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <span
                      className="size-12 rounded-2xl border-2 border-white shadow-inner"
                      style={{ backgroundColor: invalid ? "#ffffff" : value }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold tracking-tight text-[var(--foreground)]">{token.label}</p>
                      <p className="mt-0.5 text-xs font-medium text-[var(--muted-foreground)]">{token.usage}</p>
                      <input
                        value={value}
                        onChange={(event) =>
                          setTokenValues((current) => ({ ...current, [token.key]: event.target.value }))
                        }
                        className={`${inputClassName} mt-3 ${invalid ? "border-rose-300 ring-rose-100" : ""}`}
                      />
                      {invalid ? (
                        <p className="mt-1 text-xs text-rose-600">Use valid hex format like #FF6F7D.</p>
                      ) : null}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className={surfaceClassName("p-8")}
        >
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--muted-foreground)]">
            Global switches
          </p>
          <h2 className="mt-2 text-3xl font-bold text-[var(--foreground)]">Live storefront</h2>
          <div className="mt-8 space-y-4">
            {brandFlags.map((flag, index) => (
              <motion.div
                key={flag.key}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className="rounded-2xl border border-white/50 bg-white/40 p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-6">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold tracking-tight text-[var(--foreground)]">{flag.label}</p>
                    <p className="mt-1 text-sm font-medium leading-relaxed text-[var(--muted-foreground)]">
                      Editable storefront copy
                    </p>
                    <input
                      value={flagTexts[flag.key] ?? flag.text}
                      onChange={(event) =>
                        setFlagTexts((current) => ({ ...current, [flag.key]: event.target.value }))
                      }
                      className={`${inputClassName} mt-3`}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={Boolean(flagEnabled[flag.key])}
                      onChange={(event) =>
                        setFlagEnabled((current) => ({ ...current, [flag.key]: event.target.checked }))
                      }
                      className="size-4 rounded border-slate-300 text-foreground focus:ring-slate-300"
                    />
                    Enabled
                  </label>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>
    </div>
  );
}
