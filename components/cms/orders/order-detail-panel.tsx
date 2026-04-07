"use client";

import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { StatusBadge, sectionTone, surfaceClassName } from "@/components/cms/cms-shared";
import { OrderStatusTimeline } from "@/components/cms/orders/order-status-timeline";
import { updateOrder, type OrderPaymentStatus, type OrderFulfillmentStatus } from "@/components/cms/orders/orders-api";
import type { CmsOrder } from "@/lib/cms-data";

type OrderDetailPanelProps = {
  order: CmsOrder;
  onBack: () => void;
  onEdit: (order: CmsOrder) => void;
  onDelete: (order: CmsOrder) => void;
  onRefresh?: () => void;
};

function money(value: number) {
  return `PKR ${Math.max(0, value).toLocaleString()}`;
}

export function OrderDetailPanel({ order, onBack, onEdit, onDelete, onRefresh }: OrderDetailPanelProps) {
  const handleQuickStatus = async (field: "payment" | "fulfillment", value: string) => {
    try {
      const payload: Record<string, unknown> = {
        order_no: order.orderNo,
        customer_name: order.customer.name,
        customer_email: order.customer.email === "No email" ? null : order.customer.email,
        customer_phone: order.customer.phone || null,
        city: order.customer.city === "Unknown" ? null : order.customer.city,
        address: order.customer.address || null,
        payment_status: field === "payment" ? value : order.paymentStatus,
        fulfillment_status: field === "fulfillment" ? value : order.fulfillmentStatus,
        subtotal_pkr: order.subtotalPkr,
        discount_pkr: order.discountPkr,
        shipping_pkr: order.shippingPkr,
        total_pkr: order.totalPkrValue,
        notes: order.notes || null,
        user_id: null,
      };
      await updateOrder(order.orderId, payload as any, [], false);
      toast.success(`Status updated to ${value}.`);
      onRefresh?.();
    } catch {
      toast.error("Failed to update status.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to orders
        </button>
      </div>

      <div className={surfaceClassName("p-6")}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{order.orderNo}</h2>
            <p className="mt-1 text-2xl font-semibold text-foreground">{order.totalPkr}</p>
            <div className="mt-3 flex items-center gap-2">
              <StatusBadge tone={sectionTone(order.payment)}>{order.payment}</StatusBadge>
              <StatusBadge tone={sectionTone(order.fulfillment)}>{order.fulfillment}</StatusBadge>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onEdit(order)}>
              <Pencil className="mr-1.5 size-3.5" />
              Edit
            </Button>
            <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => onDelete(order)}>
              <Trash2 className="mr-1.5 size-3.5" />
              Delete
            </Button>
          </div>
        </div>

        <div className="mt-6">
          <OrderStatusTimeline
            current={order.fulfillment}
            cancelled={order.fulfillmentStatus === "cancelled"}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className={surfaceClassName("p-6")}>
          <h3 className="text-sm font-semibold text-foreground">Customer</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium text-foreground">{order.customer.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium text-foreground">{order.customer.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="font-medium text-foreground">{order.customer.phone || "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">City</dt>
              <dd className="font-medium text-foreground">{order.customer.city}</dd>
            </div>
            {order.customer.address && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Address</dt>
                <dd className="font-medium text-foreground text-right max-w-[60%]">{order.customer.address}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className={surfaceClassName("p-6")}>
          <h3 className="text-sm font-semibold text-foreground">Quick Status Update</h3>
          <div className="mt-4 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-2">Payment</p>
              <div className="flex flex-wrap gap-1.5">
                {(["pending", "paid", "failed", "refunded"] as OrderPaymentStatus[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={order.paymentStatus === s}
                    onClick={() => handleQuickStatus("payment", s)}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                      order.paymentStatus === s
                        ? "border-primary/20 bg-primary/10 text-primary"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">Fulfillment</p>
              <div className="flex flex-wrap gap-1.5">
                {(["processing", "packed", "dispatched", "delivered", "cancelled"] as OrderFulfillmentStatus[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={order.fulfillmentStatus === s}
                    onClick={() => handleQuickStatus("fulfillment", s)}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                      order.fulfillmentStatus === s
                        ? "border-primary/20 bg-primary/10 text-primary"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={surfaceClassName("overflow-hidden")}>
        <div className="border-b border-border px-4 py-4 sm:px-6">
          <h3 className="text-sm font-semibold text-foreground">Line Items</h3>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground sm:px-6">Product</th>
              <th className="hidden sm:table-cell px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">SKU</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground sm:px-6">Qty</th>
              <th className="hidden sm:table-cell px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Unit Price</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground sm:px-6">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {order.items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 sm:px-6">
                  <p className="font-medium text-foreground">{item.productName}</p>
                  <p className="text-xs text-muted-foreground sm:hidden">{item.sku}</p>
                </td>
                <td className="hidden sm:table-cell px-6 py-3 text-muted-foreground">{item.sku}</td>
                <td className="px-4 py-3 text-right tabular-nums sm:px-6">{item.quantity}</td>
                <td className="hidden sm:table-cell px-6 py-3 text-right tabular-nums">{money(item.unitPricePkr)}</td>
                <td className="px-4 py-3 text-right font-medium tabular-nums sm:px-6">{money(item.quantity * item.unitPricePkr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <div className="border-t border-border bg-muted/30 px-4 py-4 sm:px-6">
          <div className="w-full space-y-1.5 text-sm sm:ml-auto sm:w-64">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{money(order.subtotalPkr)}</span>
            </div>
            {order.discountPkr > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount</span>
                <span className="tabular-nums text-destructive">-{money(order.discountPkr)}</span>
              </div>
            )}
            {order.shippingPkr > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span className="tabular-nums">+{money(order.shippingPkr)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-1.5 font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{order.totalPkr}</span>
            </div>
          </div>
        </div>
      </div>

      {order.notes && (
        <div className={surfaceClassName("p-6")}>
          <h3 className="text-sm font-semibold text-foreground">Notes</h3>
          <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{order.notes}</p>
        </div>
      )}
    </div>
  );
}
