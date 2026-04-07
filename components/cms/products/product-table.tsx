"use client";

import { useState } from "react";
import { Fragment } from "react";

import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  Pencil,
  Trash2,
} from "lucide-react";

import {
  ActionButton,
  Stars,
  StatusBadge,
  TogglePill,
  sectionTone,
} from "@/components/cms/cms-shared";
import type { CmsProduct } from "@/lib/cms-data";

type ProductTableProps = {
  products: CmsProduct[];
  onEdit: (product: CmsProduct) => void;
  onClone: (product: CmsProduct) => void;
  onDelete: (product: CmsProduct) => void;
  onView: (product: CmsProduct) => void;
};

export function ProductTable({
  products,
  onEdit,
  onClone,
  onDelete,
  onView,
}: ProductTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (productId: string) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(productId)) {
      newExpandedRows.delete(productId);
    } else {
      newExpandedRows.add(productId);
    }
    setExpandedRows(newExpandedRows);
  };

  const statusPill = (value: string) => {
    if (value.toLowerCase() === "live") {
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
    if (value.toLowerCase() === "draft") {
      return "bg-amber-50 text-amber-700 border-amber-200";
    }
    if (value.toLowerCase() === "archived") {
      return "bg-rose-50 text-rose-700 border-rose-200";
    }
    return "bg-slate-100 text-muted-foreground border-border";
  };

  return (
    <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
      <div className="w-full">
        <table className="w-full text-sm block sm:table">
          <thead className="hidden sm:table-header-group bg-muted/30">
            <tr className="border-b border-border whitespace-nowrap">
              <th className="p-3 sm:px-4 sm:py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-tight">Product</th>
              <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-tight">Category</th>
              <th className="p-3 sm:px-4 sm:py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-tight">Pricing</th>
              <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-tight">Stock</th>
              <th className="p-3 sm:px-4 sm:py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-tight">Status</th>
              <th className="p-3 sm:px-4 sm:py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-tight">Actions</th>
            </tr>
          </thead>
          <tbody className="block sm:table-row-group divide-y divide-slate-100">
            {products.map((product) => (
              <ProductRow
                key={product.productId}
                product={product}
                isExpanded={expandedRows.has(product.productId)}
                onToggle={() => toggleRow(product.productId)}
                onEdit={onEdit}
                onClone={onClone}
                onDelete={onDelete}
                onView={onView}
                statusPill={statusPill}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProductRow({
  product,
  isExpanded,
  onToggle,
  onEdit,
  onClone,
  onDelete,
  onView,
  statusPill,
}: {
  product: CmsProduct;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: (product: CmsProduct) => void;
  onClone: (product: CmsProduct) => void;
  onDelete: (product: CmsProduct) => void;
  onView: (product: CmsProduct) => void;
  statusPill: (value: string) => string;
}) {
  return (
    <Fragment>
      <tr className="flex flex-col sm:table-row transition-colors hover:bg-muted/30 p-4 sm:p-0">
        <td className="block sm:table-cell sm:p-4 border-b border-border sm:border-none pb-4 mb-3 sm:pb-4 sm:mb-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onToggle}
              className="flex size-6 flex-shrink-0 items-center justify-center rounded bg-slate-100 text-muted-foreground hover:bg-slate-200 transition-colors"
            >
              {isExpanded ? (
                <ChevronUp className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )}
            </button>
            <div className="flex size-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.imageAlt ?? product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-xs font-bold text-muted-foreground capitalize title-case">{product.imageLabel}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground break-words line-clamp-2 sm:line-clamp-1">{product.name}</p>
              <p className="mt-1 text-xs text-muted-foreground uppercase tracking-tighter">{product.id}</p>
              <p className="mt-1 text-xs font-medium text-muted-foreground sm:hidden">
                {product.category} &middot; {product.subcategory}
              </p>
            </div>
          </div>
        </td>
        <td className="hidden sm:table-cell px-4 py-4">
          <p className="font-medium text-foreground">{product.category}</p>
          <p className="text-xs text-muted-foreground">{product.subcategory}</p>
        </td>
        <td className="flex items-center justify-between sm:table-cell sm:px-4 sm:py-4 mb-2 sm:mb-0">
          <span className="sm:hidden text-xs font-bold uppercase tracking-widest text-muted-foreground">Pricing</span>
          <div className="text-right flex flex-col items-end sm:items-start sm:text-left">
            <p className="font-semibold text-foreground">{product.pricePkr}</p>
            <p className="text-xs font-medium text-muted-foreground">
              Cost {product.ourPricePkr} · Margin {product.marginPkr}
            </p>
            {product.discountEnabled && (
              <p className="text-xs font-bold text-emerald-600">
                {product.discountPercent}% OFF
              </p>
            )}
          </div>
        </td>
        <td className="hidden sm:table-cell px-4 py-4 whitespace-nowrap">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <span
              className={`size-1.5 rounded-full flex-shrink-0 ${
                product.stock === "Out of stock" ? "bg-rose-500" : "bg-emerald-500"
              }`}
            />
            {product.stock}
          </div>
        </td>
        <td className="flex items-center justify-between sm:table-cell sm:px-4 sm:py-4 mb-4 sm:mb-0">
          <span className="sm:hidden text-xs font-bold uppercase tracking-widest text-muted-foreground">Status</span>
          <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusPill(product.status)}`}
          >
            {product.status}
          </span>
        </td>
        <td className="flex items-center justify-between sm:table-cell sm:px-4 sm:py-4">
          <span className="sm:hidden text-xs font-bold uppercase tracking-widest text-muted-foreground">Actions</span>
          <div className="flex items-center justify-end gap-2">
            <ActionButton
              className="h-8 rounded-md px-2 text-muted-foreground hover:bg-muted"
              onClick={() => onEdit(product)}
            >
              <Pencil className="size-3" />
              <span className="hidden sm:inline">Edit</span>
            </ActionButton>
            <ActionButton
              tone="danger"
              className="h-8 rounded-md px-2"
              onClick={() => onDelete(product)}
            >
              <Trash2 className="size-3" />
              <span className="inline sm:hidden">Remove</span>
            </ActionButton>
          </div>
        </td>
      </tr>
      <AnimatePresence initial={false}>
        {isExpanded && (
          <tr className="block sm:table-row">
            <td colSpan={6} className="block sm:table-cell p-0 border-none">
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden bg-muted/40"
              >
                <div className="grid gap-8 border-t border-border px-12 py-6 lg:grid-cols-[1fr_280px]">
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        Description
                      </h4>
                      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                        {product.description}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        Features
                      </h4>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {product.features.map((feature) => (
                          <span
                            key={feature}
                            className="rounded bg-white border border-border px-2 py-0.5 text-xs font-medium text-foreground"
                          >
                            {feature}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-3 pt-4 border-t border-border">
                      <ActionButton
                        className="h-8 rounded-md px-3 text-muted-foreground"
                        onClick={() => onView(product)}
                      >
                        <Eye className="size-3.5" />
                        Preview
                      </ActionButton>
                      <ActionButton
                        className="h-8 rounded-md px-3 text-muted-foreground"
                        onClick={() => onClone(product)}
                      >
                        <Copy className="size-3.5" />
                        Clone
                      </ActionButton>
                    </div>
                  </div>
                  <div className="space-y-6 rounded-lg bg-white border border-border p-4 shadow-sm">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        Visibility Tags
                      </h4>
                      <div className="mt-3 flex flex-wrap gap-1">
                        <TogglePill label="Trending" active={product.tags.trending} />
                        <TogglePill label="Bestseller" active={product.tags.bestSeller} />
                        <TogglePill label="New" active={product.tags.newArrival} />
                        <TogglePill label="Top Rated" active={product.tags.topRated} />
                        <TogglePill label="Deal" active={product.tags.dealOfDay} />
                      </div>
                    </div>
                    <div className="pt-4 border-t border-border">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        Margin
                      </h4>
                      <div className="mt-2 flex items-center justify-between text-xs font-semibold text-foreground">
                        <span>Our price {product.ourPricePkr}</span>
                        <span>{product.marginPkr} ({product.marginPercent.toFixed(1)}%)</span>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-border">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        Rating
                      </h4>
                      <div className="mt-2 text-foreground font-semibold flex items-center gap-2">
                        <Stars value={product.rating} />
                        <span className="text-xs">{product.rating}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </Fragment>
  );
}
