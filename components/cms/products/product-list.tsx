"use client";

import { useMemo, useState } from "react";

import { LayoutGrid, List, Plus } from "lucide-react";

import { FilterBar } from "@/components/cms/ui/filter-bar";
import { Button } from "@/components/ui/button";
import type { CmsProduct } from "@/lib/cms-data";

import { ProductCard } from "./product-card";
import { ProductTable } from "./product-table";

type ProductListProps = {
  products: CmsProduct[];
  onCreate: () => void;
  onEdit: (product: CmsProduct) => void;
  onClone: (product: CmsProduct) => void;
  onDelete: (product: CmsProduct) => void;
  onView: (product: CmsProduct) => void;
};

export function ProductList({
  products,
  onCreate,
  onEdit,
  onClone,
  onDelete,
  onView,
}: ProductListProps) {
  const [view, setView] = useState<"cards" | "table">("table");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean));
    return Array.from(set).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
      return true;
    });
  }, [products, statusFilter, categoryFilter]);

  const hasFilters = statusFilter !== "all" || categoryFilter !== "all";

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Products</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage catalog items, pricing, and feature tags.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-md border border-border p-0.5 bg-muted/30">
            <button
              type="button"
              onClick={() => setView("cards")}
              className={`flex size-8 items-center justify-center rounded transition-all ${
                view === "cards"
                  ? "bg-card text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("table")}
              className={`flex size-8 items-center justify-center rounded transition-all ${
                view === "table"
                  ? "bg-card text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="size-4" />
            </button>
          </div>
          <Button type="button" onClick={onCreate}>
            <Plus className="mr-1.5 size-4" />
            Add Product
          </Button>
        </div>
      </div>

      <FilterBar
        filters={[
          {
            label: "Status",
            value: statusFilter,
            options: [
              { label: "All statuses", value: "all" },
              { label: "Live", value: "Live" },
              { label: "Draft", value: "Draft" },
              { label: "Archived", value: "Archived" },
            ],
            onChange: setStatusFilter,
          },
          {
            label: "Category",
            value: categoryFilter,
            options: [
              { label: "All categories", value: "all" },
              ...categories.map((c) => ({ label: c, value: c })),
            ],
            onChange: setCategoryFilter,
          },
        ]}
        hasActiveFilters={hasFilters}
        onClearAll={() => { setStatusFilter("all"); setCategoryFilter("all"); }}
      />

      <div>
        {filteredProducts.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {hasFilters ? "No products match the current filters." : "No products found."}
          </p>
        ) : view === "cards" ? (
          <div className="space-y-6">
            {filteredProducts.map((product, index) => (
              <ProductCard
                key={product.productId}
                product={product}
                index={index}
                onEdit={onEdit}
                onClone={onClone}
                onDelete={onDelete}
                onView={onView}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <ProductTable
              products={filteredProducts}
              onEdit={onEdit}
              onClone={onClone}
              onDelete={onDelete}
              onView={onView}
            />
          </div>
        )}
      </div>
    </section>
  );
}
