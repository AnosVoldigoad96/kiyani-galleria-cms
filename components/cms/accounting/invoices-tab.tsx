"use client";

import { useState } from "react";
import { CheckCircle, Download, Pencil, Plus, Trash2, ReceiptText, Coins, Truck, Receipt, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { CmsModal } from "@/components/cms/cms-modal";
import { DataTable, type Column } from "@/components/cms/ui/data-table";
import { FilterBar } from "@/components/cms/ui/filter-bar";
import { EmptyState } from "@/components/cms/ui/empty-state";
import { StatusBadge } from "@/components/cms/cms-shared";
import { Button } from "@/components/ui/button";
import { ManualJournalEditor } from "./manual-journal-editor";
import { nhost, nhostConfigError } from "@/lib/nhost";
import type { CmsInvoice, CmsLedgerAccount } from "@/lib/cms-data";
import { approveFullPayment, issueRefund, recordPayment } from "./invoice-api";

function statusTone(status: CmsInvoice["status"]) {
  if (status === "Paid") return "success" as const;
  if (status === "Issued" || status === "Partially Paid" || status === "Draft") return "warning" as const;
  if (status === "Overdue" || status === "Void") return "danger" as const;
  return "neutral" as const;
}

type InvoicesTabProps = {
  invoices: CmsInvoice[];
  accounts: CmsLedgerAccount[];
  onEdit: (invoice: CmsInvoice) => void;
  onDelete: (invoice: CmsInvoice) => void;
  onCreate: () => void;
  onRefresh?: () => void;
};

export function InvoicesTab({ invoices, accounts, onEdit, onDelete, onCreate, onRefresh }: InvoicesTabProps) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [partialPaymentTarget, setPartialPaymentTarget] = useState<CmsInvoice | null>(null);
  const [partialAmount, setPartialAmount] = useState("");
  const [journalEditorOpen, setJournalEditorOpen] = useState(false);
  const [journalPreselectedInvoice, setJournalPreselectedInvoice] = useState<CmsInvoice | null>(null);
  const [refundTarget, setRefundTarget] = useState<CmsInvoice | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");

  const openJournalForInvoice = (invoice: CmsInvoice) => {
    setJournalPreselectedInvoice(invoice);
    setJournalEditorOpen(true);
  };

  const handleApproveFullPayment = async (invoice: CmsInvoice) => {
    if (invoice.statusCode === "paid") return;
    setPayingId(invoice.id);
    try {
      await approveFullPayment(invoice.id, invoice.totalPkrValue);
      toast.success(`${invoice.invoiceNo} marked as paid.`);
      onRefresh?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to approve payment.");
    } finally {
      setPayingId(null);
    }
  };

  const handleRefund = async () => {
    if (!refundTarget) return;
    const amount = Number(refundAmount);
    if (!Number.isFinite(amount) || amount <= 0) { toast.error("Enter a valid refund amount."); return; }
    if (amount > refundTarget.paidPkrValue) { toast.error("Refund exceeds amount paid."); return; }
    setPayingId(refundTarget.id);
    try {
      await issueRefund(refundTarget.id, amount, { reason: refundReason.trim() || undefined });
      toast.success(`Refund of PKR ${amount.toLocaleString()} issued on ${refundTarget.invoiceNo}.`);
      setRefundTarget(null);
      setRefundAmount("");
      setRefundReason("");
      onRefresh?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to issue refund.");
    } finally {
      setPayingId(null);
    }
  };

  const handlePartialPayment = async () => {
    if (!partialPaymentTarget || !partialAmount) return;
    const amount = Number(partialAmount);
    if (amount <= 0) { toast.error("Enter a valid amount."); return; }
    setPayingId(partialPaymentTarget.id);
    try {
      await recordPayment(partialPaymentTarget.id, amount, partialPaymentTarget.paidPkrValue, partialPaymentTarget.totalPkrValue);
      toast.success(`PKR ${amount.toLocaleString()} recorded on ${partialPaymentTarget.invoiceNo}.`);
      setPartialPaymentTarget(null);
      setPartialAmount("");
      onRefresh?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to record payment.");
    } finally {
      setPayingId(null);
    }
  };

  const filtered = statusFilter === "all"
    ? invoices
    : invoices.filter((inv) => inv.statusCode === statusFilter);

  const downloadPdf = async (invoice: CmsInvoice) => {
    if (!nhost) { toast.error(nhostConfigError ?? "Nhost not configured."); return; }
    setDownloadingId(invoice.id);
    try {
      const refreshed = await nhost.refreshSession(60).catch(() => null);
      const session = refreshed ?? nhost.getUserSession();
      const token = session?.accessToken;
      if (!token) throw new Error("Sign in required.");

      const res = await fetch("/api/invoices/pdf", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: invoice.id }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { errors?: Array<{ message: string }> } | null;
        throw new Error(body?.errors?.[0]?.message ?? "PDF generation failed.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${invoice.invoiceNo}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF export failed.");
    } finally {
      setDownloadingId(null);
    }
  };

  const columns: Column<CmsInvoice>[] = [
    {
      key: "invoiceNo", header: "Invoice", sortable: true, sortValue: (r) => r.invoiceNo,
      render: (r) => (
        <div>
          <span className="font-medium text-foreground">{r.invoiceNo}</span>
          <span className="sm:hidden block text-xs text-primary font-medium mt-0.5">{r.totalPkr}</span>
          <span className="sm:hidden block text-xs text-muted-foreground">{r.customer}</span>
        </div>
      ),
    },
    { key: "customer", header: "Customer", sortable: true, sortValue: (r) => r.customer, hideBelow: "md", render: (r) => <span className="text-foreground">{r.customer}</span> },
    { key: "status", header: "Status", sortable: true, sortValue: (r) => r.status, render: (r) => <StatusBadge tone={statusTone(r.status)}>{r.status}</StatusBadge> },
    { key: "total", header: "Total", align: "right", sortable: true, sortValue: (r) => r.totalPkrValue, hideBelow: "sm", render: (r) => <span className="font-medium tabular-nums">{r.totalPkr}</span> },
    { key: "paid", header: "Paid", align: "right", sortable: true, sortValue: (r) => r.paidPkrValue, hideBelow: "md", render: (r) => <span className="tabular-nums text-emerald-700">{r.paidPkr}</span> },
    { key: "balance", header: "Balance", align: "right", sortable: true, sortValue: (r) => r.balancePkrValue, hideBelow: "md", render: (r) => <span className="tabular-nums text-rose-700">{r.balancePkr}</span> },
    { key: "issueDate", header: "Issued", sortable: true, sortValue: (r) => r.issueDateValue, hideBelow: "lg", render: (r) => <span className="text-muted-foreground">{r.issueDate}</span> },
    { key: "dueDate", header: "Due", hideBelow: "lg", render: (r) => <span className="text-muted-foreground">{r.dueDate}</span> },
    {
      key: "actions", header: "", align: "right",
      render: (r) => (
        <div className="flex justify-end gap-0.5 sm:gap-1">
          {r.statusCode !== "paid" && r.statusCode !== "void" && (
            <>
              <Button variant="outline" size="icon-xs" onClick={() => handleApproveFullPayment(r)} disabled={payingId === r.id} title="Approve Full Payment" className="text-emerald-600 hover:bg-emerald-50"><CheckCircle className="size-3.5" /></Button>
              <Button variant="outline" size="icon-xs" onClick={() => { setPartialPaymentTarget(r); setPartialAmount(""); }} title="Record Partial Payment" className="hidden sm:inline-flex text-amber-600 hover:bg-amber-50"><Coins className="size-3.5" /></Button>
            </>
          )}
          {r.paidPkrValue > 0 && r.statusCode !== "void" && (
            <Button variant="outline" size="icon-xs" onClick={() => { setRefundTarget(r); setRefundAmount(""); setRefundReason(""); }} title="Issue Refund" className="hidden sm:inline-flex text-rose-600 hover:bg-rose-50"><Undo2 className="size-3.5" /></Button>
          )}
          <Button variant="outline" size="icon-xs" onClick={() => openJournalForInvoice(r)} title="Record Expense (Shipping/Tax)" className="hidden sm:inline-flex text-blue-600 hover:bg-blue-50"><Truck className="size-3.5" /></Button>
          <Button variant="outline" size="icon-xs" onClick={() => downloadPdf(r)} disabled={downloadingId === r.id} title="Download PDF"><Download className="size-3.5" /></Button>
          <Button variant="outline" size="icon-xs" onClick={() => onEdit(r)} title="Edit" className="hidden sm:inline-flex"><Pencil className="size-3.5" /></Button>
          <Button variant="outline" size="icon-xs" className="hidden sm:inline-flex text-destructive hover:bg-destructive/10" onClick={() => onDelete(r)} title="Delete"><Trash2 className="size-3.5" /></Button>
        </div>
      ),
    },
  ];

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
              { label: "Issued", value: "issued" },
              { label: "Partially Paid", value: "partially_paid" },
              { label: "Paid", value: "paid" },
              { label: "Overdue", value: "overdue" },
              { label: "Void", value: "void" },
            ],
            onChange: setStatusFilter,
          }]}
          hasActiveFilters={statusFilter !== "all"}
          onClearAll={() => setStatusFilter("all")}
        />
        <Button size="sm" onClick={onCreate}>
          <Plus className="mr-1.5 size-3.5" /> New Invoice
        </Button>
      </div>

      {/* Mobile: Card layout */}
      <div className="sm:hidden space-y-3">
        {filtered.length === 0 ? (
          <EmptyState icon={ReceiptText} title="No invoices" description="Create your first invoice to start billing." action={<Button size="sm" onClick={onCreate}><Plus className="mr-1.5 size-3.5" /> New Invoice</Button>} />
        ) : (
          filtered.map((inv) => (
            <div key={inv.id} className="rounded-xl border border-border bg-white p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-foreground text-sm">{inv.invoiceNo}</p>
                  <p className="text-xs text-muted-foreground">{inv.customer}</p>
                </div>
                <StatusBadge tone={statusTone(inv.status)}>{inv.status}</StatusBadge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-muted-foreground">Total: </span>
                  <span className="font-semibold">{inv.totalPkr}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Balance: </span>
                  <span className="font-semibold text-rose-700">{inv.balancePkr}</span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground">{inv.issueDate}</p>
                <div className="flex gap-1">
                  {inv.statusCode !== "paid" && inv.statusCode !== "void" && (
                    <Button variant="outline" size="icon-xs" onClick={() => handleApproveFullPayment(inv)} disabled={payingId === inv.id} title="Approve Payment" className="text-emerald-600 hover:bg-emerald-50"><CheckCircle className="size-3.5" /></Button>
                  )}
                  <Button variant="outline" size="icon-xs" onClick={() => openJournalForInvoice(inv)} title="Expenses" className="text-blue-600 hover:bg-blue-50"><Truck className="size-3.5" /></Button>
                  <Button variant="outline" size="icon-xs" onClick={() => downloadPdf(inv)} disabled={downloadingId === inv.id} title="PDF"><Download className="size-3.5" /></Button>
                  <Button variant="outline" size="icon-xs" onClick={() => onEdit(inv)} title="Edit"><Pencil className="size-3.5" /></Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop: Table layout */}
      <div className="hidden sm:block">
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(r) => r.id}
          pageSize={20}
          emptyState={
            <EmptyState icon={ReceiptText} title="No invoices" description="Create your first invoice to start billing." action={<Button size="sm" onClick={onCreate}><Plus className="mr-1.5 size-3.5" /> New Invoice</Button>} />
          }
        />
      </div>

      {/* Partial Payment Modal */}
      <CmsModal
        open={Boolean(partialPaymentTarget)}
        title="Record Partial Payment"
        description={partialPaymentTarget ? `${partialPaymentTarget.invoiceNo} — Balance: ${partialPaymentTarget.balancePkr}` : ""}
        onClose={() => { setPartialPaymentTarget(null); setPartialAmount(""); }}
        footer={
          <>
            <Button variant="outline" onClick={() => setPartialPaymentTarget(null)}>Cancel</Button>
            <Button onClick={handlePartialPayment} disabled={payingId !== null}>
              {payingId ? "Recording..." : "Record Payment"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground mb-1">Total</p>
              <p className="font-semibold">{partialPaymentTarget?.totalPkr}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground mb-1">Already Paid</p>
              <p className="font-semibold text-emerald-600">{partialPaymentTarget?.paidPkr}</p>
            </div>
          </div>
          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment Amount (PKR)</span>
            <input
              type="number"
              min={1}
              max={partialPaymentTarget?.balancePkrValue}
              value={partialAmount}
              onChange={(e) => setPartialAmount(e.target.value)}
              placeholder={`Max: ${partialPaymentTarget?.balancePkrValue?.toLocaleString() ?? 0}`}
              className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              autoFocus
            />
          </label>
        </div>
      </CmsModal>

      {/* Refund Modal */}
      <CmsModal
        open={Boolean(refundTarget)}
        title="Issue Refund"
        description={refundTarget ? `${refundTarget.invoiceNo} — Paid: ${refundTarget.paidPkr}` : ""}
        onClose={() => { setRefundTarget(null); setRefundAmount(""); setRefundReason(""); }}
        footer={
          <>
            <Button variant="outline" onClick={() => setRefundTarget(null)}>Cancel</Button>
            <Button onClick={handleRefund} disabled={payingId !== null}>
              {payingId ? "Refunding..." : "Issue Refund"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            This posts a reversing journal (debit Sales Returns, credit Cash). The original sale journal stays on the books for audit history.
          </p>
          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Refund Amount (PKR)</span>
            <input
              type="number"
              min={1}
              max={refundTarget?.paidPkrValue}
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              placeholder={`Max: ${refundTarget?.paidPkrValue?.toLocaleString() ?? 0}`}
              className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              autoFocus
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reason (optional)</span>
            <input
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="Customer returned product, duplicate charge, etc."
              className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            />
          </label>
        </div>
      </CmsModal>

      {/* Manual Journal Editor for shipping/tax expenses */}
      <ManualJournalEditor
        open={journalEditorOpen}
        accounts={accounts}
        invoices={journalPreselectedInvoice ? [journalPreselectedInvoice] : invoices}
        onClose={() => { setJournalEditorOpen(false); setJournalPreselectedInvoice(null); }}
        onRefresh={onRefresh}
      />
    </div>
  );
}
