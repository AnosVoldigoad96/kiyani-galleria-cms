"use client";

import { getAccessToken, requestAdminGraphql } from "@/lib/admin-graphql-client";

import type { RecordStatus, SubcategoryStatus } from "./types";

export type SeoPayload = {
  meta_title: string | null;
  meta_description: string | null;
  keywords: string | null;
  og_title: string | null;
  og_description: string | null;
  canonical_url: string | null;
  og_image_url: string | null;
  robots_noindex: boolean;
  sitemap_priority: number | null;
  sitemap_changefreq: string | null;
  structured_data_overrides: unknown;
};

export type CategoryPayload = {
  name: string;
  slug: string;
  sort_order: number;
  is_visible: boolean;
} & SeoPayload;

export type SubcategoryPayload = {
  name: string;
  slug: string;
  sort_order: number;
  status: SubcategoryStatus;
  category_id: string;
} & SeoPayload;

export type ProductPayload = {
  sku: string;
  name: string;
  slug: string;
  description: string;
  category_id: string;
  subcategory_id: string | null;
  image_url: string | null;
  image_alt: string | null;
  video_url: string | null;
  price_pkr: number;
  our_price_pkr: number;
  rating: number;
  stock_quantity: number;
  stock_label: string | null;
  discount_enabled: boolean;
  discount_percentage: number;
  is_trending: boolean;
  is_best_seller: boolean;
  is_new_arrival: boolean;
  is_top_rated: boolean;
  is_deal_of_the_day: boolean;
  status: RecordStatus;
  has_sizes: boolean;
  sizes: Array<{
    size: string;
    price: number;
    localPrice?: number | null;
    importedPrice?: number | null;
  }>;
  has_quality_options: boolean;
  local_price_pkr: number | null;
  imported_price_pkr: number | null;
  created_by?: string | null;
  updated_by?: string | null;
} & SeoPayload;

function unwrap<T>(
  response: {
    body: {
      data?: T;
      errors?: Array<{ message: string }>;
    };
  },
  message: string,
) {
  if (response.body.errors?.length) {
    throw new Error(response.body.errors.map((item) => item.message).join(", "));
  }

  if (!response.body.data) {
    throw new Error(message);
  }

  return response.body.data;
}

export async function createCategory(payload: CategoryPayload) {
  const response = await requestAdminGraphql<{ insert_categories_one: { id: string } | null }>(
    `
      mutation CreateCategory($object: categories_insert_input!) {
        insert_categories_one(object: $object) {
          id
        }
      }
    `,
    { object: payload },
  );

  unwrap(response, "Category was not created.");
}

export async function updateCategory(id: string, payload: CategoryPayload) {
  const response = await requestAdminGraphql<{ update_categories_by_pk: { id: string } | null }>(
    `
      mutation UpdateCategory($id: uuid!, $set: categories_set_input!) {
        update_categories_by_pk(pk_columns: { id: $id }, _set: $set) {
          id
        }
      }
    `,
    { id, set: payload },
  );

  unwrap(response, "Category was not updated.");
}

export async function deleteCategory(id: string) {
  const response = await requestAdminGraphql<{ delete_categories_by_pk: { id: string } | null }>(
    `
      mutation DeleteCategory($id: uuid!) {
        delete_categories_by_pk(id: $id) {
          id
        }
      }
    `,
    { id },
  );

  unwrap(response, "Category was not deleted.");
}

export async function createSubcategory(payload: SubcategoryPayload) {
  const response = await requestAdminGraphql<{ insert_subcategories_one: { id: string } | null }>(
    `
      mutation CreateSubcategory($object: subcategories_insert_input!) {
        insert_subcategories_one(object: $object) {
          id
        }
      }
    `,
    { object: payload },
  );

  unwrap(response, "Subcategory was not created.");
}

export async function updateSubcategory(id: string, payload: SubcategoryPayload) {
  const response = await requestAdminGraphql<{ update_subcategories_by_pk: { id: string } | null }>(
    `
      mutation UpdateSubcategory($id: uuid!, $set: subcategories_set_input!) {
        update_subcategories_by_pk(pk_columns: { id: $id }, _set: $set) {
          id
        }
      }
    `,
    { id, set: payload },
  );

  unwrap(response, "Subcategory was not updated.");
}

export async function deleteSubcategory(id: string) {
  const response = await requestAdminGraphql<{ delete_subcategories_by_pk: { id: string } | null }>(
    `
      mutation DeleteSubcategory($id: uuid!) {
        delete_subcategories_by_pk(id: $id) {
          id
        }
      }
    `,
    { id },
  );

  unwrap(response, "Subcategory was not deleted.");
}

export async function createProduct(payload: ProductPayload, features: string[]) {
  // Use Hasura nested insert: product + features in a single mutation
  const object: Record<string, unknown> = { ...payload };
  if (features.length) {
    object.product_features = {
      data: features.map((feature, index) => ({
        feature,
        sort_order: index,
      })),
    };
  }

  const response = await requestAdminGraphql<{ insert_products_one: { id: string } | null }>(
    `
      mutation CreateProduct($object: products_insert_input!) {
        insert_products_one(object: $object) {
          id
        }
      }
    `,
    { object },
  );

  const data = unwrap(response, "Product was not created.");
  const productId = data.insert_products_one?.id;

  if (!productId) {
    throw new Error("Product ID was not returned.");
  }

  return productId;
}

export async function updateProduct(
  id: string,
  payload: Partial<ProductPayload>,
  features: string[],
) {
  // Batch update + delete old features + insert new features in one request
  const featureObjects = features.map((feature, index) => ({
    product_id: id,
    feature,
    sort_order: index,
  }));

  if (featureObjects.length) {
    const response = await requestAdminGraphql<{
      update_products_by_pk: { id: string } | null;
      delete_product_features: { affected_rows: number };
      insert_product_features: { affected_rows: number };
    }>(
      `
        mutation UpdateProductWithFeatures(
          $id: uuid!,
          $set: products_set_input!,
          $featureObjects: [product_features_insert_input!]!
        ) {
          update_products_by_pk(pk_columns: { id: $id }, _set: $set) {
            id
          }
          delete_product_features(where: { product_id: { _eq: $id } }) {
            affected_rows
          }
          insert_product_features(objects: $featureObjects) {
            affected_rows
          }
        }
      `,
      { id, set: payload, featureObjects },
    );

    unwrap(response, "Product was not updated.");
  } else {
    // No features — just update product and clear old features
    const response = await requestAdminGraphql<{
      update_products_by_pk: { id: string } | null;
      delete_product_features: { affected_rows: number };
    }>(
      `
        mutation UpdateProductClearFeatures($id: uuid!, $set: products_set_input!) {
          update_products_by_pk(pk_columns: { id: $id }, _set: $set) {
            id
          }
          delete_product_features(where: { product_id: { _eq: $id } }) {
            affected_rows
          }
        }
      `,
      { id, set: payload },
    );

    unwrap(response, "Product was not updated.");
  }
}

export async function deleteProduct(id: string) {
  const response = await requestAdminGraphql<{ delete_products_by_pk: { id: string } | null }>(
    `
      mutation DeleteProduct($id: uuid!) {
        delete_products_by_pk(id: $id) {
          id
        }
      }
    `,
    { id },
  );

  unwrap(response, "Product was not deleted.");
}

/**
 * Convert and downscale an image to WebP using a canvas.
 * Returns the compressed file, or the original if conversion didn't help.
 */
async function convertToWebP(
  file: File,
  options: { maxDimension: number; quality: number; minSizeBytes?: number; minWebPSizeBytes?: number },
): Promise<File> {
  const { maxDimension, quality, minSizeBytes = 100_000, minWebPSizeBytes = 500_000 } = options;

  // Skip non-image or already-small files
  if (!file.type.startsWith("image/") || file.size < minSizeBytes) {
    return file;
  }

  return new Promise<File>((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Only resize if larger than max dimension
      if (width <= maxDimension && height <= maxDimension) {
        // Already small enough — only re-encode if not already WebP
        if (file.type === "image/webp" && file.size < minWebPSizeBytes) {
          resolve(file);
          return;
        }
      }

      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            // Compression didn't help, use original
            resolve(file);
            return;
          }

          const ext = "webp";
          const name = file.name.replace(/\.[^.]+$/, `.${ext}`);
          resolve(new File([blob], name, { type: `image/${ext}` }));
        },
        "image/webp",
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}

// Product images: compact, 1200px max @ 82% quality (existing behavior)
async function compressImage(file: File): Promise<File> {
  return convertToWebP(file, { maxDimension: 1200, quality: 0.82 });
}

// Brand/marketing images: high quality, 2000px max @ 92% quality (preserves detail)
async function compressBrandImage(file: File): Promise<File> {
  return convertToWebP(file, {
    maxDimension: 2000,
    quality: 0.92,
    minWebPSizeBytes: 1_500_000, // skip re-encode if WebP is already <1.5MB
  });
}

export async function uploadProductImage(file: File) {
  const compressed = await compressImage(file);
  const accessToken = await getAccessToken();

  const formData = new FormData();
  formData.append("file", compressed);

  const response = await fetch("/api/upload-image", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.error || "Image upload failed.");
  }

  return {
    fileId: body.fileId as string,
    url: body.url as string,
  };
}

/**
 * Upload a brand/marketing image (hero, promise collage, story page).
 * Uses higher quality (92%) and larger max dimension (2000px) than product
 * images so detail is preserved on large hero displays. Still converts to
 * WebP for bandwidth savings.
 */
export async function uploadBrandImage(file: File) {
  const compressed = await compressBrandImage(file);
  const accessToken = await getAccessToken();

  const formData = new FormData();
  formData.append("file", compressed);

  const response = await fetch("/api/upload-image", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.error || "Image upload failed.");
  }

  return {
    fileId: body.fileId as string,
    url: body.url as string,
  };
}

export async function deleteProductImage(fileId: string) {
  const accessToken = await getAccessToken();

  const response = await fetch("/api/upload-image", {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fileId }),
  });

  if (!response.ok) {
    let message = "Failed to delete image.";
    try {
      const text = await response.text();
      if (text) message = JSON.parse(text).error || message;
    } catch {
      // empty or non-JSON response
    }
    throw new Error(message);
  }
  // Success — don't try to parse body (may be empty)
}

export async function uploadProductVideo(file: File) {
  const accessToken = await getAccessToken();

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/upload-image", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.error || "Video upload failed.");
  }

  return {
    fileId: body.fileId as string,
    url: body.url as string,
  };
}

/** Extract the Nhost file ID from a storage URL */
export function extractFileId(imageUrl: string): string | null {
  const match = imageUrl.match(/\/files\/([a-f0-9-]+)/i);
  return match?.[1] ?? null;
}

export type GenerateSeoInput = {
  type: "product" | "category" | "subcategory";
  name: string;
  description?: string;
  category?: string;
  subcategory?: string;
  price?: number;
  features?: string[];
};

export type GenerateSeoResult = {
  meta_title: string;
  meta_description: string;
  keywords: string;
  og_title: string;
  og_description: string;
};

export async function generateSeo(input: GenerateSeoInput): Promise<GenerateSeoResult> {
  const accessToken = await getAccessToken();

  const response = await fetch("/api/generate-seo", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.error || "Failed to generate SEO content.");
  }

  return body as GenerateSeoResult;
}

export async function generateDescription(input: {
  type: "product";
  name: string;
  category?: string;
}): Promise<string> {
  const accessToken = await getAccessToken();

  const response = await fetch("/api/generate-description", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.error || "Failed to generate description.");
  }

  return body.description;
}
