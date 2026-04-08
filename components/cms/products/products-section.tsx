"use client";

import { useMemo, useState } from "react";

import type { CmsCategory, CmsProduct, CmsSubcategory } from "@/lib/cms-data";
import { useAuth } from "@/components/providers/auth-provider";
import { toast } from "sonner";

import {
  createCategory,
  createProduct,
  createSubcategory,
  deleteProductImage,
  extractFileId,
  deleteCategory,
  deleteProduct,
  deleteSubcategory,
  updateCategory,
  updateProduct,
  updateSubcategory,
  uploadProductImage,
  type CategoryPayload,
  type ProductPayload,
  type SubcategoryPayload,
} from "./products-api";
import { CategoryFormModal } from "./category-form-modal";
import { CategorySubcategoryTable } from "./category-subcategory-table";
import { ConfirmDeleteModal } from "./confirm-delete-modal";
import { ProductFormModal } from "./product-form-modal";
import { ProductList } from "./product-list";
import { SubcategoryFormModal } from "./subcategory-form-modal";
import type { CategoryFormState, ProductFormState, SubcategoryFormState } from "./types";
import type { SeoFormFields } from "./types";
import { generateSku, nextSortOrder, parseFeatures, slugify } from "./utils";

function seoPayloadFromForm(state: SeoFormFields) {
  return {
    meta_title: state.metaTitle?.trim() || null,
    meta_description: state.metaDescription?.trim() || null,
    keywords: state.keywords?.trim() || null,
    og_title: state.ogTitle?.trim() || null,
    og_description: state.ogDescription?.trim() || null,
  };
}

type ProductsSectionProps = {
  categories: CmsCategory[];
  subcategories: CmsSubcategory[];
  products: CmsProduct[];
  onRefresh?: () => void;
};

type DeleteTarget =
  | { type: "category"; item: CmsCategory }
  | { type: "subcategory"; item: CmsSubcategory }
  | { type: "product"; item: CmsProduct };

export function ProductsSection({
  categories,
  subcategories,
  products,
  onRefresh,
}: ProductsSectionProps) {
  const { user } = useAuth();
  const [categoryEditor, setCategoryEditor] = useState<CmsCategory | null>(null);
  const [subcategoryEditor, setSubcategoryEditor] = useState<CmsSubcategory | null>(null);
  const [productEditor, setProductEditor] = useState<CmsProduct | null>(null);
  const [productMode, setProductMode] = useState<"create" | "edit" | "clone">("create");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [subcategoryModalOpen, setSubcategoryModalOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [subcategoryFallbackCategoryId, setSubcategoryFallbackCategoryId] = useState<
    string | undefined
  >(undefined);

  const defaultCategoryId = useMemo(() => categories[0]?.id ?? "", [categories]);

  const resetError = () => setError(null);

  const openCategoryModal = (category?: CmsCategory) => {
    resetError();
    setCategoryEditor(category ?? null);
    setCategoryModalOpen(true);
  };

  const openSubcategoryModal = (subcategory?: CmsSubcategory, fallbackCategoryId?: string) => {
    resetError();
    setSubcategoryFallbackCategoryId(fallbackCategoryId);
    setSubcategoryEditor(subcategory ?? null);
    setSubcategoryModalOpen(true);
  };

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

  const handleSaveCategory = async (state: CategoryFormState) => {
    if (!state.name.trim()) {
      setError("Category name is required.");
      return;
    }

    const payload: CategoryPayload = {
      name: state.name.trim(),
      slug: (state.slug || slugify(state.name)).trim(),
      description: state.description ? state.description.trim() : null,
      sort_order: Number(state.sortOrder || 0) || (categoryEditor ? 0 : Number(nextSortOrder(categories))),
      is_visible: state.isVisible,
      ...seoPayloadFromForm(state),
    };

    setIsSaving(true);
    setError(null);
    try {
      if (categoryEditor) {
        await updateCategory(categoryEditor.id, payload);
        toast.success("Category updated.");
      } else {
        await createCategory(payload);
        toast.success("Category created.");
      }
      setCategoryModalOpen(false);
      setCategoryEditor(null);
      onRefresh?.();
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Failed to save category.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSubcategory = async (state: SubcategoryFormState) => {
    if (!state.name.trim()) {
      setError("Subcategory name is required.");
      return;
    }
    if (!state.categoryId) {
      setError("Select a category for this subcategory.");
      return;
    }

    const payload: SubcategoryPayload = {
      name: state.name.trim(),
      slug: (state.slug || slugify(state.name)).trim(),
      description: state.description ? state.description.trim() : null,
      sort_order: Number(state.sortOrder || 0) || (subcategoryEditor ? 0 : Number(nextSortOrder(subcategories))),
      status: state.status,
      category_id: state.categoryId,
      ...seoPayloadFromForm(state),
    };

    setIsSaving(true);
    setError(null);
    try {
      if (subcategoryEditor) {
        await updateSubcategory(subcategoryEditor.id, payload);
        toast.success("Subcategory updated.");
      } else {
        await createSubcategory(payload);
        toast.success("Subcategory created.");
      }
      setSubcategoryModalOpen(false);
      setSubcategoryEditor(null);
      onRefresh?.();
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Failed to save subcategory.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProduct = async (state: ProductFormState, imageFile: File | null) => {
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
        // Delete old image if replacing
        if (productEditor?.imageUrl) {
          const oldFileId = extractFileId(productEditor.imageUrl);
          if (oldFileId) {
            await deleteProductImage(oldFileId).catch(() => {});
          }
        }
        const upload = await uploadProductImage(imageFile);
        imageUrl = upload.url;
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
    if (!deleteTarget) {
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      if (deleteTarget.type === "category") {
        await deleteCategory(deleteTarget.item.id);
        toast.success("Category deleted.");
      } else if (deleteTarget.type === "subcategory") {
        await deleteSubcategory(deleteTarget.item.id);
        toast.success("Subcategory deleted.");
      } else {
        await deleteProduct(deleteTarget.item.productId);
        toast.success("Product deleted.");
      }
      setDeleteTarget(null);
      onRefresh?.();
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Failed to delete record.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTitle = deleteTarget
    ? `Delete ${deleteTarget.type === "product" ? "product" : deleteTarget.type}`
    : "Delete item";
  const deleteDescription = deleteTarget
    ? `You're about to delete "${deleteTarget.item.name}".`
    : "You're about to delete this item.";

  return (
    <div className="space-y-6">
      <CategorySubcategoryTable
        categories={categories}
        subcategories={subcategories}
        onCreateCategory={() => openCategoryModal()}
        onEditCategory={(category) => openCategoryModal(category)}
        onDeleteCategory={(category) => {
          resetError();
          setDeleteTarget({ type: "category", item: category });
        }}
        onCreateSubcategory={(categoryId) => openSubcategoryModal(undefined, categoryId)}
        onEditSubcategory={(subcategory) => openSubcategoryModal(subcategory)}
        onDeleteSubcategory={(subcategory) => {
          resetError();
          setDeleteTarget({ type: "subcategory", item: subcategory });
        }}
      />

      <ProductList
        products={products}
        onCreate={() => openProductModal("create")}
        onEdit={(product) => openProductModal("edit", product)}
        onClone={(product) => openProductModal("clone", product)}
        onDelete={(product) => {
          resetError();
          setDeleteTarget({ type: "product", item: product });
        }}
        onView={(product) => {
          if (product.imageUrl) {
            window.open(product.imageUrl, "_blank", "noopener,noreferrer");
          }
        }}
      />

      <CategoryFormModal
        open={categoryModalOpen}
        category={categoryEditor}
        onClose={() => {
          setCategoryModalOpen(false);
          resetError();
        }}
        onSave={handleSaveCategory}
        isSaving={isSaving}
        error={error}
      />
      <SubcategoryFormModal
        open={subcategoryModalOpen}
        categories={categories}
        subcategory={subcategoryEditor}
        fallbackCategoryId={subcategoryFallbackCategoryId ?? defaultCategoryId}
        onClose={() => {
          setSubcategoryModalOpen(false);
          setSubcategoryFallbackCategoryId(undefined);
          resetError();
        }}
        onSave={handleSaveSubcategory}
        isSaving={isSaving}
        error={error}
      />
      <ProductFormModal
        open={productModalOpen}
        product={productEditor}
        mode={productMode}
        categories={categories}
        subcategories={subcategories}
        fallbackCategoryId={defaultCategoryId}
        defaultSku={generateSku(products)}
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
        title={deleteTitle}
        description={deleteDescription}
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
