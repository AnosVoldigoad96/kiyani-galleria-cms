"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const STEPS = ["Processing", "Packed", "Dispatched", "Delivered"] as const;

type TimelineProps = {
  current: string;
  cancelled?: boolean;
};

export function OrderStatusTimeline({ current, cancelled }: TimelineProps) {
  if (cancelled) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
        Order Cancelled
      </div>
    );
  }

  const currentIndex = STEPS.findIndex(
    (s) => s.toLowerCase() === current.toLowerCase(),
  );

  return (
    <>
      {/* Desktop: horizontal */}
      <div className="hidden sm:flex items-center gap-1">
        {STEPS.map((step, i) => {
          const done = i <= currentIndex;
          const isLast = i === STEPS.length - 1;
          return (
            <div key={step} className="flex items-center gap-1">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full text-xs font-medium",
                    done
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-3.5" /> : i + 1}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium",
                    done ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {step}
                </span>
              </div>
              {!isLast && (
                <div
                  className={cn(
                    "mx-1 h-px w-6",
                    i < currentIndex ? "bg-primary" : "bg-border",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: vertical */}
      <div className="flex sm:hidden flex-col gap-0">
        {STEPS.map((step, i) => {
          const done = i <= currentIndex;
          const isLast = i === STEPS.length - 1;
          return (
            <div key={step} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs font-medium",
                    done
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-3" /> : i + 1}
                </div>
                {!isLast && (
                  <div
                    className={cn(
                      "w-px h-5",
                      i < currentIndex ? "bg-primary" : "bg-border",
                    )}
                  />
                )}
              </div>
              <span
                className={cn(
                  "text-sm font-medium pt-0.5",
                  done ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}
