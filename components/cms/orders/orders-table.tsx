"use client";

import { useState, useMemo } from "react";
import { ChevronRight, Pencil, Trash2, Package } from "lucide-react";

import { DataTable, type Column } from "@/components/cms/ui/data-table";
import { FilterBar } from "@/components/cms/ui/filter-bar";
import { EmptyState } from "@/components/cms/ui/empty-state";
import { StatusBadge, sectionTone } from "@/components/cms/cms-shared";
import { Button } from "@/components/ui/button";
import type { CmsOrder } from "@/lib/cms-data";

type OrdersTableProps = {
  orders: CmsOrder[];
  onRowClick: (order: CmsOrder) => void;
  onEdit: (order: CmsOrder) => void;
  onDelete: (order: CmsOrder) => void;
};

export function OrdersTable({ orders, onRowClick, onEdit, onDelete }: OrdersTableProps) {
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [fulfillmentFilter, setFulfillmentFilter] = useState("all");

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (paymentFilter !== "all" && o.paymentStatus !== paymentFilter) return false;
      if (fulfillmentFilter !== "all" && o.fulfillmentStatus !== fulfillmentFilter) return false;
      return true;
    });
  }, [orders, paymentFilter, fulfillmentFilter]);

  const hasFilters = paymentFilter !== "all" || fulfillmentFilter !== "all";

  const columns: Column<CmsOrder>[] = [
    {
      key: "orderNo",
      header: "Order",
      sortable: true,
      sortValue: (r) => r.orderNo,
      render: (r) => (
        <div>
          <p className="font-medium text-foreground">{r.orderNo}</p>
          <p className="text-xs text-primary font-medium">{r.totalPkr}</p>
          <p className="sm:hidden text-xs text-muted-foreground mt-0.5">{r.customer.name}</p>
        </div>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      sortable: true,
      sortValue: (r) => r.customer.name,
      hideBelow: "sm",
      render: (r) => (
        <div>
          <p className="font-medium text-foreground">{r.customer.name}</p>
          <p className="text-xs text-muted-foreground">{r.customer.email}</p>
        </div>
      ),
    },
    {
      key: "items",
      header: "Items",
      hideBelow: "sm",
      render: (r) => (
        <div>
          <p className="text-foreground">{r.items[0]?.productName ?? "No items"}</p>
          <p className="text-xs text-muted-foreground">
            {r.items.length} line{r.items.length !== 1 ? "s" : ""} · {r.items.reduce((s, it) => s + it.quantity, 0)} pcs
          </p>
        </div>
      ),
    },
    {
      key: "payment",
      header: "Payment",
      sortable: true,
      sortValue: (r) => r.payment,
      render: (r) => <StatusBadge tone={sectionTone(r.payment)}>{r.payment}</StatusBadge>,
    },
    {
      key: "fulfillment",
      header: "Fulfillment",
      sortable: true,
      sortValue: (r) => r.fulfillment,
      hideBelow: "sm",
      render: (r) => <StatusBadge tone={sectionTone(r.fulfillment)}>{r.fulfillment}</StatusBadge>,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (r) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="outline" size="icon-xs" onClick={() => onEdit(r)} title="Edit">
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon-xs"
            className="text-destructive hover:bg-destructive/10"
            onClick={() => onDelete(r)}
            title="Delete"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <FilterBar
        filters={[
          {
            label: "Payment",
            value: paymentFilter,
            options: [
              { label: "All payments", value: "all" },
              { label: "Pending", value: "pending" },
              { label: "Paid", value: "paid" },
              { label: "Failed", value: "failed" },
              { label: "Refunded", value: "refunded" },
            ],
            onChange: setPaymentFilter,
          },
          {
            label: "Fulfillment",
            value: fulfillmentFilter,
            options: [
              { label: "All statuses", value: "all" },
              { label: "Processing", value: "processing" },
              { label: "Packed", value: "packed" },
              { label: "Dispatched", value: "dispatched" },
              { label: "Delivered", value: "delivered" },
              { label: "Cancelled", value: "cancelled" },
            ],
            onChange: setFulfillmentFilter,
          },
        ]}
        hasActiveFilters={hasFilters}
        onClearAll={() => { setPaymentFilter("all"); setFulfillmentFilter("all"); }}
      />

      {/* Mobile: Card layout */}
      <div className="sm:hidden space-y-3">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No orders found"
            description={hasFilters ? "Try adjusting your filters." : "Create your first order to get started."}
          />
        ) : (
          filtered.map((order) => (
            <div
              key={order.orderId}
              onClick={() => onRowClick(order)}
              className="rounded-xl border border-border bg-white p-4 space-y-3 active:bg-muted/30 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-foreground">{order.customer.name}</p>
                  <p className="text-xs text-muted-foreground">{order.orderNo}</p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground shrink-0 mt-1" />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusBadge tone={sectionTone(order.payment)}>{order.payment}</StatusBadge>
                  <StatusBadge tone={sectionTone(order.fulfillment)}>{order.fulfillment}</StatusBadge>
                </div>
                <p className="text-sm font-semibold text-primary">{order.totalPkr}</p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground">{order.items.length} item{order.items.length !== 1 ? "s" : ""}</p>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button variant="outline" size="icon-xs" onClick={() => onEdit(order)} title="Edit"><Pencil className="size-3.5" /></Button>
                  <Button variant="outline" size="icon-xs" className="text-destructive hover:bg-destructive/10" onClick={() => onDelete(order)} title="Delete"><Trash2 className="size-3.5" /></Button>
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
          rowKey={(r) => r.orderId}
          onRowClick={onRowClick}
          pageSize={20}
          emptyState={
            <EmptyState
              icon={Package}
              title="No orders found"
              description={hasFilters ? "Try adjusting your filters." : "Create your first order to get started."}
            />
          }
        />
      </div>
    </div>
  );
}
