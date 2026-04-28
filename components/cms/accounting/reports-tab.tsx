"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { CmsInvoice, CmsJournalEntry, CmsLedgerAccount } from "@/lib/cms-data";
import { surfaceClassName } from "@/components/cms/cms-shared";

function formatPkr(v: number): string {
  return `PKR ${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function parseDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type RangeKey = "this_month" | "last_month" | "quarter" | "ytd" | "last_year" | "all" | "custom";

function computeRange(key: RangeKey, customFrom: string, customTo: string): { from: Date | null; to: Date | null; label: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (key) {
    case "this_month":
      return { from: new Date(y, m, 1), to: new Date(y, m + 1, 0), label: "This month" };
    case "last_month":
      return { from: new Date(y, m - 1, 1), to: new Date(y, m, 0), label: "Last month" };
    case "quarter": {
      const qStart = Math.floor(m / 3) * 3;
      return { from: new Date(y, qStart, 1), to: new Date(y, qStart + 3, 0), label: "This quarter" };
    }
    case "ytd":
      return { from: new Date(y, 0, 1), to: now, label: "Year to date" };
    case "last_year":
      return { from: new Date(y - 1, 0, 1), to: new Date(y - 1, 11, 31), label: `${y - 1}` };
    case "custom": {
      const f = parseDate(customFrom);
      const t = parseDate(customTo);
      return { from: f, to: t, label: `${customFrom || "…"} → ${customTo || "…"}` };
    }
    case "all":
    default:
      return { from: null, to: null, label: "All time" };
  }
}

type Props = {
  ledgerAccounts: CmsLedgerAccount[];
  invoices: CmsInvoice[];
  journalEntries: CmsJournalEntry[];
};

export function ReportsTab({ ledgerAccounts, invoices, journalEntries }: Props) {
  const [rangeKey, setRangeKey] = useState<RangeKey>("ytd");
  const [customFrom, setCustomFrom] = useState<string>(isoDate(new Date(new Date().getFullYear(), 0, 1)));
  const [customTo, setCustomTo] = useState<string>(isoDate(new Date()));

  const range = useMemo(() => computeRange(rangeKey, customFrom, customTo), [rangeKey, customFrom, customTo]);

  // Derive period-bound balances from posted journal entries only.
  // Each account's period balance = sum of (debit - credit) on posted lines within [from, to].
  // Sign is flipped for credit-normal accounts to show "positive = normal balance".
  const periodBalances = useMemo(() => {
    const map = new Map<string, { debit: number; credit: number; signed: number; category: CmsLedgerAccount["category"] }>();
    for (const acct of ledgerAccounts) {
      map.set(acct.id, { debit: 0, credit: 0, signed: 0, category: acct.category });
    }
    for (const entry of journalEntries) {
      if (entry.statusCode !== "posted") continue;
      const d = parseDate(entry.entryDateValue);
      if (!d) continue;
      if (range.from && d < range.from) continue;
      if (range.to && d > range.to) continue;
      for (const line of entry.lines) {
        const slot = map.get(line.accountId);
        if (!slot) continue;
        slot.debit += line.debitPkrValue;
        slot.credit += line.creditPkrValue;
      }
    }
    for (const [, slot] of map) {
      const raw = slot.debit - slot.credit;
      const debitNormal = slot.category === "Asset" || slot.category === "Expense" || slot.category === "COGS";
      slot.signed = debitNormal ? raw : -raw;
    }
    return map;
  }, [journalEntries, ledgerAccounts, range.from, range.to]);

  const pnl = useMemo(() => {
    const sumCat = (cat: CmsLedgerAccount["category"]) =>
      ledgerAccounts
        .filter((a) => a.category === cat)
        .reduce((s, a) => s + (periodBalances.get(a.id)?.signed ?? 0), 0);

    const revenue = sumCat("Revenue");
    const cogs = sumCat("COGS");
    const grossProfit = revenue - cogs;
    const expenses = sumCat("Expense");
    const netIncome = grossProfit - expenses;

    return { revenue, cogs, grossProfit, expenses, netIncome };
  }, [ledgerAccounts, periodBalances]);

  const trialBalance = useMemo(() => {
    let totalDebits = 0;
    let totalCredits = 0;
    for (const a of ledgerAccounts) {
      const slot = periodBalances.get(a.id);
      if (!slot) continue;
      totalDebits += slot.debit;
      totalCredits += slot.credit;
    }
    return { totalDebits, totalCredits, balanced: Math.abs(totalDebits - totalCredits) < 0.01 };
  }, [ledgerAccounts, periodBalances]);

  // Aging by due_date (fallback to issue_date if no due date). Excludes void invoices and zero-balance rows.
  const aging = useMemo(() => {
    const now = new Date();
    const buckets = [
      { label: "Not yet due", min: -Infinity, max: 0, total: 0, count: 0 },
      { label: "1-30 days overdue", min: 1, max: 30, total: 0, count: 0 },
      { label: "31-60 days overdue", min: 31, max: 60, total: 0, count: 0 },
      { label: "61-90 days overdue", min: 61, max: 90, total: 0, count: 0 },
      { label: "90+ days overdue", min: 91, max: Infinity, total: 0, count: 0 },
    ];

    for (const inv of invoices) {
      if (inv.statusCode === "void") continue;
      if (inv.balancePkrValue <= 0) continue;
      const refDate = parseDate(inv.dueDateValue) ?? parseDate(inv.issueDateValue);
      if (!refDate) continue;
      const daysPastDue = daysBetween(refDate, now);
      const bucket = buckets.find((b) => daysPastDue >= b.min && daysPastDue <= b.max);
      if (bucket) {
        bucket.total += inv.balancePkrValue;
        bucket.count += 1;
      }
    }
    const maxTotal = Math.max(...buckets.map((b) => b.total), 1);
    return { buckets, maxTotal };
  }, [invoices]);

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className={surfaceClassName("p-4")}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mr-2">Period</span>
          {([
            ["this_month", "This month"],
            ["last_month", "Last month"],
            ["quarter", "This quarter"],
            ["ytd", "Year to date"],
            ["last_year", "Last year"],
            ["all", "All time"],
            ["custom", "Custom"],
          ] as Array<[RangeKey, string]>).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setRangeKey(key)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                rangeKey === key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-border hover:bg-muted",
              )}
            >
              {label}
            </button>
          ))}
          {rangeKey === "custom" && (
            <div className="flex items-center gap-2 ml-2">
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs" />
              <span className="text-muted-foreground text-xs">to</span>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs" />
            </div>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            {range.from ? `${isoDate(range.from)} → ${range.to ? isoDate(range.to) : "…"}` : "All time"}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profit & Loss */}
        <div className={surfaceClassName("p-6")}>
          <h3 className="text-sm font-semibold text-foreground">Profit & Loss — {range.label}</h3>
          <p className="mt-1 text-xs text-muted-foreground">Posted journal entries within the selected period.</p>

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
          <p className="mt-1 text-xs text-muted-foreground">Open invoices bucketed by days past due date. Voided invoices excluded.</p>

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
                      bucket.min >= 91 ? "bg-rose-500" : bucket.min >= 61 ? "bg-amber-500" : bucket.min >= 31 ? "bg-amber-400" : bucket.min >= 1 ? "bg-amber-300" : "bg-primary",
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

        {/* Trial Balance */}
        <div className={surfaceClassName("p-6 lg:col-span-2")}>
          <h3 className="text-sm font-semibold text-foreground">Trial Balance — {range.label}</h3>
          <p className="mt-1 text-xs text-muted-foreground">Sum of posted debits and credits in the selected period.</p>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Total Debits</p>
              <p className="text-xl font-bold tabular-nums text-foreground">{formatPkr(trialBalance.totalDebits)}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Total Credits</p>
              <p className="text-xl font-bold tabular-nums text-foreground">{formatPkr(trialBalance.totalCredits)}</p>
            </div>
          </div>
          <div className={cn(
            "mt-3 rounded-lg p-3 text-center text-sm font-semibold",
            trialBalance.balanced ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700",
          )}>
            {trialBalance.balanced ? "✓ Books are balanced" : `✗ Imbalance: ${formatPkr(Math.abs(trialBalance.totalDebits - trialBalance.totalCredits))}`}
          </div>
        </div>
      </div>
    </div>
  );
}
