"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { CmsModal } from "@/components/cms/cms-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/cms/ui/input";
import { Select } from "@/components/cms/ui/select";
import { Textarea } from "@/components/cms/ui/textarea";
import type { CmsInvoice, CmsOrder, CmsPaymentMethod, CmsProduct } from "@/lib/cms-data";
import {
  createInvoice,
  updateInvoice,
  type InvoiceLinePayload,
  type InvoicePayload,
  type InvoiceStatusCode,
} from "@/components/cms/accounting/invoice-api";

type LineDraft = { key: string; productId: string; description: string; quantity: number; unitPricePkr: number; originalPricePkr: number; discountPercent: number; ourCostPkr: number };
type InvoiceDraft = {
  invoiceNo: string; orderId: string; customerName: string; customerEmail: string;
  issueDate: string; dueDate: string; discountPkr: number; extraDiscountPercent: number; shippingPkr: number; taxPercent: number; paidPkr: number;
  status: InvoiceStatusCode; notes: string; syncJournal: boolean; lines: LineDraft[];
  paymentMethodId: string;
};

function money(v: number) { return `PKR ${Math.max(0, v).toLocaleString()}`; }
function today() { return new Date().toISOString().slice(0, 10); }
function genInvNo() {
  const n = new Date();
  return `INV-${n.getFullYear()}${String(n.getMonth() + 1).padStart(2, "0")}${String(n.getDate()).padStart(2, "0")}-${String(n.getHours()).padStart(2, "0")}${String(n.getMinutes()).padStart(2, "0")}${String(n.getSeconds()).padStart(2, "0")}`;
}
function emptyLine(): LineDraft { return { key: crypto.randomUUID(), productId: "", description: "", quantity: 1, unitPricePkr: 0, originalPricePkr: 0, discountPercent: 0, ourCostPkr: 0 }; }

function draftFrom(inv: CmsInvoice | null): InvoiceDraft {
  if (!inv) return { invoiceNo: genInvNo(), orderId: "", customerName: "", customerEmail: "", issueDate: today(), dueDate: "", discountPkr: 0, extraDiscountPercent: 0, shippingPkr: 0, taxPercent: 0, paidPkr: 0, status: "draft", notes: "", syncJournal: true, lines: [emptyLine()], paymentMethodId: "" };
  return {
    invoiceNo: inv.invoiceNo, orderId: inv.orderId ?? "", customerName: inv.customerName, customerEmail: inv.customerEmail,
    issueDate: inv.issueDateValue || today(), dueDate: inv.dueDateValue ?? "",
    discountPkr: inv.discountPkrValue, extraDiscountPercent: 0, shippingPkr: (inv as any).shippingPkrValue ?? 0, taxPercent: 0, paidPkr: inv.paidPkrValue,
    status: inv.statusCode, notes: inv.notes, syncJournal: true,
    lines: inv.lines.length ? inv.lines.map((l) => ({ key: l.id || crypto.randomUUID(), productId: l.productId ?? "", description: l.description, quantity: l.quantity, unitPricePkr: l.unitPricePkr, originalPricePkr: l.unitPricePkr, discountPercent: 0, ourCostPkr: l.ourCostPkr ?? 0 })) : [emptyLine()],
    paymentMethodId: inv.paymentMethodId ?? "",
  };
}

type Props = {
  open: boolean; editing: CmsInvoice | null; orders: CmsOrder[];
  paymentMethods?: CmsPaymentMethod[];
  products?: CmsProduct[];
  prefillOrderId?: string;
  onClose: () => void; onRefresh?: () => void;
};

export function InvoiceEditor({ open, editing, orders, paymentMethods = [], products = [], prefillOrderId, onClose, onRefresh }: Props) {
  const [draft, setDraft] = useState<InvoiceDraft>(() => draftFrom(editing));
  const [appliedPrefill, setAppliedPrefill] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const sub = draft.lines.reduce((s, l) => s + l.quantity * l.unitPricePkr, 0);
  const extraDiscountAmount = draft.extraDiscountPercent > 0 ? Math.round(sub * draft.extraDiscountPercent / 100 * 100) / 100 : 0;
  const totalDiscount = draft.discountPkr + extraDiscountAmount;
  const afterDiscount = Math.max(0, sub - totalDiscount);
  const taxAmount = draft.taxPercent > 0 ? Math.round(afterDiscount * draft.taxPercent / 100 * 100) / 100 : 0;
  const total = Math.max(0, afterDiscount + draft.shippingPkr + taxAmount);
  const paid = Math.max(0, Math.min(draft.paidPkr, total));
  const balance = Math.max(0, total - paid);

  const set = <K extends keyof InvoiceDraft>(k: K, v: InvoiceDraft[K]) => setDraft((c) => ({ ...c, [k]: v }));

  const applyOrder = (orderId: string) => {
    const o = orders.find((r) => r.orderId === orderId);
    if (!o) { set("orderId", orderId); return; }
    const lines: LineDraft[] = o.items.length
      ? o.items.map((it) => {
          // Use the price from the ORDER (snapshot at time of purchase), not the live catalog
          // The order's unit_price is the final price the customer paid per unit
          const orderPrice = it.unitPricePkr;

          // Look up original catalog price only to calculate what discount was applied at purchase
          const product = products.find((p) => p.productId === it.productId);
          const catalogPrice = product ? product.priceValue : orderPrice;

          // If the order price is lower than catalog price, a discount was applied at checkout
          const hasDiscount = catalogPrice > 0 && orderPrice < catalogPrice;
          const discountPct = hasDiscount ? Math.round((1 - orderPrice / catalogPrice) * 100) : 0;

          return {
            key: it.id || crypto.randomUUID(),
            productId: it.productId ?? "",
            description: it.productName,
            quantity: it.quantity,
            unitPricePkr: orderPrice,
            originalPricePkr: hasDiscount ? catalogPrice : orderPrice,
            discountPercent: discountPct,
            ourCostPkr: product?.ourPriceValue ?? 0,
          };
        })
      : [emptyLine()];
    setDraft((c) => ({ ...c, orderId, customerName: o.customer.name, customerEmail: o.customer.email === "No email" ? "" : o.customer.email, discountPkr: o.discountPkr, shippingPkr: o.shippingPkr, lines }));
  };

  const save = async () => {
    const lines: InvoiceLinePayload[] = draft.lines
      .map((l) => {
        const desc = l.discountPercent > 0
          ? `${l.description.trim()} (${l.discountPercent}% off PKR ${l.originalPricePkr.toLocaleString()})`
          : l.description.trim();
        return {
          product_id: l.productId || null,
          description: desc,
          quantity: Math.max(1, l.quantity),
          unit_price_pkr: Math.max(0, l.unitPricePkr),
          line_total_pkr: Math.max(1, l.quantity) * Math.max(0, l.unitPricePkr),
          our_cost_pkr: Math.max(0, l.ourCostPkr),
        };
      })
      .filter((l) => l.description.length > 0);

    if (!draft.invoiceNo.trim()) { setError("Invoice number is required."); return; }
    if (!draft.customerName.trim()) { setError("Customer name is required."); return; }
    if (!lines.length) { setError("At least one line is required."); return; }
    if (!draft.issueDate) { setError("Issue date is required."); return; }

    const payload: InvoicePayload = {
      invoice_no: draft.invoiceNo.trim(), order_id: draft.orderId || null, customer_profile_id: null,
      customer_name: draft.customerName.trim(), customer_email: draft.customerEmail.trim() || null,
      issue_date: draft.issueDate, due_date: draft.dueDate || null,
      subtotal_pkr: Number(sub.toFixed(2)), discount_pkr: Number(totalDiscount.toFixed(2)),
      shipping_pkr: Number(draft.shippingPkr.toFixed(2)), tax_pkr: Number(taxAmount.toFixed(2)), total_pkr: Number(total.toFixed(2)),
      paid_pkr: Number(paid.toFixed(2)), balance_pkr: Number(balance.toFixed(2)),
      status: draft.status, notes: draft.notes.trim() || null,
      payment_method_id: draft.paymentMethodId || null,
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
  // Auto-apply order when opened from orders section
  if (open && prefillOrderId && prefillOrderId !== appliedPrefill && !editing) {
    setAppliedPrefill(prefillOrderId);
    applyOrder(prefillOrderId);
  }
  if (!open && appliedPrefill) {
    setAppliedPrefill(null);
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
        <Select label="Payment Method" value={draft.paymentMethodId} onChange={(e) => set("paymentMethodId", e.target.value)}>
          <option value="">No payment method</option>
          {paymentMethods.filter((pm) => pm.isActive).map((pm) => (
            <option key={pm.id} value={pm.id}>{pm.name}{pm.accountNumber ? ` (${pm.accountNumber})` : ""}</option>
          ))}
        </Select>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Lines</p>
          <Button variant="outline" size="sm" onClick={() => setDraft((c) => ({ ...c, lines: [...c.lines, emptyLine()] }))}>
            <Plus className="mr-1 size-3.5" /> Add
          </Button>
        </div>
        {draft.lines.map((line, idx) => {
          const inputCls = "h-8 w-full rounded-md border border-border bg-background px-2 text-sm tabular-nums outline-none focus:border-ring focus:ring-2 focus:ring-ring/20";
          const handleLineChange = (field: Partial<LineDraft>) => {
            setDraft((c) => ({
              ...c,
              lines: c.lines.map((l, i) => {
                if (i !== idx) return l;
                const updated = { ...l, ...field };
                if ("originalPricePkr" in field || "discountPercent" in field) {
                  updated.unitPricePkr = Math.round(updated.originalPricePkr * (1 - updated.discountPercent / 100) * 100) / 100;
                }
                return updated;
              }),
            }));
          };
          return (
            <div key={line.key} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input value={line.description} onChange={(e) => handleLineChange({ description: e.target.value })} className={`${inputCls} flex-1 text-left`} placeholder="Description" />
                <button type="button" onClick={() => setDraft((c) => ({ ...c, lines: c.lines.length > 1 ? c.lines.filter((_, i) => i !== idx) : c.lines }))} className="text-muted-foreground hover:text-destructive shrink-0"><Trash2 className="size-4" /></button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground mb-1">Price</p>
                  <input type="number" min={0} step="0.01" value={line.originalPricePkr} onChange={(e) => handleLineChange({ originalPricePkr: Number(e.target.value || 0) })} className={`${inputCls} text-right`} />
                </div>
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground mb-1">Our Cost</p>
                  <input type="number" min={0} step="0.01" value={line.ourCostPkr} onChange={(e) => handleLineChange({ ourCostPkr: Number(e.target.value || 0) })} className={`${inputCls} text-right`} />
                </div>
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground mb-1">Disc%</p>
                  <input type="number" min={0} max={100} step="1" value={line.discountPercent} onChange={(e) => handleLineChange({ discountPercent: Number(e.target.value || 0) })} className={`${inputCls} text-right`} />
                </div>
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground mb-1">Qty</p>
                  <input type="number" min={1} value={line.quantity} onChange={(e) => handleLineChange({ quantity: Number(e.target.value || 1) })} className={`${inputCls} text-right`} />
                </div>
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground mb-1">Total</p>
                  <div className="h-8 flex items-center justify-end text-sm font-semibold tabular-nums">{money(line.quantity * line.unitPricePkr)}</div>
                </div>
              </div>
              {line.discountPercent > 0 && (
                <p className="text-[11px] text-muted-foreground">Net: {money(line.unitPricePkr)} per unit</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Input label="Flat Discount (PKR)" type="number" min={0} step="0.01" value={draft.discountPkr} onChange={(e) => set("discountPkr", Number(e.target.value || 0))} />
        <Input label="Extra Discount (%)" type="number" min={0} max={100} step="1" value={draft.extraDiscountPercent} onChange={(e) => set("extraDiscountPercent", Number(e.target.value || 0))} />
        <Input label="Shipping (PKR)" type="number" min={0} step="0.01" value={draft.shippingPkr} onChange={(e) => set("shippingPkr", Number(e.target.value || 0))} />
        <Input label="Tax (%)" type="number" min={0} max={100} step="0.5" value={draft.taxPercent} onChange={(e) => set("taxPercent", Number(e.target.value || 0))} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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

      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
        <div className="w-full space-y-1 sm:ml-auto sm:w-64">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{money(sub)}</span></div>
          {totalDiscount > 0 && (
            <div className="flex justify-between text-destructive">
              <span>Discount{draft.extraDiscountPercent > 0 ? ` (${draft.extraDiscountPercent}%)` : ""}</span>
              <span className="tabular-nums">-{money(totalDiscount)}</span>
            </div>
          )}
          {draft.shippingPkr > 0 && (
            <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span className="tabular-nums">+{money(draft.shippingPkr)}</span></div>
          )}
          {taxAmount > 0 && (
            <div className="flex justify-between"><span className="text-muted-foreground">Tax ({draft.taxPercent}%)</span><span className="tabular-nums">+{money(taxAmount)}</span></div>
          )}
          <div className="flex justify-between border-t border-border pt-1 font-semibold"><span>Total</span><span className="tabular-nums">{money(total)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span className="tabular-nums text-emerald-600">{money(paid)}</span></div>
          <div className="flex justify-between font-semibold text-primary"><span>Balance Due</span><span className="tabular-nums">{money(balance)}</span></div>
        </div>
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
