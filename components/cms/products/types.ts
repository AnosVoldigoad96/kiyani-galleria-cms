export type RecordStatus = "draft" | "live" | "archived";
export type SubcategoryStatus = "draft" | "live";

export type CategoryFormState = {
  name: string;
  slug: string;
  description: string;
  sortOrder: string;
  isVisible: boolean;
};

export type SubcategoryFormState = {
  name: string;
  slug: string;
  description: string;
  sortOrder: string;
  status: SubcategoryStatus;
  categoryId: string;
};

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
  featuresText: string;
};
