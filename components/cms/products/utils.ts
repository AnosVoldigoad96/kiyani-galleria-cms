"use client";

import type { CmsCategory, CmsProduct, CmsSubcategory } from "@/lib/cms-data";

import type {
  CategoryFormState,
  ProductFormState,
  RecordStatus,
  SubcategoryFormState,
  SubcategoryStatus,
} from "./types";

export function generateSku(existingProducts: Array<{ id: string }>) {
  const nextNum = existingProducts.length + 1;
  return `KG-${String(nextNum).padStart(3, "0")}`;
}

export function nextSortOrder(existingItems: Array<{ sortOrder?: number }>) {
  const max = existingItems.reduce((m, item) => Math.max(m, item.sortOrder ?? 0), 0);
  return String(max + 1);
}

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function featuresToText(features: string[] | undefined) {
  return (features ?? []).join("\n");
}

export function parseFeatures(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function toRecordStatus(value: CmsProduct["status"] | undefined): RecordStatus {
  if (value === "Live") {
    return "live";
  }

  if (value === "Archived") {
    return "archived";
  }

  return "draft";
}

export function fromRecordStatus(value: RecordStatus) {
  if (value === "live") {
    return "Live";
  }

  if (value === "archived") {
    return "Archived";
  }

  return "Draft";
}

export function toSubcategoryStatus(value: CmsSubcategory["status"] | undefined): SubcategoryStatus {
  if (value === "Live") {
    return "live";
  }

  return "draft";
}

export function fromSubcategoryStatus(value: SubcategoryStatus) {
  return value === "live" ? "Live" : "Draft";
}

function seoFieldsFrom(
  entity:
    | {
        canonicalUrl?: string | null;
        ogImageUrl?: string | null;
        robotsNoindex?: boolean;
        sitemapPriority?: number | null;
        sitemapChangefreq?: string | null;
        structuredDataOverrides?: unknown;
      }
    | null
    | undefined,
) {
  return {
    canonicalUrl: entity?.canonicalUrl ?? "",
    ogImageUrl: entity?.ogImageUrl ?? "",
    robotsNoindex: entity?.robotsNoindex ?? false,
    sitemapPriority:
      entity?.sitemapPriority === null || entity?.sitemapPriority === undefined
        ? ""
        : String(entity.sitemapPriority),
    sitemapChangefreq: entity?.sitemapChangefreq ?? "",
    structuredDataOverrides:
      entity?.structuredDataOverrides == null
        ? ""
        : JSON.stringify(entity.structuredDataOverrides, null, 2),
  };
}

export function categoryToFormState(category?: CmsCategory | null): CategoryFormState {
  return {
    name: category?.name ?? "",
    slug: category?.slug ?? "",
    sortOrder: String(category?.sortOrder ?? 0),
    isVisible: category?.isVisible ?? true,
    metaTitle: category?.metaTitle ?? "",
    metaDescription: category?.metaDescription ?? "",
    keywords: category?.keywords ?? "",
    ogTitle: category?.ogTitle ?? "",
    ogDescription: category?.ogDescription ?? "",
    ...seoFieldsFrom(category),
  };
}

export function subcategoryToFormState(
  subcategory: CmsSubcategory | null | undefined,
  fallbackCategoryId?: string,
): SubcategoryFormState {
  return {
    name: subcategory?.name ?? "",
    slug: subcategory?.slug ?? "",
    sortOrder: String(subcategory?.sortOrder ?? 0),
    status: toSubcategoryStatus(subcategory?.status),
    categoryId: subcategory?.categoryId ?? fallbackCategoryId ?? "",
    metaTitle: subcategory?.metaTitle ?? "",
    metaDescription: subcategory?.metaDescription ?? "",
    keywords: subcategory?.keywords ?? "",
    ogTitle: subcategory?.ogTitle ?? "",
    ogDescription: subcategory?.ogDescription ?? "",
    ...seoFieldsFrom(subcategory),
  };
}

export function productToFormState(
  product: CmsProduct | null | undefined,
  fallbackCategoryId?: string,
): ProductFormState {
  return {
    sku: product?.id ?? "",
    name: product?.name ?? "",
    slug: product?.name ? slugify(product.name) : "",
    description: product?.description ?? "",
    pricePkr: product ? product.pricePkr.replace(/[^0-9.]/g, "") : "",
    ourPricePkr: product ? product.ourPricePkr.replace(/[^0-9.]/g, "") : "",
    rating: product ? String(product.rating ?? 0) : "",
    stockQuantity: product ? String(product.stockQuantity ?? 0) : "",
    stockLabel: product?.stockLabel ?? "",
    categoryId: product?.categoryId ?? fallbackCategoryId ?? "",
    subcategoryId: product?.subcategoryId ?? "",
    status: toRecordStatus(product?.status),
    discountEnabled: product?.discountEnabled ?? false,
    discountPercent: product ? String(product.discountPercent ?? 0) : "",
    isTrending: product?.tags.trending ?? false,
    isBestSeller: product?.tags.bestSeller ?? false,
    isNewArrival: product?.tags.newArrival ?? false,
    isTopRated: product?.tags.topRated ?? false,
    isDealOfDay: product?.tags.dealOfDay ?? false,
    imageUrl: product?.imageUrl ?? "",
    imageAlt: product?.imageAlt ?? product?.imageLabel ?? "",
    videoUrl: product?.videoUrl ?? "",
    featuresText: featuresToText(product?.features),
    hasSizes: product?.hasSizes ?? false,
    sizes: (product?.sizes ?? []).map((s) => ({ size: s.size, price: String(s.price) })),
    hasQualityOptions: product?.hasQualityOptions ?? false,
    localPricePkr: product?.localPricePkr != null ? String(product.localPricePkr) : "",
    importedPricePkr: product?.importedPricePkr != null ? String(product.importedPricePkr) : "",
    metaTitle: product?.metaTitle ?? "",
    metaDescription: product?.metaDescription ?? "",
    keywords: product?.keywords ?? "",
    ogTitle: product?.ogTitle ?? "",
    ogDescription: product?.ogDescription ?? "",
    ...seoFieldsFrom(product),
  };
}
