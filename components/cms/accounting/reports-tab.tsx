"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { CmsInvoice, CmsLedgerAccount } from "@/lib/cms-data";
import { surfaceClassName } from "@/components/cms/cms-shared";

function parsePkr(s: string): number {
  return Number(s.replace(/[^0-9.-]/g, "")) || 0;
}

function formatPkr(v: number): string {
  return `PKR ${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function daysBetween(a: string, b: Date): number {
  const d = new Date(a);
  return Math.floor((b.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

type Props = {
  ledgerAccounts: CmsLedgerAccount[];
  invoices: CmsInvoice[];
};

export function ReportsTab({ ledgerAccounts, invoices }: Props) {
  const pnl = useMemo(() => {
    const sumCat = (cat: string) =>
      ledgerAccounts.filter((a) => a.category === cat).reduce((s, a) => s + parsePkr(a.balancePkr), 0);

    const revenue = sumCat("Revenue");
    const cogs = sumCat("COGS");
    const grossProfit = revenue - cogs;
    const expenses = sumCat("Expense");
    const netIncome = grossProfit - expenses;

    return { revenue, cogs, grossProfit, expenses, netIncome };
  }, [ledgerAccounts]);

  const aging = useMemo(() => {
    const now = new Date();
    const buckets = [
      { label: "Current (0-30d)", min: 0, max: 30, total: 0, count: 0 },
      { label: "31-60 days", min: 31, max: 60, total: 0, count: 0 },
      { label: "61-90 days", min: 61, max: 90, total: 0, count: 0 },
      { label: "90+ days", min: 91, max: Infinity, total: 0, count: 0 },
    ];

    for (const inv of invoices) {
      if (inv.balancePkrValue <= 0) continue;
      const age = daysBetween(inv.issueDateValue, now);
      const bucket = buckets.find((b) => age >= b.min && age <= b.max);
      if (bucket) {
        bucket.total += inv.balancePkrValue;
        bucket.count += 1;
      }
    }
    const maxTotal = Math.max(...buckets.map((b) => b.total), 1);
    return { buckets, maxTotal };
  }, [invoices]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Profit & Loss */}
      <div className={surfaceClassName("p-6")}>
        <h3 className="text-sm font-semibold text-foreground">Profit & Loss Summary</h3>
        <p className="mt-1 text-xs text-muted-foreground">Computed from chart of accounts balances.</p>

        <table className="mt-4 w-full text-sm">
          <tbody className="divide-y divide-border">
            <tr>
              <td className="py-2 text-muted-foreground">Revenue</td>
              <td className="py-2 text-right font-medium tabular-nums">{formatPkr(pnl.revenue)}</td>
            </tr>
            <tr>
              <td className="py-2 text-muted-foreground">Cost of Goods Sold</td>
              <td className="py-2 text-right font-medium tabular-nums text-rose-700">({formatPkr(pnl.cogs)})</td>
            </tr>
            <tr className="border-t-2 border-border">
              <td className="py-2 font-semibold text-foreground">Gross Profit</td>
              <td className={cn("py-2 text-right font-semibold tabular-nums", pnl.grossProfit >= 0 ? "text-emerald-700" : "text-rose-700")}>
                {formatPkr(pnl.grossProfit)}
              </td>
            </tr>
            <tr>
              <td className="py-2 text-muted-foreground">Expenses</td>
              <td className="py-2 text-right font-medium tabular-nums text-rose-700">({formatPkr(pnl.expenses)})</td>
            </tr>
            <tr className="border-t-2 border-border">
              <td className="py-2 font-semibold text-foreground">Net Income</td>
              <td className={cn("py-2 text-right font-bold tabular-nums text-lg", pnl.netIncome >= 0 ? "text-emerald-700" : "text-rose-700")}>
                {formatPkr(pnl.netIncome)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Aging Receivables */}
      <div className={surfaceClassName("p-6")}>
        <h3 className="text-sm font-semibold text-foreground">Aging Receivables</h3>
        <p className="mt-1 text-xs text-muted-foreground">Outstanding invoice balances by age.</p>

        <div className="mt-4 space-y-3">
          {aging.buckets.map((bucket) => (
            <div key={bucket.label}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{bucket.label}</span>
                <span className="font-medium tabular-nums">
                  {formatPkr(bucket.total)}
                  <span className="ml-2 text-xs text-muted-foreground">({bucket.count})</span>
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    bucket.min >= 91 ? "bg-rose-500" : bucket.min >= 61 ? "bg-amber-500" : bucket.min >= 31 ? "bg-amber-400" : "bg-primary",
                  )}
                  style={{ width: `${Math.max(0, (bucket.total / aging.maxTotal) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 border-t border-border pt-3 flex justify-between text-sm font-semibold">
          <span>Total Outstanding</span>
          <span className="tabular-nums">{formatPkr(aging.buckets.reduce((s, b) => s + b.total, 0))}</span>
        </div>
      </div>
    </div>
  );
}
