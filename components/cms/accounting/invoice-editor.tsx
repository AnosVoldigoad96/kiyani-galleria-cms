"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { CmsModal } from "@/components/cms/cms-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/cms/ui/input";
import { Select } from "@/components/cms/ui/select";
import { Textarea } from "@/components/cms/ui/textarea";
import type { CmsInvoice, CmsOrder } from "@/lib/cms-data";
import {
  createInvoice,
  updateInvoice,
  type InvoiceLinePayload,
  type InvoicePayload,
  type InvoiceStatusCode,
} from "@/components/cms/accounting/invoice-api";

type LineDraft = { key: string; productId: string; description: string; quantity: number; unitPricePkr: number };
type InvoiceDraft = {
  invoiceNo: string; orderId: string; customerName: string; customerEmail: string;
  issueDate: string; dueDate: string; discountPkr: number; taxPkr: number; paidPkr: number;
  status: InvoiceStatusCode; notes: string; syncJournal: boolean; lines: LineDraft[];
};

function money(v: number) { return `PKR ${Math.max(0, v).toLocaleString()}`; }
function today() { return new Date().toISOString().slice(0, 10); }
function genInvNo() {
  const n = new Date();
  return `INV-${n.getFullYear()}${String(n.getMonth() + 1).padStart(2, "0")}${String(n.getDate()).padStart(2, "0")}-${String(n.getHours()).padStart(2, "0")}${String(n.getMinutes()).padStart(2, "0")}${String(n.getSeconds()).padStart(2, "0")}`;
}
function emptyLine(): LineDraft { return { key: crypto.randomUUID(), productId: "", description: "", quantity: 1, unitPricePkr: 0 }; }

function draftFrom(inv: CmsInvoice | null): InvoiceDraft {
  if (!inv) return { invoiceNo: genInvNo(), orderId: "", customerName: "", customerEmail: "", issueDate: today(), dueDate: "", discountPkr: 0, taxPkr: 0, paidPkr: 0, status: "draft", notes: "", syncJournal: true, lines: [emptyLine()] };
  return {
    invoiceNo: inv.invoiceNo, orderId: inv.orderId ?? "", customerName: inv.customerName, customerEmail: inv.customerEmail,
    issueDate: inv.issueDateValue || today(), dueDate: inv.dueDateValue ?? "",
    discountPkr: inv.discountPkrValue, taxPkr: inv.taxPkrValue, paidPkr: inv.paidPkrValue,
    status: inv.statusCode, notes: inv.notes, syncJournal: true,
    lines: inv.lines.length ? inv.lines.map((l) => ({ key: l.id || crypto.randomUUID(), productId: l.productId ?? "", description: l.description, quantity: l.quantity, unitPricePkr: l.unitPricePkr })) : [emptyLine()],
  };
}

type Props = {
  open: boolean; editing: CmsInvoice | null; orders: CmsOrder[];
  onClose: () => void; onRefresh?: () => void;
};

export function InvoiceEditor({ open, editing, orders, onClose, onRefresh }: Props) {
  const [draft, setDraft] = useState<InvoiceDraft>(() => draftFrom(editing));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const sub = draft.lines.reduce((s, l) => s + l.quantity * l.unitPricePkr, 0);
  const total = Math.max(0, sub - draft.discountPkr + draft.taxPkr);
  const paid = Math.max(0, Math.min(draft.paidPkr, total));
  const balance = Math.max(0, total - paid);

  const set = <K extends keyof InvoiceDraft>(k: K, v: InvoiceDraft[K]) => setDraft((c) => ({ ...c, [k]: v }));

  const applyOrder = (orderId: string) => {
    const o = orders.find((r) => r.orderId === orderId);
    if (!o) { set("orderId", orderId); return; }
    const lines: LineDraft[] = o.items.length
      ? o.items.map((it) => ({ key: it.id || crypto.randomUUID(), productId: it.productId ?? "", description: it.productName, quantity: it.quantity, unitPricePkr: it.unitPricePkr }))
      : [emptyLine()];
    setDraft((c) => ({ ...c, orderId, customerName: o.customer.name, customerEmail: o.customer.email === "No email" ? "" : o.customer.email, discountPkr: o.discountPkr, lines }));
  };

  const save = async () => {
    const lines: InvoiceLinePayload[] = draft.lines
      .map((l) => ({ product_id: l.productId || null, description: l.description.trim(), quantity: Math.max(1, l.quantity), unit_price_pkr: Math.max(0, l.unitPricePkr), line_total_pkr: Math.max(1, l.quantity) * Math.max(0, l.unitPricePkr) }))
      .filter((l) => l.description.length > 0);

    if (!draft.invoiceNo.trim()) { setError("Invoice number is required."); return; }
    if (!draft.customerName.trim()) { setError("Customer name is required."); return; }
    if (!lines.length) { setError("At least one line is required."); return; }
    if (!draft.issueDate) { setError("Issue date is required."); return; }

    const payload: InvoicePayload = {
      invoice_no: draft.invoiceNo.trim(), order_id: draft.orderId || null, customer_profile_id: null,
      customer_name: draft.customerName.trim(), customer_email: draft.customerEmail.trim() || null,
      issue_date: draft.issueDate, due_date: draft.dueDate || null,
      subtotal_pkr: Number(sub.toFixed(2)), discount_pkr: Number(draft.discountPkr.toFixed(2)),
      tax_pkr: Number(draft.taxPkr.toFixed(2)), total_pkr: Number(total.toFixed(2)),
      paid_pkr: Number(paid.toFixed(2)), balance_pkr: Number(balance.toFixed(2)),
      status: draft.status, notes: draft.notes.trim() || null,
    };

    setSaving(true); setError(null);
    try {
      if (editing) { await updateInvoice(editing.id, payload, lines, draft.syncJournal); toast.success("Invoice updated."); }
      else { await createInvoice(payload, lines, draft.syncJournal); toast.success("Invoice created."); }
      onClose(); onRefresh?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save.";
      setError(msg); toast.error(msg);
    } finally { setSaving(false); }
  };

  // Sync draft when editing changes
  if (open && editing && draft.invoiceNo !== editing.invoiceNo) { setDraft(draftFrom(editing)); }
  if (open && !editing && draft.invoiceNo.startsWith("INV-") && draft.customerName === "" && draft.lines.length === 1 && draft.lines[0].description === "") {
    // already fresh
  }

  return (
    <CmsModal
      open={open}
      title={editing ? "Edit Invoice" : "New Invoice"}
      description="Manage invoice details, line items, and journal sync."
      onClose={() => { onClose(); setError(null); }}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving..." : editing ? "Update" : "Create"}</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Invoice No" value={draft.invoiceNo} onChange={(e) => set("invoiceNo", e.target.value)} />
        <Select label="Linked Order" value={draft.orderId} onChange={(e) => applyOrder(e.target.value)}>
          <option value="">Standalone</option>
          {orders.map((o) => <option key={o.orderId} value={o.orderId}>{o.orderNo} - {o.customer.name}</option>)}
        </Select>
        <Input label="Customer Name" value={draft.customerName} onChange={(e) => set("customerName", e.target.value)} />
        <Input label="Customer Email" type="email" value={draft.customerEmail} onChange={(e) => set("customerEmail", e.target.value)} />
        <Input label="Issue Date" type="date" value={draft.issueDate} onChange={(e) => set("issueDate", e.target.value)} />
        <Input label="Due Date" type="date" value={draft.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Lines</p>
          <Button variant="outline" size="sm" onClick={() => setDraft((c) => ({ ...c, lines: [...c.lines, emptyLine()] }))}>
            <Plus className="mr-1 size-3.5" /> Add
          </Button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Description</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground w-20">Qty</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground w-28">Price</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground w-28">Total</th>
                <th className="px-3 py-2 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {draft.lines.map((line, idx) => (
                <tr key={line.key}>
                  <td className="px-3 py-2"><input value={line.description} onChange={(e) => setDraft((c) => ({ ...c, lines: c.lines.map((l, i) => i === idx ? { ...l, description: e.target.value } : l) }))} className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20" placeholder="Description" /></td>
                  <td className="px-3 py-2"><input type="number" min={1} value={line.quantity} onChange={(e) => setDraft((c) => ({ ...c, lines: c.lines.map((l, i) => i === idx ? { ...l, quantity: Number(e.target.value || 1) } : l) }))} className="h-8 w-full rounded-md border border-border bg-background px-2 text-right text-sm tabular-nums outline-none focus:border-ring focus:ring-2 focus:ring-ring/20" /></td>
                  <td className="px-3 py-2"><input type="number" min={0} step="0.01" value={line.unitPricePkr} onChange={(e) => setDraft((c) => ({ ...c, lines: c.lines.map((l, i) => i === idx ? { ...l, unitPricePkr: Number(e.target.value || 0) } : l) }))} className="h-8 w-full rounded-md border border-border bg-background px-2 text-right text-sm tabular-nums outline-none focus:border-ring focus:ring-2 focus:ring-ring/20" /></td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{money(line.quantity * line.unitPricePkr)}</td>
                  <td className="px-3 py-2"><button type="button" onClick={() => setDraft((c) => ({ ...c, lines: c.lines.length > 1 ? c.lines.filter((_, i) => i !== idx) : c.lines }))} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Discount" type="number" min={0} step="0.01" value={draft.discountPkr} onChange={(e) => set("discountPkr", Number(e.target.value || 0))} />
        <Input label="Tax" type="number" min={0} step="0.01" value={draft.taxPkr} onChange={(e) => set("taxPkr", Number(e.target.value || 0))} />
        <Input label="Paid Amount" type="number" min={0} step="0.01" value={draft.paidPkr} onChange={(e) => set("paidPkr", Number(e.target.value || 0))} />
        <Select label="Status" value={draft.status} onChange={(e) => set("status", e.target.value as InvoiceStatusCode)}>
          <option value="draft">Draft</option>
          <option value="issued">Issued</option>
          <option value="partially_paid">Partially Paid</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="void">Void</option>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm space-y-0.5">
        <p>Subtotal: {money(sub)}</p>
        <p>Total: {money(total)}</p>
        <p>Paid: {money(paid)}</p>
        <p className="font-semibold">Balance: {money(balance)}</p>
      </div>

      <Textarea label="Notes" value={draft.notes} onChange={(e) => set("notes", e.target.value)} />

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" checked={draft.syncJournal} onChange={(e) => set("syncJournal", e.target.checked)} className="size-4 rounded border-border" />
        Sync journal posting
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </CmsModal>
  );
}
