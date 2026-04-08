"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { CmsModal } from "@/components/cms/cms-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/cms/ui/input";
import { Select } from "@/components/cms/ui/select";
import { Textarea } from "@/components/cms/ui/textarea";
import type { CmsOrder, CmsProduct } from "@/lib/cms-data";
import {
  createOrder,
  updateOrder,
  type OrderFulfillmentStatus,
  type OrderItemPayload,
  type OrderPaymentStatus,
  type OrderPayload,
} from "@/components/cms/orders/orders-api";
import { cn } from "@/lib/utils";

type OrderDraftItem = {
  key: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPricePkr: number;
  ourCostPkr: number;
};

type OrderDraft = {
  orderId?: string;
  orderNo: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  city: string;
  address: string;
  paymentStatus: OrderPaymentStatus;
  fulfillmentStatus: OrderFulfillmentStatus;
  discountPkr: number;
  shippingPkr: number;
  notes: string;
  syncAccounting: boolean;
  items: OrderDraftItem[];
};

function money(v: number) { return `PKR ${Math.max(0, v).toLocaleString()}`; }

function generateOrderNo() {
  const n = new Date();
  return `ORD-${n.getFullYear()}${String(n.getMonth() + 1).padStart(2, "0")}${String(n.getDate()).padStart(2, "0")}-${String(n.getHours()).padStart(2, "0")}${String(n.getMinutes()).padStart(2, "0")}${String(n.getSeconds()).padStart(2, "0")}`;
}

function createEmptyItem(): OrderDraftItem {
  return { key: crypto.randomUUID(), productId: "", productName: "", sku: "", quantity: 1, unitPricePkr: 0, ourCostPkr: 0 };
}

export function buildOrderDraft(order: CmsOrder | null, products: CmsProduct[]): OrderDraft {
  if (!order) {
    return {
      orderNo: generateOrderNo(), customerName: "", customerEmail: "", customerPhone: "",
      city: "", address: "", paymentStatus: "pending", fulfillmentStatus: "processing",
      discountPkr: 0, shippingPkr: 0, notes: "", syncAccounting: false,
      items: [createEmptyItem()],
    };
  }
  return {
    orderId: order.orderId, orderNo: order.orderNo,
    customerName: order.customer.name,
    customerEmail: order.customer.email === "No email" ? "" : order.customer.email,
    customerPhone: order.customer.phone, city: order.customer.city === "Unknown" ? "" : order.customer.city,
    address: order.customer.address, paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus, discountPkr: order.discountPkr,
    shippingPkr: order.shippingPkr, notes: order.notes, syncAccounting: true,
    items: order.items.length
      ? order.items.map((it) => {
          const product = products.find((p) => p.productId === it.productId);
          return { key: it.id || crypto.randomUUID(), productId: it.productId ?? "", productName: it.productName, sku: it.sku === "N/A" ? "" : it.sku, quantity: it.quantity, unitPricePkr: it.unitPricePkr, ourCostPkr: product?.ourPriceValue ?? 0 };
        })
      : [createEmptyItem()],
  };
}

export type RequestPrefill = {
  orderNo: string;
  userId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notes: string;
  budgetPkr: number;
};

type OrderEditorProps = {
  open: boolean;
  editingOrder: CmsOrder | null;
  products: CmsProduct[];
  prefillFromRequest?: RequestPrefill | null;
  onClose: () => void;
  onRefresh?: () => void;
};

const STEPS = ["Customer", "Items", "Review"] as const;

export function OrderEditor({ open, editingOrder, products, prefillFromRequest, onClose, onRefresh }: OrderEditorProps) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<OrderDraft>(() => buildOrderDraft(editingOrder, products));
  const [appliedPrefill, setAppliedPrefill] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const resetAndOpen = (order: CmsOrder | null) => {
    setDraft(buildOrderDraft(order, products));
    setStep(0);
    setError(null);
  };

  // Reset when open changes — but skip if we have a request prefill pending
  if (open && step === 0 && !editingOrder && !prefillFromRequest && draft.orderNo !== buildOrderDraft(null, products).orderNo) {
    resetAndOpen(null);
  }

  // Apply request prefill — overrides the fresh draft
  if (open && prefillFromRequest && prefillFromRequest.orderNo !== appliedPrefill && !editingOrder) {
    setAppliedPrefill(prefillFromRequest.orderNo);
    const fresh = buildOrderDraft(null, products);
    setDraft({
      ...fresh,
      orderNo: prefillFromRequest.orderNo,
      customerName: prefillFromRequest.customerName || "",
      customerEmail: prefillFromRequest.customerEmail || "",
      customerPhone: prefillFromRequest.customerPhone || "",
      notes: prefillFromRequest.notes || "",
      syncAccounting: false,
      items: [createEmptyItem()],
    });
    setStep(0);
  }
  if (!open && appliedPrefill) {
    setAppliedPrefill(null);
  }

  const subtotal = draft.items.reduce((s, it) => s + it.quantity * it.unitPricePkr, 0);
  const total = Math.max(0, subtotal - draft.discountPkr + draft.shippingPkr);

  const set = <K extends keyof OrderDraft>(key: K, value: OrderDraft[K]) =>
    setDraft((c) => ({ ...c, [key]: value }));

  const handleProductPick = (idx: number, productId: string) => {
    const p = products.find((r) => r.productId === productId);
    setDraft((c) => ({
      ...c,
      items: c.items.map((it, i) =>
        i !== idx ? it : { ...it, productId, productName: p?.name ?? it.productName, sku: p?.id ?? it.sku, unitPricePkr: p?.priceValue ?? it.unitPricePkr, ourCostPkr: p?.ourPriceValue ?? it.ourCostPkr },
      ),
    }));
  };

  const setItemField = (idx: number, field: keyof OrderDraftItem, value: string | number) =>
    setDraft((c) => ({ ...c, items: c.items.map((it, i) => (i !== idx ? it : { ...it, [field]: value })) }));

  const handleSave = async () => {
    const items: OrderItemPayload[] = draft.items
      .map((it) => ({ product_id: it.productId || null, product_name: it.productName.trim(), sku: it.sku.trim() || null, quantity: Math.max(1, it.quantity), unit_price_pkr: Math.max(0, it.unitPricePkr), total_price_pkr: Math.max(1, it.quantity) * Math.max(0, it.unitPricePkr) }))
      .filter((it) => it.product_name.length > 0);

    if (!draft.orderNo.trim()) { setError("Order number is required."); return; }
    if (!draft.customerName.trim()) { setError("Customer name is required."); setStep(0); return; }
    if (!items.length) { setError("At least one valid item is required."); setStep(1); return; }

    const payload: OrderPayload = {
      order_no: draft.orderNo.trim(), customer_name: draft.customerName.trim(),
      customer_email: draft.customerEmail.trim() || null, customer_phone: draft.customerPhone.trim() || null,
      city: draft.city.trim() || null, address: draft.address.trim() || null,
      payment_status: draft.paymentStatus, fulfillment_status: draft.fulfillmentStatus,
      subtotal_pkr: Number(subtotal.toFixed(2)), discount_pkr: Number(draft.discountPkr.toFixed(2)),
      shipping_pkr: Number(draft.shippingPkr.toFixed(2)), total_pkr: Number(total.toFixed(2)),
      notes: draft.notes.trim() || null,
      // Pass user_id from request prefill when converting request → order
      ...(prefillFromRequest?.userId ? { user_id: prefillFromRequest.userId } : {}),
    };

    setIsSaving(true); setError(null);
    try {
      if (editingOrder?.orderId) {
        await updateOrder(editingOrder.orderId, payload, items, draft.syncAccounting);
        toast.success("Order updated.");
      } else {
        await createOrder(payload, items, draft.syncAccounting);
        toast.success("Order created.");
      }
      onClose();
      onRefresh?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save order.";
      setError(msg); toast.error(msg);
    } finally { setIsSaving(false); }
  };

  return (
    <CmsModal
      open={open}
      title={editingOrder ? "Edit Order" : "New Order"}
      description={`Step ${step + 1} of 3: ${STEPS[step]}`}
      onClose={() => { onClose(); setError(null); }}
      footer={
        <>
          {step > 0 && (
            <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)} disabled={isSaving}>
              Back
            </Button>
          )}
          <div className="flex-1" />
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
          {step < 2 ? (
            <Button type="button" onClick={() => setStep((s) => s + 1)}>Continue</Button>
          ) : (
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : editingOrder ? "Update Order" : "Create Order"}
            </Button>
          )}
        </>
      }
    >
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-4">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(i)}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              i === step ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className={cn("flex size-5 items-center justify-center rounded-full text-xs", i === step ? "bg-primary-foreground text-primary" : "bg-muted")}>{i + 1}</span>
            {label}
          </button>
        ))}
      </div>

      {/* Step 1: Customer */}
      {step === 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Order No" value={draft.orderNo} onChange={(e) => set("orderNo", e.target.value)} />
          <Input label="Customer Name" value={draft.customerName} onChange={(e) => set("customerName", e.target.value)} />
          <Input label="Email" type="email" value={draft.customerEmail} onChange={(e) => set("customerEmail", e.target.value)} />
          <Input label="Phone" value={draft.customerPhone} onChange={(e) => set("customerPhone", e.target.value)} />
          <Input label="City" value={draft.city} onChange={(e) => set("city", e.target.value)} />
          <Input label="Address" value={draft.address} onChange={(e) => set("address", e.target.value)} />
        </div>
      )}

      {/* Step 2: Items */}
      {step === 1 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Line Items</p>
            <Button type="button" variant="outline" size="sm" onClick={() => setDraft((c) => ({ ...c, items: [...c.items, createEmptyItem()] }))}>
              <Plus className="mr-1 size-3.5" /> Add
            </Button>
          </div>

          <div className="space-y-3">
            {draft.items.map((item, idx) => {
              const inputCls = "h-8 w-full rounded-md border border-border bg-background px-2 text-sm tabular-nums outline-none focus:border-ring focus:ring-2 focus:ring-ring/20";
              return (
                <div key={item.key} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <select
                      value={item.productId}
                      onChange={(e) => handleProductPick(idx, e.target.value)}
                      className={`${inputCls} flex-1 text-left`}
                    >
                      <option value="">Manual item</option>
                      {products.map((p) => (
                        <option key={p.productId} value={p.productId}>{p.name}</option>
                      ))}
                    </select>
                    <button type="button" onClick={() => setDraft((c) => ({ ...c, items: c.items.length > 1 ? c.items.filter((_, i) => i !== idx) : c.items }))} className="text-muted-foreground hover:text-destructive shrink-0">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground mb-1">Description</p>
                      <input value={item.productName} onChange={(e) => setItemField(idx, "productName", e.target.value)} className={`${inputCls} text-left`} placeholder="Item name" />
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground mb-1">SKU</p>
                      <input value={item.sku} onChange={(e) => setItemField(idx, "sku", e.target.value)} className={`${inputCls} text-left`} placeholder="SKU" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground mb-1">Price</p>
                      <input type="number" min={0} step="0.01" value={item.unitPricePkr} onChange={(e) => setItemField(idx, "unitPricePkr", Number(e.target.value || 0))} className={`${inputCls} text-right`} />
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground mb-1">Our Cost</p>
                      <input type="number" min={0} step="0.01" value={item.ourCostPkr} onChange={(e) => setItemField(idx, "ourCostPkr", Number(e.target.value || 0))} className={`${inputCls} text-right`} />
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground mb-1">Qty</p>
                      <input type="number" min={1} value={item.quantity} onChange={(e) => setItemField(idx, "quantity", Number(e.target.value || 1))} className={`${inputCls} text-right`} />
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground mb-1">Total</p>
                      <div className="h-8 flex items-center justify-end text-sm font-semibold tabular-nums">{money(item.quantity * item.unitPricePkr)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Payment Status" value={draft.paymentStatus} onChange={(e) => set("paymentStatus", e.target.value as OrderPaymentStatus)}>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </Select>
            <Select label="Fulfillment Status" value={draft.fulfillmentStatus} onChange={(e) => set("fulfillmentStatus", e.target.value as OrderFulfillmentStatus)}>
              <option value="processing">Processing</option>
              <option value="packed">Packed</option>
              <option value="dispatched">Dispatched</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Discount (PKR)" type="number" min={0} step="0.01" value={draft.discountPkr} onChange={(e) => set("discountPkr", Number(e.target.value || 0))} />
            <Input label="Shipping (PKR)" type="number" min={0} step="0.01" value={draft.shippingPkr} onChange={(e) => set("shippingPkr", Number(e.target.value || 0))} />
            <div className="rounded-lg border border-border bg-muted/50 px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground">Totals</p>
              <p className="mt-1 text-sm">Subtotal: {money(subtotal)}</p>
              <p className="text-sm font-semibold">Total: {money(total)}</p>
            </div>
          </div>

          <Textarea label="Notes" value={draft.notes} onChange={(e) => set("notes", e.target.value)} />

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={draft.syncAccounting}
              onChange={(e) => set("syncAccounting", e.target.checked)}
              className="size-4 rounded border-border"
            />
            Sync with accounting (invoice + journal)
          </label>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </CmsModal>
  );
}
