"use client";

import { startTransition } from "react";
import Image from "next/image";

import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { navGroups, sections, type SectionId } from "@/components/cms/cms-config";

type CmsSidebarProps = {
  activeSection: SectionId;
  isOpen: boolean;
  isCollapsed: boolean;
  counts?: Partial<Record<SectionId, number>>;
  onClose: () => void;
  onToggleCollapse: () => void;
  onSectionChange: (section: SectionId) => void;
  onLogout: () => Promise<void>;
};

export function CmsSidebar({
  activeSection,
  isOpen,
  isCollapsed,
  counts,
  onClose,
  onToggleCollapse,
  onSectionChange,
  onLogout,
}: CmsSidebarProps) {
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-card transition-all duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
        isCollapsed ? "lg:w-[68px]" : "lg:w-60"
      } ${isOpen ? "translate-x-0 w-60" : "-translate-x-full w-60"}`}
    >
      <button
        type="button"
        onClick={onToggleCollapse}
        className="absolute -right-3 top-[18px] z-50 hidden size-6 items-center justify-center rounded-full border border-border bg-card transition-colors hover:bg-muted lg:flex"
      >
        {isCollapsed ? (
          <PanelLeftOpen className="size-3 text-muted-foreground" />
        ) : (
          <PanelLeftClose className="size-3 text-muted-foreground" />
        )}
      </button>

      <div className="flex h-14 items-center border-b border-border px-3">
        {/* Collapsed: icon only (desktop only) */}
        {isCollapsed && (
          <div className="hidden lg:flex items-center justify-center w-full">
            <div className="relative size-8">
              <Image src="/logo.png" alt="KG" fill sizes="32px" className="object-contain" />
            </div>
          </div>
        )}
        {/* Expanded: logo + brand name */}
        <div className={`overflow-hidden transition-all duration-300 flex items-center gap-2 ${isCollapsed ? "lg:opacity-0 lg:w-0 hidden lg:flex" : ""}`}>
          <div className="relative h-8 w-8 shrink-0">
            <Image src="/logo.png" alt="KG" fill sizes="32px" className="object-contain" />
          </div>
          <span className="text-sm font-bold text-foreground whitespace-nowrap">Kiyani Galleria</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-muted lg:hidden"
        >
          <LogOut className="size-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="CMS navigation">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-5">
            <p
              className={`mb-1.5 px-3 text-xs font-medium text-muted-foreground transition-opacity duration-300 ${
                isCollapsed ? "lg:opacity-0 lg:h-0 lg:mb-0 lg:overflow-hidden" : ""
              }`}
            >
              {group.label}
            </p>
            {isCollapsed && <div className="hidden lg:block mb-2 border-t border-border first:border-0" />}
            <ul className="space-y-0.5">
              {group.ids.map((sectionId) => {
                const section = sections.find((item) => item.id === sectionId);
                if (!section) return null;

                const Icon = section.icon;
                const active = section.id === activeSection;

                return (
                  <li key={section.id}>
                    <button
                      type="button"
                      onClick={() => {
                        startTransition(() => onSectionChange(section.id));
                        onClose();
                      }}
                      className={`flex w-full cursor-pointer items-center rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      } ${isCollapsed ? "lg:justify-center" : "gap-3"}`}
                      title={isCollapsed ? section.label : undefined}
                    >
                      <Icon className={`size-4 shrink-0 ${active ? "text-primary" : ""}`} />
                      <span className={isCollapsed ? "lg:hidden" : ""}>{section.label}</span>
                      {counts?.[section.id as SectionId] != null && (
                        <span
                          className={`ml-auto text-xs tabular-nums text-muted-foreground transition-opacity ${
                            isCollapsed ? "lg:hidden" : ""
                          }`}
                        >
                          {counts[section.id as SectionId]}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mt-auto border-t border-border p-3">
        <button
          type="button"
          onClick={() => { void onLogout(); }}
          className={`flex w-full cursor-pointer items-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-600 ${
            isCollapsed ? "lg:justify-center" : "gap-3"
          }`}
        >
          <LogOut className="size-4 shrink-0" />
          <span className={isCollapsed ? "lg:hidden" : ""}>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
