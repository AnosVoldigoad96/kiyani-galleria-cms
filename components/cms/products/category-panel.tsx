"use client";

import { motion } from "framer-motion";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { ActionButton, StatusBadge, sectionTone, surfaceClassName } from "@/components/cms/cms-shared";
import { Button } from "@/components/ui/button";
import type { CmsCategory } from "@/lib/cms-data";

type CategoryPanelProps = {
  categories: CmsCategory[];
  onCreate: () => void;
  onEdit: (category: CmsCategory) => void;
  onDelete: (category: CmsCategory) => void;
};

export function CategoryPanel({ categories, onCreate, onDelete, onEdit }: CategoryPanelProps) {
  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className={surfaceClassName("p-8")}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
            Categories
          </p>
          <h2 className="mt-2 text-3xl font-bold text-[var(--foreground)]">Product taxonomy</h2>
        </div>
        <Button
          type="button"
          onClick={onCreate}
          className="rounded-2xl bg-[var(--foreground)] px-6 py-5 text-xs font-bold text-white shadow-lg transition-transform hover:-translate-y-0.5 hover:bg-black active:scale-95"
        >
          <Plus className="mr-2 size-4" />
          Add category
        </Button>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {categories.map((category, index) => (
          <motion.div
            key={category.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + index * 0.05 }}
            className="group rounded-3xl border border-white/50 bg-white/40 p-5 shadow-sm transition-all duration-300 hover:bg-white hover:shadow-md"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-bold tracking-tight text-[var(--foreground)]">{category.name}</p>
              <StatusBadge tone={sectionTone(category.visibility)}>{category.visibility}</StatusBadge>
            </div>
            <p className="mt-4 text-xs font-medium text-[var(--muted-foreground)]">
              {category.itemCount} items curated
            </p>
            <div className="mt-6 flex gap-2">
              <ActionButton onClick={() => onEdit(category)}>
                <Pencil className="size-3" />
                Edit
              </ActionButton>
              <ActionButton tone="danger" onClick={() => onDelete(category)}>
                <Trash2 className="size-3" />
                Remove
              </ActionButton>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
