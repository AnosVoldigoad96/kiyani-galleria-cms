"use client";

import type { CmsCategory, CmsProduct, CmsSubcategory } from "@/lib/cms-data";

import type {
  CategoryFormState,
  ProductFormState,
  RecordStatus,
  SubcategoryFormState,
  SubcategoryStatus,
} from "./types";

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

export function categoryToFormState(category?: CmsCategory | null): CategoryFormState {
  return {
    name: category?.name ?? "",
    slug: category?.slug ?? "",
    description: category?.description ?? "",
    sortOrder: String(category?.sortOrder ?? 0),
    isVisible: category?.isVisible ?? true,
  };
}

export function subcategoryToFormState(
  subcategory: CmsSubcategory | null | undefined,
  fallbackCategoryId?: string,
): SubcategoryFormState {
  return {
    name: subcategory?.name ?? "",
    slug: subcategory?.slug ?? "",
    description: subcategory?.description ?? "",
    sortOrder: String(subcategory?.sortOrder ?? 0),
    status: toSubcategoryStatus(subcategory?.status),
    categoryId: subcategory?.categoryId ?? fallbackCategoryId ?? "",
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
    stockQuantity: product ? product.stock.replace(/[^0-9]/g, "") : "",
    stockLabel: product?.stock ?? "",
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
    featuresText: featuresToText(product?.features),
  };
}
