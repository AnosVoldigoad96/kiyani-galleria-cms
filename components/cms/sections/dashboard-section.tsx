"use client";

import type { CmsDashboardStat, CmsOrder } from "@/lib/cms-data";

import { StatCard } from "@/components/cms/ui/stat-card";
import { StatusBadge, sectionTone, surfaceClassName } from "@/components/cms/cms-shared";
import { Package } from "lucide-react";
import { EmptyState } from "@/components/cms/ui/empty-state";

export function DashboardSection({
  stats,
  orders,
}: {
  stats: CmsDashboardStat[];
  orders: CmsOrder[];
}) {
  const recentOrders = orders.slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Key metrics and recent activity.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} detail={stat.detail} />
        ))}
      </section>

      <section className={surfaceClassName("overflow-hidden")}>
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold text-foreground">Recent Orders</h2>
          <span className="text-xs text-muted-foreground">{orders.length} total</span>
        </div>

        {recentOrders.length === 0 ? (
          <EmptyState icon={Package} title="No orders yet" description="Orders will appear here once created." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground sm:px-6">Order</th>
                  <th className="hidden sm:table-cell px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground sm:px-6">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground sm:px-6">Payment</th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Fulfillment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentOrders.map((order) => (
                  <tr key={order.orderId} className="hover:bg-muted/30">
                    <td className="px-4 py-3 sm:px-6">
                      <p className="font-medium text-foreground">{order.orderNo}</p>
                      <p className="text-xs text-muted-foreground sm:hidden">{order.customer.name}</p>
                    </td>
                    <td className="hidden sm:table-cell px-6 py-3 text-muted-foreground">{order.customer.name}</td>
                    <td className="px-4 py-3 font-medium text-foreground sm:px-6">{order.totalPkr}</td>
                    <td className="px-4 py-3 sm:px-6">
                      <StatusBadge tone={sectionTone(order.payment)}>{order.payment}</StatusBadge>
                    </td>
                    <td className="hidden md:table-cell px-6 py-3">
                      <StatusBadge tone={sectionTone(order.fulfillment)}>{order.fulfillment}</StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
