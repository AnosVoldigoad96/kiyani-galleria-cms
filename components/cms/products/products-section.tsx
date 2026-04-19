"use client";

import { useMemo, useState } from "react";

import type { CmsCategory, CmsProduct, CmsSubcategory } from "@/lib/cms-data";
import { useAuth } from "@/components/providers/auth-provider";
import { toast } from "sonner";

import {
  createProduct,
  deleteProductImage,
  extractFileId,
  deleteProduct,
  updateProduct,
  uploadProductImage,
  uploadProductVideo,
  type ProductPayload,
} from "./products-api";
import { ConfirmDeleteModal } from "./confirm-delete-modal";
import { ProductFormModal } from "./product-form-modal";
import { ProductList } from "./product-list";
import type { ProductFormState } from "./types";
import type { SeoFormFields } from "./types";
import { generateSku, parseFeatures, slugify } from "./utils";

function seoPayloadFromForm(state: SeoFormFields) {
  const priority =
    state.sitemapPriority === "" || state.sitemapPriority == null
      ? null
      : Math.min(1, Math.max(0, Number(state.sitemapPriority)));

  let structuredOverrides: unknown = null;
  const raw = state.structuredDataOverrides?.trim();
  if (raw) {
    try {
      structuredOverrides = JSON.parse(raw);
    } catch {
      structuredOverrides = null;
    }
  }

  return {
    meta_title: state.metaTitle?.trim() || null,
    meta_description: state.metaDescription?.trim() || null,
    keywords: state.keywords?.trim() || null,
    og_title: state.ogTitle?.trim() || null,
    og_description: state.ogDescription?.trim() || null,
    canonical_url: state.canonicalUrl?.trim() || null,
    og_image_url: state.ogImageUrl?.trim() || null,
    robots_noindex: Boolean(state.robotsNoindex),
    sitemap_priority: priority,
    sitemap_changefreq: state.sitemapChangefreq || null,
    structured_data_overrides: structuredOverrides,
  };
}

type ProductsSectionProps = {
  categories: CmsCategory[];
  subcategories: CmsSubcategory[];
  products: CmsProduct[];
  onRefresh?: () => void;
};

export function ProductsSection({
  categories,
  subcategories,
  products,
  onRefresh,
}: ProductsSectionProps) {
  const { user } = useAuth();
  const [productEditor, setProductEditor] = useState<CmsProduct | null>(null);
  const [productMode, setProductMode] = useState<"create" | "edit" | "clone">("create");
  const [deleteTarget, setDeleteTarget] = useState<CmsProduct | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);

  const defaultCategoryId = useMemo(() => categories[0]?.id ?? "", [categories]);

  const resetError = () => setError(null);

  const openProductModal = (mode: "create" | "edit" | "clone", product?: CmsProduct) => {
    resetError();
    setProductMode(mode);
    if (mode === "clone" && product) {
      setProductEditor({
        ...product,
        id: `${product.id}-COPY`,
        name: `${product.name} Copy`,
      });
    } else {
      setProductEditor(product ?? null);
    }
    setProductModalOpen(true);
  };

  const handleSaveProduct = async (state: ProductFormState, imageFile: File | null, videoFile: File | null) => {
    if (!state.name.trim()) {
      setError("Product name is required.");
      return;
    }
    if (!state.categoryId) {
      setError("Category is required.");
      return;
    }
    if (!state.description.trim()) {
      setError("Product description is required.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      let imageUrl = state.imageUrl ? state.imageUrl.trim() : null;

      if (imageFile) {
        if (productEditor?.imageUrl) {
          const oldFileId = extractFileId(productEditor.imageUrl);
          if (oldFileId) {
            await deleteProductImage(oldFileId).catch(() => {});
          }
        }
        const upload = await uploadProductImage(imageFile);
        imageUrl = upload.url;
      }

      let videoUrl = state.videoUrl ? state.videoUrl.trim() : null;

      if (videoFile) {
        // Delete old video if replacing
        if (productEditor?.videoUrl) {
          const oldVideoFileId = extractFileId(productEditor.videoUrl);
          if (oldVideoFileId) {
            await deleteProductImage(oldVideoFileId).catch(() => {});
          }
        }
        const videoUpload = await uploadProductVideo(videoFile);
        videoUrl = videoUpload.url;
      } else if (!state.videoUrl) {
        // User removed the video
        videoUrl = null;
      }

      const payload: ProductPayload = {
        sku: state.sku.trim() || generateSku(products),
        name: state.name.trim(),
        slug: (state.slug || slugify(state.name)).trim(),
        description: state.description.trim(),
        category_id: state.categoryId,
        subcategory_id: state.subcategoryId || null,
        image_url: imageUrl,
        image_alt: state.imageAlt ? state.imageAlt.trim() : null,
        video_url: videoUrl,
        price_pkr: Number(state.pricePkr || 0),
        our_price_pkr: Number(state.ourPricePkr || 0),
        rating: Number(state.rating || 0),
        stock_quantity: Number(state.stockQuantity || 0),
        stock_label: state.stockLabel ? state.stockLabel.trim() : null,
        discount_enabled: state.discountEnabled,
        discount_percentage: state.discountEnabled ? Number(state.discountPercent || 0) : 0,
        is_trending: state.isTrending,
        is_best_seller: state.isBestSeller,
        is_new_arrival: state.isNewArrival,
        is_top_rated: state.isTopRated,
        is_deal_of_the_day: state.isDealOfDay,
        status: state.status,
        created_by: user?.id ?? null,
        updated_by: user?.id ?? null,
        ...seoPayloadFromForm(state),
      };

      const features = parseFeatures(state.featuresText);

      if (productMode === "edit" && productEditor) {
        const { created_by: _createdBy, ...updatePayload } = payload;
        await updateProduct(productEditor.productId, updatePayload, features);
        toast.success("Product updated.");
      } else {
        await createProduct(payload, features);
        toast.success("Product created.");
      }
      setProductModalOpen(false);
      setProductEditor(null);
      onRefresh?.();
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Failed to save product.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsSaving(true);
    setError(null);
    try {
      await deleteProduct(deleteTarget.productId);
      toast.success("Product deleted.");
      setDeleteTarget(null);
      onRefresh?.();
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Failed to delete product.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <ProductList
        products={products}
        onCreate={() => openProductModal("create")}
        onEdit={(product) => openProductModal("edit", product)}
        onClone={(product) => openProductModal("clone", product)}
        onDelete={(product) => {
          resetError();
          setDeleteTarget(product);
        }}
        onView={(product) => {
          if (product.imageUrl) {
            window.open(product.imageUrl, "_blank", "noopener,noreferrer");
          }
        }}
      />

      <ProductFormModal
        open={productModalOpen}
        product={productEditor}
        mode={productMode}
        categories={categories}
        subcategories={subcategories}
        fallbackCategoryId={defaultCategoryId}
        defaultSku={generateSku(products)}
        siblingMetaTitles={products
          .filter((p) => p.id !== productEditor?.id && p.metaTitle)
          .map((p) => (p.metaTitle ?? "").toLowerCase())}
        onClose={() => {
          setProductModalOpen(false);
          resetError();
        }}
        onSave={handleSaveProduct}
        isSaving={isSaving}
        error={error}
      />
      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title="Delete product"
        description={deleteTarget ? `You're about to delete "${deleteTarget.name}".` : "You're about to delete this product."}
        onClose={() => {
          setDeleteTarget(null);
          resetError();
        }}
        onConfirm={handleDelete}
        isSaving={isSaving}
        error={error}
      />
    </div>
  );
}
