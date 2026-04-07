"use client";

import { motion } from "framer-motion";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { ActionButton, StatusBadge, sectionTone, surfaceClassName } from "@/components/cms/cms-shared";
import { Button } from "@/components/ui/button";
import type { CmsSubcategory } from "@/lib/cms-data";

type SubcategoryPanelProps = {
  subcategories: CmsSubcategory[];
  onCreate: () => void;
  onEdit: (subcategory: CmsSubcategory) => void;
  onDelete: (subcategory: CmsSubcategory) => void;
};

export function SubcategoryPanel({
  subcategories,
  onCreate,
  onDelete,
  onEdit,
}: SubcategoryPanelProps) {
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className={surfaceClassName("p-4 sm:p-8")}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
            Subcategories
          </p>
          <h2 className="mt-2 text-3xl font-bold text-[var(--foreground)]">Structure</h2>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onCreate}
          className="rounded-2xl border-2 border-[var(--border)] px-5 py-5 text-xs font-bold hover:bg-black/5 active:scale-95"
        >
          <Plus className="mr-2 size-4" />
          Add sub
        </Button>
      </div>
      <div className="mt-8">
        <div className="w-full">
          <div className="hidden lg:grid grid-cols-[1.1fr_1fr_0.6fr_0.7fr_0.9fr] gap-3 border-b border-[var(--border)]/50 px-1 pb-4 text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
            <span>Name</span>
            <span>Category</span>
            <span>Items</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          <div className="divide-y divide-[var(--border)]/50">
            {subcategories.map((sub, index) => (
              <motion.div
                key={sub.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 + index * 0.05 }}
                className="flex flex-col gap-4 px-1 py-5 transition-colors hover:bg-black/[0.02] lg:grid lg:grid-cols-[1.1fr_1fr_0.6fr_0.7fr_0.9fr] lg:gap-3 lg:items-center"
              >
                <div className="flex items-center justify-between lg:block">
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted-foreground)] lg:hidden">Subcategory</span>
                  <span className="font-bold text-[var(--foreground)] text-right lg:text-left">{sub.name}</span>
                </div>
                <div className="flex items-center justify-between lg:block">
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted-foreground)] lg:hidden">Category</span>
                  <span className="text-sm font-medium text-[var(--muted-foreground)] text-right lg:text-left">{sub.category}</span>
                </div>
                <div className="flex items-center justify-between lg:block">
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted-foreground)] lg:hidden">Items</span>
                  <span className="text-sm font-bold text-[var(--foreground)]">{sub.itemCount}</span>
                </div>
                <div className="flex items-center justify-between lg:block">
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted-foreground)] lg:hidden">Status</span>
                  <div className="flex justify-end lg:justify-start">
                    <StatusBadge tone={sectionTone(sub.status)}>{sub.status}</StatusBadge>
                  </div>
                </div>
                <div className="flex items-center justify-between lg:block mt-2 pt-4 border-t border-[var(--border)]/30 lg:mt-0 lg:pt-0 lg:border-none">
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted-foreground)] lg:hidden">Actions</span>
                  <div className="flex gap-2">
                    <ActionButton onClick={() => onEdit(sub)}>
                      <Pencil className="size-3" />
                      Edit
                    </ActionButton>
                    <ActionButton tone="danger" onClick={() => onDelete(sub)}>
                      <Trash2 className="size-3" />
                      Remove
                    </ActionButton>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
