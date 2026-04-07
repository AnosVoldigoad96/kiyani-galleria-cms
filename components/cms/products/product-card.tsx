"use client";

import { motion } from "framer-motion";
import { Copy, Eye, FolderKanban, Package, Pencil, Trash2 } from "lucide-react";

import {
  ActionButton,
  Stars,
  StatusBadge,
  TogglePill,
  sectionTone,
} from "@/components/cms/cms-shared";
import type { CmsProduct } from "@/lib/cms-data";

type ProductCardProps = {
  product: CmsProduct;
  index: number;
  onEdit: (product: CmsProduct) => void;
  onClone: (product: CmsProduct) => void;
  onDelete: (product: CmsProduct) => void;
  onView: (product: CmsProduct) => void;
};

export function ProductCard({
  product,
  index,
  onEdit,
  onClone,
  onDelete,
  onView,
}: ProductCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group grid grid-cols-1 gap-4 rounded-xl border border-border bg-white p-4 shadow-sm transition-all hover:border-border hover:shadow-md sm:gap-6 sm:p-5 lg:grid-cols-[160px_1fr_280px]"
    >
      {/* Product Image */}
      <div className="relative h-48 w-full overflow-hidden rounded-lg border border-border bg-muted transition-colors sm:h-64 lg:h-40 lg:w-40">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.imageAlt ?? product.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-4 text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {product.imageLabel || "No image"}
            </span>
          </div>
        )}
        <div className="absolute left-2 top-2">
          <StatusBadge tone="neutral">{product.id}</StatusBadge>
        </div>
      </div>

      {/* Product Content */}
      <div className="flex flex-col min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-xl font-bold tracking-tight text-foreground line-clamp-1">
            {product.name}
          </h3>
          <StatusBadge tone={product.status === "Live" ? "success" : "warning"}>
            {product.status}
          </StatusBadge>
        </div>
        
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground line-clamp-2">
          {product.description}
        </p>

        <div className="mt-auto pt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-tight text-muted-foreground">
            <FolderKanban className="size-3.5" />
            {product.category}
          </div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-tight text-muted-foreground">
            <Package className="size-3.5" />
            {product.stock} in stock
          </div>
          <div className="text-lg font-bold text-[var(--primary)] leading-none">
            {product.pricePkr}
          </div>
          <div className="text-xs font-semibold text-muted-foreground">
            Cost {product.ourPricePkr} · Margin {product.marginPkr}
          </div>
        </div>
      </div>

      {/* Actions & Meta */}
      <div className="flex flex-col gap-4 rounded-lg bg-muted/30 p-4 border border-border">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Merchandising
          </p>
          <div className="flex gap-1">
             <TogglePill label="TR" active={product.tags.trending} />
             <TogglePill label="BS" active={product.tags.bestSeller} />
          </div>
        </div>

        <div className="space-y-2 flex-1">
          <div className="flex items-center justify-between p-2 rounded-md bg-white border border-border shadow-sm">
            <span className="text-xs font-bold text-muted-foreground">Discount</span>
            <span className={`text-xs font-bold ${
              product.discountEnabled ? "text-emerald-600" : "text-muted-foreground"
            }`}>
              {product.discountEnabled ? `${product.discountPercent}% OFF` : "Disabled"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <ActionButton onClick={() => onEdit(product)} className="bg-white">
            <Pencil className="size-3" />
            Edit
          </ActionButton>
          <ActionButton onClick={() => onView(product)} className="bg-white">
            <Eye className="size-3" />
            View
          </ActionButton>
          <ActionButton onClick={() => onClone(product)} className="bg-white">
            <Copy className="size-3" />
            Clone
          </ActionButton>
          <ActionButton tone="danger" onClick={() => onDelete(product)} className="bg-white">
            <Trash2 className="size-3" />
            Delete
          </ActionButton>
        </div>
      </div>
    </motion.div>
  );
}
