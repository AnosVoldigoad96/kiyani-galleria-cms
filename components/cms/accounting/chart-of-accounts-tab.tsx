"use client";

import { useMemo, Fragment } from "react";
import { Landmark } from "lucide-react";

import { EmptyState } from "@/components/cms/ui/empty-state";
import { StatusBadge } from "@/components/cms/cms-shared";
import type { CmsLedgerAccount } from "@/lib/cms-data";

const CATEGORY_ORDER = ["Asset", "Liability", "Equity", "Revenue", "Expense", "COGS"] as const;

type Props = { accounts: CmsLedgerAccount[] };

export function ChartOfAccountsTab({ accounts }: Props) {
  const grouped = useMemo(() => {
    const map = new Map<string, CmsLedgerAccount[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const acc of accounts) {
      const list = map.get(acc.category) ?? [];
      list.push(acc);
      map.set(acc.category, list);
    }
    return Array.from(map.entries()).filter(([, list]) => list.length > 0);
  }, [accounts]);

  if (!accounts.length) {
    return <EmptyState icon={Landmark} title="No accounts" description="Chart of accounts will appear once configured." />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Code</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</th>
            <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Balance</th>
            <th className="hidden sm:table-cell px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Entries</th>
          </tr>
        </thead>
        <tbody>
          {grouped.map(([category, accs]) => (
            <Fragment key={category}>
              <tr className="border-b border-border bg-muted/30">
                <td colSpan={5} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {category}
                </td>
              </tr>
              {accs.map((acc) => (
                <tr key={acc.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground tabular-nums">{acc.code}</td>
                  <td className="px-4 py-3 text-foreground">{acc.name}</td>
                  <td className="hidden sm:table-cell px-4 py-3">
                    <StatusBadge tone={acc.status === "Active" ? "success" : "danger"}>{acc.status}</StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">{acc.balancePkr}</td>
                  <td className="hidden sm:table-cell px-4 py-3 text-right tabular-nums text-muted-foreground">{acc.entryCount}</td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
