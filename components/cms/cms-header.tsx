"use client";

import { Bell, ChevronRight, Menu, Search, User } from "lucide-react";

import { sections, type SectionId } from "@/components/cms/cms-config";

type CmsHeaderProps = {
  activeSection: SectionId;
  query: string;
  userEmail: string | null | undefined;
  userLabel: string;
  onOpenSidebar: () => void;
  onQueryChange: (value: string) => void;
};

export function CmsHeader({
  activeSection,
  query,
  userEmail,
  userLabel,
  onOpenSidebar,
  onQueryChange,
}: CmsHeaderProps) {
  const currentSection = sections.find((item) => item.id === activeSection);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card">
      <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="rounded-md border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
          >
            <Menu className="size-4" />
          </button>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden font-medium text-muted-foreground sm:inline">CMS</span>
            <ChevronRight className="hidden size-3.5 text-muted-foreground/50 sm:inline" />
            <span className="font-semibold text-foreground">
              {currentSection?.label}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={`Search ${currentSection?.label.toLowerCase() ?? "section"}...`}
              className="h-9 w-72 rounded-md border border-border bg-background pl-9 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </div>

          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Bell className="size-4" />
          </button>

          <div className="flex items-center gap-2 rounded-md border border-border p-1 pr-3">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <User className="size-3.5" />
            </div>
            <div className="hidden min-w-0 max-w-[120px] sm:block">
              <p className="truncate text-sm font-medium text-foreground">{userLabel}</p>
              <p className="truncate text-xs text-muted-foreground">
                {userEmail ?? "Admin"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
