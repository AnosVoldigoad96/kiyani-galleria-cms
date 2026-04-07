"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

type FilterOption = { label: string; value: string };

type FilterDropdownProps = {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
};

function FilterDropdown({ label, value, options, onChange }: FilterDropdownProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-md border border-border bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
      aria-label={label}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

type FilterBarProps = {
  filters: FilterDropdownProps[];
  onClearAll?: () => void;
  hasActiveFilters?: boolean;
  children?: ReactNode;
};

export function FilterBar({ filters, onClearAll, hasActiveFilters, children }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((filter) => (
        <FilterDropdown key={filter.label} {...filter} />
      ))}
      {children}
      {hasActiveFilters && onClearAll && (
        <button
          type="button"
          onClick={onClearAll}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-3" />
          Clear
        </button>
      )}
    </div>
  );
}
