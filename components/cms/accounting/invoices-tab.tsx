"use client";

import { useState } from "react";
import { Download, Pencil, Plus, Trash2, ReceiptText } from "lucide-react";
import { toast } from "sonner";

import { DataTable, type Column } from "@/components/cms/ui/data-table";
import { FilterBar } from "@/components/cms/ui/filter-bar";
import { EmptyState } from "@/components/cms/ui/empty-state";
import { StatusBadge } from "@/components/cms/cms-shared";
import { Button } from "@/components/ui/button";
import { nhost, nhostConfigError } from "@/lib/nhost";
import type { CmsInvoice } from "@/lib/cms-data";

function statusTone(status: CmsInvoice["status"]) {
  if (status === "Paid") return "success" as const;
  if (status === "Issued" || status === "Partially Paid" || status === "Draft") return "warning" as const;
  if (status === "Overdue" || status === "Void") return "danger" as const;
  return "neutral" as const;
}

type InvoicesTabProps = {
  invoices: CmsInvoice[];
  onEdit: (invoice: CmsInvoice) => void;
  onDelete: (invoice: CmsInvoice) => void;
  onCreate: () => void;
};

export function InvoicesTab({ invoices, onEdit, onDelete, onCreate }: InvoicesTabProps) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

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
    { key: "invoiceNo", header: "Invoice", sortable: true, sortValue: (r) => r.invoiceNo, render: (r) => <span className="font-medium text-foreground">{r.invoiceNo}</span> },
    { key: "customer", header: "Customer", sortable: true, sortValue: (r) => r.customer, hideBelow: "sm", render: (r) => <span className="text-foreground">{r.customer}</span> },
    { key: "status", header: "Status", sortable: true, sortValue: (r) => r.status, render: (r) => <StatusBadge tone={statusTone(r.status)}>{r.status}</StatusBadge> },
    { key: "total", header: "Total", align: "right", sortable: true, sortValue: (r) => r.totalPkrValue, render: (r) => <span className="font-medium tabular-nums">{r.totalPkr}</span> },
    { key: "paid", header: "Paid", align: "right", sortable: true, sortValue: (r) => r.paidPkrValue, hideBelow: "sm", render: (r) => <span className="tabular-nums text-emerald-700">{r.paidPkr}</span> },
    { key: "balance", header: "Balance", align: "right", sortable: true, sortValue: (r) => r.balancePkrValue, hideBelow: "sm", render: (r) => <span className="tabular-nums text-rose-700">{r.balancePkr}</span> },
    { key: "issueDate", header: "Issued", sortable: true, sortValue: (r) => r.issueDateValue, hideBelow: "md", render: (r) => <span className="text-muted-foreground">{r.issueDate}</span> },
    { key: "dueDate", header: "Due", hideBelow: "md", render: (r) => <span className="text-muted-foreground">{r.dueDate}</span> },
    {
      key: "actions", header: "Actions", align: "right",
      render: (r) => (
        <div className="flex justify-end gap-1">
          <Button variant="outline" size="icon-xs" onClick={() => downloadPdf(r)} disabled={downloadingId === r.id} title="PDF"><Download className="size-3.5" /></Button>
          <Button variant="outline" size="icon-xs" onClick={() => onEdit(r)} title="Edit"><Pencil className="size-3.5" /></Button>
          <Button variant="outline" size="icon-xs" className="text-destructive hover:bg-destructive/10" onClick={() => onDelete(r)} title="Delete"><Trash2 className="size-3.5" /></Button>
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
  );
}
