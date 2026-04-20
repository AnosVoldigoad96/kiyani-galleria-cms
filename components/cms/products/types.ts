export type RecordStatus = "draft" | "live" | "archived";
export type SubcategoryStatus = "draft" | "live";

export type SeoFormFields = {
  metaTitle: string;
  metaDescription: string;
  keywords: string;
  ogTitle: string;
  ogDescription: string;
  canonicalUrl: string;
  ogImageUrl: string;
  robotsNoindex: boolean;
  sitemapPriority: string;
  sitemapChangefreq: string;
  structuredDataOverrides: string;
};

export type CategoryFormState = {
  name: string;
  slug: string;
  sortOrder: string;
  isVisible: boolean;
} & SeoFormFields;

export type SubcategoryFormState = {
  name: string;
  slug: string;
  sortOrder: string;
  status: SubcategoryStatus;
  categoryId: string;
} & SeoFormFields;

export type ProductFormState = {
  sku: string;
  name: string;
  slug: string;
  description: string;
  pricePkr: string;
  ourPricePkr: string;
  rating: string;
  stockQuantity: string;
  stockLabel: string;
  categoryId: string;
  subcategoryId: string;
  status: RecordStatus;
  discountEnabled: boolean;
  discountPercent: string;
  isTrending: boolean;
  isBestSeller: boolean;
  isNewArrival: boolean;
  isTopRated: boolean;
  isDealOfDay: boolean;
  imageUrl: string;
  imageAlt: string;
  videoUrl: string;
  featuresText: string;
} & SeoFormFields;
