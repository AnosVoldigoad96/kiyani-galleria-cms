"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, BookOpen, Plus } from "lucide-react";

import { FilterBar } from "@/components/cms/ui/filter-bar";
import { EmptyState } from "@/components/cms/ui/empty-state";
import { StatusBadge } from "@/components/cms/cms-shared";
import { Button } from "@/components/ui/button";
import { ManualJournalEditor } from "./manual-journal-editor";
import type { CmsInvoice, CmsJournalEntry, CmsLedgerAccount } from "@/lib/cms-data";

function statusTone(s: CmsJournalEntry["status"]) {
  if (s === "Posted") return "success" as const;
  if (s === "Draft") return "warning" as const;
  return "danger" as const;
}

type Props = {
  entries: CmsJournalEntry[];
  accounts: CmsLedgerAccount[];
  invoices: CmsInvoice[];
  onRefresh?: () => void;
};

export function JournalEntriesTab({ entries, accounts, invoices, onRefresh }: Props) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const filtered = statusFilter === "all"
    ? entries
    : entries.filter((e) => e.status.toLowerCase() === statusFilter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterBar
        filters={[{
          label: "Status",
          value: statusFilter,
          options: [
            { label: "All statuses", value: "all" },
            { label: "Draft", value: "draft" },
            { label: "Posted", value: "posted" },
            { label: "Voided", value: "voided" },
          ],
          onChange: setStatusFilter,
        }]}
        hasActiveFilters={statusFilter !== "all"}
        onClearAll={() => setStatusFilter("all")}
      />
        <Button size="sm" onClick={() => setEditorOpen(true)}>
          <Plus className="mr-1.5 size-3.5" /> New Entry
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={BookOpen} title="No journal entries" description="Journal entries will appear here when invoices or orders are synced." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="w-8 px-3 py-3" />
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Journal</th>
                <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Date</th>
                <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Reference</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</th>
                <th className="hidden sm:table-cell px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Debits</th>
                <th className="hidden sm:table-cell px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Credits</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((entry) => {
                const isExpanded = expandedId === entry.id;
                return (
                  <tr key={entry.id} className="group">
                    <td colSpan={7} className="p-0">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                        className="flex w-full items-center hover:bg-muted/30 transition-colors"
                      >
                        <span className="flex w-8 shrink-0 items-center justify-center px-3 py-3">
                          {isExpanded ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
                        </span>
                        <span className="flex-1 flex items-center gap-4 px-4 py-3 text-left min-w-0">
                          <span className="min-w-0 shrink-0">
                            <span className="block font-medium text-foreground">{entry.journalNo}</span>
                            <span className="block text-xs text-muted-foreground sm:hidden">{entry.entryDate}</span>
                          </span>
                          <span className="hidden sm:block text-muted-foreground">{entry.entryDate}</span>
                          <span className="hidden md:block text-muted-foreground truncate">{entry.reference}</span>
                          <span className="shrink-0"><StatusBadge tone={statusTone(entry.status)}>{entry.status}</StatusBadge></span>
                          <span className="hidden sm:block ml-auto text-right tabular-nums font-medium shrink-0">{entry.debitPkr}</span>
                          <span className="hidden sm:block text-right tabular-nums font-medium shrink-0">{entry.creditPkr}</span>
                        </span>
                      </button>
                      {isExpanded && entry.lines.length > 0 && (
                        <div className="border-t border-border bg-muted/20 px-4 py-3 sm:px-12">
                          {/* Desktop: table layout */}
                          <table className="hidden sm:table w-full text-sm">
                            <thead>
                              <tr className="text-xs text-muted-foreground">
                                <th className="pb-2 text-left font-medium">Account</th>
                                <th className="pb-2 text-left font-medium">Name</th>
                                <th className="pb-2 text-left font-medium">Side</th>
                                <th className="pb-2 text-right font-medium">Amount</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                              {entry.lines.map((line) => (
                                <tr key={line.id}>
                                  <td className="py-1.5 font-medium text-foreground">{line.accountCode}</td>
                                  <td className="py-1.5 text-muted-foreground">{line.accountName}</td>
                                  <td className="py-1.5">{line.side}</td>
                                  <td className="py-1.5 text-right font-medium tabular-nums">{line.amountPkr}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>

                          {/* Mobile: stacked card layout */}
                          <div className="sm:hidden space-y-2">
                            {entry.lines.map((line) => (
                              <div key={line.id} className="flex items-center justify-between rounded-md border border-border/50 bg-card px-3 py-2">
                                <div>
                                  <p className="text-sm font-medium text-foreground">{line.accountCode} · {line.accountName}</p>
                                  <p className="text-xs text-muted-foreground">{line.side}</p>
                                </div>
                                <p className="text-sm font-medium tabular-nums">{line.amountPkr}</p>
                              </div>
                            ))}
                          </div>

                          {entry.memo && <p className="mt-2 text-xs text-muted-foreground">{entry.memo}</p>}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ManualJournalEditor
        open={editorOpen}
        accounts={accounts}
        invoices={invoices}
        onClose={() => setEditorOpen(false)}
        onRefresh={onRefresh}
      />
    </div>
  );
}
