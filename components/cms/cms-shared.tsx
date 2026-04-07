"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

import { Star } from "lucide-react";

export type StatusTone = "neutral" | "success" | "warning" | "danger" | "accent";

export function surfaceClassName(extra?: string) {
  return `rounded-lg border border-border bg-card ${extra ?? ""}`;
}

function badgeClassName(tone: StatusTone) {
  if (tone === "success") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (tone === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (tone === "danger") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (tone === "accent") {
    return "border-primary/20 bg-primary/10 text-primary";
  }
  return "border-border bg-muted text-muted-foreground";
}

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: StatusTone;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeClassName(tone)}`}
    >
      {children}
    </span>
  );
}

export function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
  trend?: "up" | "down";
}) {
  return (
    <article className={surfaceClassName("p-4")}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </article>
  );
}

export function TogglePill({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium transition-colors ${
        active
          ? "border-primary/20 bg-primary/10 text-primary"
          : "border-border bg-muted text-muted-foreground"
      }`}
    >
      {label}
    </span>
  );
}

export function ActionButton({
  children,
  tone = "default",
  className,
  ...props
}: {
  children: ReactNode;
  tone?: "default" | "danger";
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
        tone === "danger"
          ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
          : "border-border bg-card text-foreground hover:bg-muted"
      } ${className ?? ""}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Stars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1 text-primary">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`size-4 ${star <= Math.round(value) ? "fill-current" : ""}`}
        />
      ))}
      <span className="ml-1 text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

export function sectionTone(value: string): StatusTone {
  if (
    value === "Live" ||
    value === "Paid" ||
    value === "Published" ||
    value === "Active" ||
    value === "Dispatched" ||
    value === "Completed" ||
    value === "Delivered"
  ) {
    return "success";
  }

  if (
    value === "Pending" ||
    value === "Draft" ||
    value === "Quoted" ||
    value === "Packed" ||
    value === "Invited"
  ) {
    return "warning";
  }

  if (
    value === "Flagged" ||
    value === "Archived" ||
    value === "Muted" ||
    value === "Failed" ||
    value === "Refunded" ||
    value === "Cancelled"
  ) {
    return "danger";
  }

  if (value === "New" || value === "In Progress" || value === "Processing") {
    return "accent";
  }

  return "neutral";
}
