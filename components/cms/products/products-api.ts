"use client";

import { getAccessToken, requestAdminGraphql } from "@/lib/admin-graphql-client";

import type { RecordStatus, SubcategoryStatus } from "./types";

export type SeoPayload = {
  meta_title: string | null;
  meta_description: string | null;
  keywords: string | null;
  og_title: string | null;
  og_description: string | null;
};

export type CategoryPayload = {
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_visible: boolean;
} & SeoPayload;

export type SubcategoryPayload = {
  name: string;
  slug: string;
  description: string | null;
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
  const response = await requestAdminGraphql<{ insert_products_one: { id: string } | null }>(
    `
      mutation CreateProduct($object: products_insert_input!) {
        insert_products_one(object: $object) {
          id
        }
      }
    `,
    { object: payload },
  );

  const data = unwrap(response, "Product was not created.");
  const productId = data.insert_products_one?.id;

  if (!productId) {
    throw new Error("Product ID was not returned.");
  }

  await replaceProductFeatures(productId, features);
  return productId;
}

export async function updateProduct(
  id: string,
  payload: Partial<ProductPayload>,
  features: string[],
) {
  const response = await requestAdminGraphql<{ update_products_by_pk: { id: string } | null }>(
    `
      mutation UpdateProduct($id: uuid!, $set: products_set_input!) {
        update_products_by_pk(pk_columns: { id: $id }, _set: $set) {
          id
        }
      }
    `,
    { id, set: payload },
  );

  unwrap(response, "Product was not updated.");
  await replaceProductFeatures(id, features);
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

async function replaceProductFeatures(productId: string, features: string[]) {
  const deleteResponse = await requestAdminGraphql<{
    delete_product_features: { affected_rows: number };
  }>(
    `
      mutation ClearProductFeatures($productId: uuid!) {
        delete_product_features(where: { product_id: { _eq: $productId } }) {
          affected_rows
        }
      }
    `,
    { productId },
  );

  unwrap(deleteResponse, "Product features were not cleared.");

  if (!features.length) {
    return;
  }

  const insertResponse = await requestAdminGraphql<{
    insert_product_features: { affected_rows: number };
  }>(
    `
      mutation InsertProductFeatures($objects: [product_features_insert_input!]!) {
        insert_product_features(objects: $objects) {
          affected_rows
        }
      }
    `,
    {
      objects: features.map((feature, index) => ({
        product_id: productId,
        feature,
        sort_order: index,
      })),
    },
  );

  unwrap(insertResponse, "Product features were not saved.");
}

export async function uploadProductImage(file: File) {
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
  type: "product" | "category" | "subcategory";
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
