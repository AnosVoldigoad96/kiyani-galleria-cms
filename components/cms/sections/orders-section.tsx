"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDeleteModal } from "@/components/cms/products/confirm-delete-modal";
import { OrdersTable } from "@/components/cms/orders/orders-table";
import { OrderDetailPanel } from "@/components/cms/orders/order-detail-panel";
import { OrderEditor, buildOrderDraft } from "@/components/cms/orders/order-editor";
import { deleteOrder } from "@/components/cms/orders/orders-api";
import { toast } from "sonner";
import type { CmsOrder, CmsProduct } from "@/lib/cms-data";

type OrdersSectionProps = {
  orders: CmsOrder[];
  products: CmsProduct[];
  onRefresh?: () => void;
};

type View = { mode: "list" } | { mode: "detail"; order: CmsOrder };

export function OrdersSection({ orders, products, onRefresh }: OrdersSectionProps) {
  const [view, setView] = useState<View>({ mode: "list" });
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<CmsOrder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CmsOrder | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCreate = () => {
    setEditingOrder(null);
    setEditorOpen(true);
  };

  const openEdit = (order: CmsOrder) => {
    setEditingOrder(order);
    setEditorOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsSaving(true);
    setError(null);
    try {
      await deleteOrder(deleteTarget.orderId);
      toast.success("Order deleted.");
      setDeleteTarget(null);
      if (view.mode === "detail" && view.order.orderId === deleteTarget.orderId) {
        setView({ mode: "list" });
      }
      onRefresh?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete order.";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {view.mode === "list" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Orders</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage orders with accounting sync for invoices and journals.
              </p>
            </div>
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 size-4" />
              New Order
            </Button>
          </div>

          <OrdersTable
            orders={orders}
            onRowClick={(order) => setView({ mode: "detail", order })}
            onEdit={openEdit}
            onDelete={setDeleteTarget}
          />
        </>
      )}

      {view.mode === "detail" && (
        <OrderDetailPanel
          order={view.order}
          onBack={() => setView({ mode: "list" })}
          onEdit={openEdit}
          onDelete={setDeleteTarget}
          onRefresh={onRefresh}
        />
      )}

      <OrderEditor
        open={editorOpen}
        editingOrder={editingOrder}
        products={products}
        onClose={() => { setEditorOpen(false); setEditingOrder(null); }}
        onRefresh={onRefresh}
      />

      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title="Delete order"
        description={`You're about to delete "${deleteTarget?.orderNo ?? ""}".`}
        onClose={() => { setDeleteTarget(null); setError(null); }}
        onConfirm={handleDelete}
        isSaving={isSaving}
        error={error}
      />
    </div>
  );
}
