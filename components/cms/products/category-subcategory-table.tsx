"use client";

import { useMemo, useState } from "react";

import { motion } from "framer-motion";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { ActionButton } from "@/components/cms/cms-shared";
import { Button } from "@/components/ui/button";
import type { CmsCategory, CmsSubcategory } from "@/lib/cms-data";

type CategorySubcategoryTableProps = {
  categories: CmsCategory[];
  subcategories: CmsSubcategory[];
  onCreateCategory: () => void;
  onEditCategory: (category: CmsCategory) => void;
  onDeleteCategory: (category: CmsCategory) => void;
  onCreateSubcategory: (categoryId?: string) => void;
  onEditSubcategory: (subcategory: CmsSubcategory) => void;
  onDeleteSubcategory: (subcategory: CmsSubcategory) => void;
};

export function CategorySubcategoryTable({
  categories,
  subcategories,
  onCreateCategory,
  onEditCategory,
  onDeleteCategory,
  onCreateSubcategory,
  onEditSubcategory,
  onDeleteSubcategory,
}: CategorySubcategoryTableProps) {
  const grouped = useMemo(() => {
    return categories.map((category) => ({
      category,
      subcategories: subcategories.filter((sub) => sub.categoryId === category.id),
    }));
  }, [categories, subcategories]);

  const [selectedMap, setSelectedMap] = useState<Record<string, string | null>>(() => {
    const initial: Record<string, string | null> = {};
    grouped.forEach(({ category, subcategories: subs }) => {
      initial[category.id] = subs[0]?.id ?? null;
    });
    return initial;
  });

  const handleSelect = (categoryId: string, subcategoryId: string) => {
    setSelectedMap((current) => ({ ...current, [categoryId]: subcategoryId }));
  };

  const statusPill = (value: string) => {
    if (value.toLowerCase() === "live") {
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
    if (value.toLowerCase() === "draft") {
      return "bg-amber-50 text-amber-700 border-amber-200";
    }
    return "bg-slate-100 text-muted-foreground border-border";
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Categories
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">Category structure</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage category visibility and drill into subcategories.
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onCreateSubcategory()}
            className="rounded-lg border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted"
          >
            <Plus className="mr-2 size-4" />
            Add subcategory
          </Button>
          <Button
            type="button"
            onClick={onCreateCategory}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            <Plus className="mr-2 size-4" />
            Add category
          </Button>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="w-full">
          <table className="w-full text-sm block sm:table">
            <thead className="hidden sm:table-header-group bg-muted/30">
              <tr className="border-b border-border">
                <th className="p-3 sm:px-4 sm:py-3 text-left text-xs font-semibold text-muted-foreground">Category</th>
                <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Items</th>
                <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                <th className="p-3 sm:px-4 sm:py-3 text-left text-xs font-semibold text-muted-foreground">Subcategories</th>
                <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Sub Actions</th>
                <th className="p-3 sm:px-4 sm:py-3 text-right text-xs font-semibold text-muted-foreground">
                  Category Actions
                </th>
              </tr>
            </thead>
            <tbody className="block sm:table-row-group">
              {grouped.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No categories yet. Create your first category to get started.
                  </td>
                </tr>
              ) : (
                grouped.map(({ category, subcategories: subs }, index) => {
                  const selectedId = selectedMap[category.id] ?? subs[0]?.id ?? null;
                  const selectedSub = subs.find((sub) => sub.id === selectedId) ?? null;
                  return (
                    <tr
                      key={category.id}
                      className="flex flex-col sm:table-row border-b border-border transition-colors hover:bg-muted/30 p-4 sm:p-0"
                    >
                      <td className="block sm:table-cell sm:p-4 align-top border-b border-border sm:border-none pb-4 mb-4 sm:pb-4 sm:mb-0">
                        <p className="font-semibold text-foreground">{category.name}</p>
                        {category.description ? (
                          <p className="mt-1 text-xs text-muted-foreground">{category.description}</p>
                        ) : null}
                        <div className="mt-2 flex items-center gap-2 sm:hidden">
                          <span className="text-xs font-bold text-muted-foreground">{category.itemCount} items</span>
                          <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-xs font-semibold ${statusPill(category.visibility)}`}>
                            {category.visibility}
                          </span>
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-4 align-top">
                        <span className="text-sm font-semibold text-foreground">
                          {category.itemCount}
                        </span>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-4 align-top">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusPill(category.visibility)}`}
                        >
                          {category.visibility}
                        </span>
                      </td>
                      <td className="block sm:table-cell sm:p-4 align-top border-b border-border sm:border-none pb-4 mb-4 sm:pb-4 sm:mb-0">
                        <span className="sm:hidden block mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Subcategories</span>
                        <select
                          value={selectedId ?? ""}
                          onChange={(event) => handleSelect(category.id, event.target.value)}
                          className="w-full rounded-md border border-border bg-white px-3 py-2 text-xs font-semibold text-foreground max-w-[150px] sm:max-w-none"
                          disabled={subs.length === 0}
                        >
                          {subs.length === 0 ? (
                            <option value="">No subcategories</option>
                          ) : null}
                          {subs.map((subcategory) => (
                            <option key={subcategory.id} value={subcategory.id}>
                              {subcategory.name}
                            </option>
                          ))}
                        </select>
                        {selectedSub ? (
                          <div className="mt-2">
                            <p className="text-xs text-muted-foreground">
                              {selectedSub.status} · {selectedSub.itemCount} items
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1.5 lg:hidden">
                              <ActionButton
                                className="h-7 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted"
                                onClick={() => onEditSubcategory(selectedSub)}
                              >
                                <Pencil className="size-3" />
                                Edit
                              </ActionButton>
                              <ActionButton
                                tone="danger"
                                className="h-7 rounded-md px-2 text-xs"
                                onClick={() => onDeleteSubcategory(selectedSub)}
                              >
                                <Trash2 className="size-3" />
                                Remove
                              </ActionButton>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2 flex lg:hidden">
                            <ActionButton
                              className="h-7 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted"
                              onClick={() => onCreateSubcategory(category.id)}
                            >
                              <Plus className="size-3" />
                              Add
                            </ActionButton>
                          </div>
                        )}
                      </td>
                      <td className="hidden lg:table-cell px-4 py-4 align-top">
                        <div className="flex flex-wrap gap-2">
                          <ActionButton
                            className="h-8 rounded-md px-2 text-muted-foreground hover:bg-muted"
                            onClick={() =>
                              selectedSub
                                ? onEditSubcategory(selectedSub)
                                : onCreateSubcategory(category.id)
                            }
                          >
                            <Pencil className="size-3" />
                            {selectedSub ? "Edit" : "Add"}
                          </ActionButton>
                          <ActionButton
                            tone="danger"
                            className="h-8 rounded-md px-2"
                            onClick={() => selectedSub && onDeleteSubcategory(selectedSub)}
                            disabled={!selectedSub}
                          >
                            <Trash2 className="size-3" />
                            Remove
                          </ActionButton>
                        </div>
                      </td>
                      <td className="flex items-center justify-between sm:table-cell sm:p-4 align-top sm:text-right">
                        <span className="sm:hidden text-xs font-bold uppercase tracking-widest text-muted-foreground">Category Actions</span>
                        <div className="flex justify-end gap-1.5 sm:gap-2">
                          <ActionButton
                            className="h-8 rounded-md px-2 text-muted-foreground hover:bg-muted"
                            onClick={() => onEditCategory(category)}
                          >
                            <Pencil className="size-3" />
                            <span className="hidden sm:inline">Edit</span>
                          </ActionButton>
                          <ActionButton
                            tone="danger"
                            className="h-8 rounded-md px-2"
                            onClick={() => onDeleteCategory(category)}
                          >
                            <Trash2 className="size-3" />
                            <span className="hidden sm:inline">Remove</span>
                          </ActionButton>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
