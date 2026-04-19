"use client";

import { useMemo, useState } from "react";

import type { CmsCategory, CmsSubcategory } from "@/lib/cms-data";
import { toast } from "sonner";

import {
  createCategory,
  createSubcategory,
  deleteCategory,
  deleteSubcategory,
  updateCategory,
  updateSubcategory,
  type CategoryPayload,
  type SubcategoryPayload,
} from "@/components/cms/products/products-api";
import { CategoryFormModal } from "@/components/cms/products/category-form-modal";
import { CategorySubcategoryTable } from "@/components/cms/products/category-subcategory-table";
import { ConfirmDeleteModal } from "@/components/cms/products/confirm-delete-modal";
import { SubcategoryFormModal } from "@/components/cms/products/subcategory-form-modal";
import type { CategoryFormState, SubcategoryFormState, SeoFormFields } from "@/components/cms/products/types";
import { nextSortOrder, slugify } from "@/components/cms/products/utils";

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

type CategoriesSectionProps = {
  categories: CmsCategory[];
  subcategories: CmsSubcategory[];
  onRefresh?: () => void;
};

type DeleteTarget =
  | { type: "category"; item: CmsCategory }
  | { type: "subcategory"; item: CmsSubcategory };

export function CategoriesSection({
  categories,
  subcategories,
  onRefresh,
}: CategoriesSectionProps) {
  const [categoryEditor, setCategoryEditor] = useState<CmsCategory | null>(null);
  const [subcategoryEditor, setSubcategoryEditor] = useState<CmsSubcategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [subcategoryModalOpen, setSubcategoryModalOpen] = useState(false);
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

  const handleSaveCategory = async (state: CategoryFormState) => {
    if (!state.name.trim()) {
      setError("Category name is required.");
      return;
    }

    const payload: CategoryPayload = {
      name: state.name.trim(),
      slug: (state.slug || slugify(state.name)).trim(),
      description: state.description ? state.description.trim() : null,
      sort_order:
        Number(state.sortOrder || 0) ||
        (categoryEditor ? 0 : Number(nextSortOrder(categories))),
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
      sort_order:
        Number(state.sortOrder || 0) ||
        (subcategoryEditor ? 0 : Number(nextSortOrder(subcategories))),
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

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsSaving(true);
    setError(null);
    try {
      if (deleteTarget.type === "category") {
        await deleteCategory(deleteTarget.item.id);
        toast.success("Category deleted.");
      } else {
        await deleteSubcategory(deleteTarget.item.id);
        toast.success("Subcategory deleted.");
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
    ? `Delete ${deleteTarget.type}`
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

      <CategoryFormModal
        open={categoryModalOpen}
        category={categoryEditor}
        siblingMetaTitles={categories
          .filter((c) => c.id !== categoryEditor?.id && c.metaTitle)
          .map((c) => (c.metaTitle ?? "").toLowerCase())}
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
        siblingMetaTitles={subcategories
          .filter((s) => s.id !== subcategoryEditor?.id && s.metaTitle)
          .map((s) => (s.metaTitle ?? "").toLowerCase())}
        onClose={() => {
          setSubcategoryModalOpen(false);
          setSubcategoryFallbackCategoryId(undefined);
          resetError();
        }}
        onSave={handleSaveSubcategory}
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
