"use client";

import { useState } from "react";

import { StatCard } from "@/components/cms/ui/stat-card";
import { ConfirmDeleteModal } from "@/components/cms/products/confirm-delete-modal";
import { InvoicesTab } from "@/components/cms/accounting/invoices-tab";
import { InvoiceEditor } from "@/components/cms/accounting/invoice-editor";
import { JournalEntriesTab } from "@/components/cms/accounting/journal-entries-tab";
import { ChartOfAccountsTab } from "@/components/cms/accounting/chart-of-accounts-tab";
import { ReportsTab } from "@/components/cms/accounting/reports-tab";
import { deleteInvoice } from "@/components/cms/accounting/invoice-api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import type {
  CmsAccountingStat,
  CmsInvoice,
  CmsJournalEntry,
  CmsLedgerAccount,
  CmsOrder,
} from "@/lib/cms-data";

const TABS = ["Invoices", "Journals", "Accounts", "Reports"] as const;
type Tab = (typeof TABS)[number];

export function AccountingSection({
  accountingStats,
  invoices,
  journalEntries,
  ledgerAccounts,
  orders,
  onRefresh,
}: {
  accountingStats: CmsAccountingStat[];
  invoices: CmsInvoice[];
  journalEntries: CmsJournalEntry[];
  ledgerAccounts: CmsLedgerAccount[];
  orders: CmsOrder[];
  onRefresh?: () => void;
}) {
  const [tab, setTab] = useState<Tab>("Invoices");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CmsInvoice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CmsInvoice | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCreate = () => { setEditing(null); setEditorOpen(true); };
  const openEdit = (inv: CmsInvoice) => { setEditing(inv); setEditorOpen(true); };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsSaving(true); setError(null);
    try {
      await deleteInvoice(deleteTarget.id);
      toast.success("Invoice deleted.");
      setDeleteTarget(null);
      onRefresh?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete.";
      setError(msg); toast.error(msg);
    } finally { setIsSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Accounting</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Invoices, journals, chart of accounts, and financial reports.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {accountingStats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} detail={stat.detail} />
        ))}
      </section>

      {/* Tab navigation */}
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex items-center gap-1 border-b border-border min-w-max">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors -mb-px border-b-2",
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
            )}
          >
            {t}
          </button>
        ))}
      </div>
      </div>

      {tab === "Invoices" && (
        <InvoicesTab invoices={invoices} onEdit={openEdit} onDelete={setDeleteTarget} onCreate={openCreate} />
      )}
      {tab === "Journals" && (
        <JournalEntriesTab entries={journalEntries} />
      )}
      {tab === "Accounts" && (
        <ChartOfAccountsTab accounts={ledgerAccounts} />
      )}
      {tab === "Reports" && (
        <ReportsTab ledgerAccounts={ledgerAccounts} invoices={invoices} />
      )}

      <InvoiceEditor
        open={editorOpen}
        editing={editing}
        orders={orders}
        onClose={() => { setEditorOpen(false); setEditing(null); }}
        onRefresh={onRefresh}
      />

      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title="Delete invoice"
        description={`You're about to delete "${deleteTarget?.invoiceNo ?? ""}".`}
        onClose={() => { setDeleteTarget(null); setError(null); }}
        onConfirm={handleDelete}
        isSaving={isSaving}
        error={error}
      />
    </div>
  );
}
