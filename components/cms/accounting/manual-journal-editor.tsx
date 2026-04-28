"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { CmsModal } from "@/components/cms/cms-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/cms/ui/input";
import { Select } from "@/components/cms/ui/select";
import { Textarea } from "@/components/cms/ui/textarea";
import { requestAdminGraphql } from "@/lib/admin-graphql-client";
import type { CmsInvoice, CmsLedgerAccount } from "@/lib/cms-data";

type JournalLineDraft = {
  key: string;
  accountId: string;
  side: "debit" | "credit";
  amount: number;
  description: string;
};

type JournalDraft = {
  journalNo: string;
  entryDate: string;
  invoiceId: string;
  memo: string;
  status: "draft" | "posted";
  lines: JournalLineDraft[];
};

const TEMPLATES = [
  {
    label: "Shipping Payment",
    description: "Record payment to carrier/courier",
    build: (accounts: CmsLedgerAccount[]): Partial<JournalDraft> => ({
      memo: "Shipping payment to courier",
      lines: [
        { key: crypto.randomUUID(), accountId: accounts.find((a) => a.code === "6000")?.id ?? "", side: "debit" as const, amount: 0, description: "Shipping cost paid" },
        { key: crypto.randomUUID(), accountId: accounts.find((a) => a.code === "1000")?.id ?? "", side: "credit" as const, amount: 0, description: "Cash paid to courier" },
      ],
    }),
  },
  {
    label: "Tax Payment",
    description: "Record tax payment to government",
    build: (accounts: CmsLedgerAccount[]): Partial<JournalDraft> => ({
      memo: "Sales tax payment to FBR",
      lines: [
        { key: crypto.randomUUID(), accountId: accounts.find((a) => a.code === "2100")?.id ?? "", side: "debit" as const, amount: 0, description: "Tax liability settled" },
        { key: crypto.randomUUID(), accountId: accounts.find((a) => a.code === "1000")?.id ?? "", side: "credit" as const, amount: 0, description: "Cash paid for tax" },
      ],
    }),
  },
  {
    label: "Operating Expense",
    description: "Record a general business expense",
    build: (accounts: CmsLedgerAccount[]): Partial<JournalDraft> => ({
      memo: "Operating expense",
      lines: [
        { key: crypto.randomUUID(), accountId: accounts.find((a) => a.code === "6100")?.id ?? "", side: "debit" as const, amount: 0, description: "Expense incurred" },
        { key: crypto.randomUUID(), accountId: accounts.find((a) => a.code === "1000")?.id ?? "", side: "credit" as const, amount: 0, description: "Cash paid" },
      ],
    }),
  },
  {
    label: "Owner Investment",
    description: "Record capital invested into business",
    build: (accounts: CmsLedgerAccount[]): Partial<JournalDraft> => ({
      memo: "Owner capital investment",
      lines: [
        { key: crypto.randomUUID(), accountId: accounts.find((a) => a.code === "1000")?.id ?? "", side: "debit" as const, amount: 0, description: "Cash received" },
        { key: crypto.randomUUID(), accountId: accounts.find((a) => a.code === "3000")?.id ?? "", side: "credit" as const, amount: 0, description: "Owner capital" },
      ],
    }),
  },
];

function money(v: number) { return `PKR ${Math.max(0, v).toLocaleString()}`; }
function today() { return new Date().toISOString().slice(0, 10); }
function genJournalNo() {
  const n = new Date();
  return `JRN-${n.getFullYear()}${String(n.getMonth() + 1).padStart(2, "0")}${String(n.getDate()).padStart(2, "0")}-${String(n.getHours()).padStart(2, "0")}${String(n.getMinutes()).padStart(2, "0")}${String(n.getSeconds()).padStart(2, "0")}`;
}

function emptyDraft(): JournalDraft {
  return {
    journalNo: genJournalNo(),
    entryDate: today(),
    invoiceId: "",
    memo: "",
    status: "posted",
    lines: [
      { key: crypto.randomUUID(), accountId: "", side: "debit", amount: 0, description: "" },
      { key: crypto.randomUUID(), accountId: "", side: "credit", amount: 0, description: "" },
    ],
  };
}

type Props = {
  open: boolean;
  accounts: CmsLedgerAccount[];
  invoices: CmsInvoice[];
  onClose: () => void;
  onRefresh?: () => void;
};

export function ManualJournalEditor({ open, accounts, invoices, onClose, onRefresh }: Props) {
  const [draft, setDraft] = useState<JournalDraft>(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastOpenState, setLastOpenState] = useState(false);

  // Reset and optionally preselect invoice when modal opens.
  // Invoice linking is OPTIONAL — templates like "Owner Investment" or "Tax Payment"
  // are not tied to any invoice and must post without one.
  if (open && !lastOpenState) {
    setLastOpenState(true);
    const fresh = emptyDraft();
    // Preselect only when called with exactly one invoice (i.e. opened from an invoice row).
    if (invoices.length === 1) {
      fresh.invoiceId = invoices[0].id;
      const ts = Date.now().toString(36).toUpperCase().slice(-4);
      fresh.journalNo = `JRN-${invoices[0].invoiceNo}-${ts}`;
    }
    setDraft(fresh);
    setError(null);
  }
  if (!open && lastOpenState) {
    setLastOpenState(false);
  }

  const totalDebits = draft.lines.filter((l) => l.side === "debit").reduce((s, l) => s + l.amount, 0);
  const totalCredits = draft.lines.filter((l) => l.side === "credit").reduce((s, l) => s + l.amount, 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01 && totalDebits > 0;

  const applyTemplate = (index: number) => {
    const template = TEMPLATES[index];
    if (!template) return;
    const partial = template.build(accounts);
    setDraft((d) => ({
      ...d,
      memo: partial.memo ?? d.memo,
      lines: partial.lines ?? d.lines,
    }));
  };

  const setLine = (idx: number, field: keyof JournalLineDraft, value: string | number) => {
    setDraft((d) => ({ ...d, lines: d.lines.map((l, i) => i === idx ? { ...l, [field]: value } : l) }));
  };

  const save = async () => {
    if (!draft.journalNo.trim()) { setError("Journal number is required."); return; }
    if (!draft.entryDate) { setError("Entry date is required."); return; }
    if (!isBalanced) { setError("Debits must equal credits."); return; }

    const validLines = draft.lines.filter((l) => l.accountId && l.amount > 0);
    if (validLines.length < 2) { setError("At least 2 lines with accounts are required."); return; }

    // reference_type reflects what this entry is actually for.
    // Manual expense/tax payments should NOT be stamped "invoice" — that pollutes the reference graph.
    const referenceType = draft.invoiceId ? "invoice_manual" : "manual";

    setSaving(true);
    setError(null);
    try {
      // Insert as draft, add lines, then transition to the desired status.
      // This works around the DB immutability trigger (can't insert lines into a posted entry).
      const journalRes = await requestAdminGraphql<{ insert_journal_entries_one: { id: string } | null }>(
        `mutation CreateManualJournal($object: journal_entries_insert_input!) {
          insert_journal_entries_one(object: $object) { id }
        }`,
        {
          object: {
            journal_no: draft.journalNo.trim(),
            entry_date: draft.entryDate,
            reference_type: referenceType,
            reference_id: draft.invoiceId || null,
            memo: draft.memo.trim() || null,
            status: "draft",
          },
        },
      );
      if (journalRes.body.errors?.length) throw new Error(journalRes.body.errors[0].message);
      const journalId = journalRes.body.data?.insert_journal_entries_one?.id;
      if (!journalId) throw new Error("Failed to create journal entry.");

      const linesRes = await requestAdminGraphql(
        `mutation InsertManualJournalLines($objects: [journal_lines_insert_input!]!) {
          insert_journal_lines(objects: $objects) { affected_rows }
        }`,
        {
          objects: validLines.map((l, i) => ({
            journal_entry_id: journalId,
            account_id: l.accountId,
            description: l.description.trim() || null,
            debit_pkr: l.side === "debit" ? l.amount : 0,
            credit_pkr: l.side === "credit" ? l.amount : 0,
            line_order: i,
          })),
        },
      );
      if (linesRes.body.errors?.length) throw new Error(linesRes.body.errors[0].message);

      if (draft.status === "posted") {
        const postRes = await requestAdminGraphql(
          `mutation PostManualJournal($id: uuid!) {
            update_journal_entries_by_pk(pk_columns: { id: $id }, _set: { status: "posted" }) { id }
          }`,
          { id: journalId },
        );
        if (postRes.body.errors?.length) throw new Error(postRes.body.errors[0].message);
      }

      toast.success("Journal entry posted.");
      setDraft(emptyDraft());
      onClose();
      onRefresh?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };


  const inputCls = "h-8 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20";

  return (
    <CmsModal
      open={open}
      title="Manual Journal Entry"
      description="Record expenses, tax payments, and other transactions."
      onClose={() => { onClose(); setError(null); }}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || !isBalanced}>
            {saving ? "Posting..." : "Post Entry"}
          </Button>
        </>
      }
    >
      {/* Quick Templates */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Quick Templates</p>
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map((t, i) => (
            <button
              key={t.label}
              type="button"
              onClick={() => applyTemplate(i)}
              className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted transition-colors text-left"
            >
              <span className="block font-semibold text-foreground">{t.label}</span>
              <span className="block text-muted-foreground">{t.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Linked Invoice (optional)" value={draft.invoiceId} onChange={(e) => {
          const inv = invoices.find((i) => i.id === e.target.value);
          setDraft((d) => ({ ...d, invoiceId: e.target.value, journalNo: inv ? `JRN-${inv.invoiceNo}-MAN` : d.journalNo }));
        }}>
          <option value="">No invoice link (standalone entry)</option>
          {invoices.map((inv) => (
            <option key={inv.id} value={inv.id}>
              {inv.invoiceNo} — {inv.customer} ({inv.totalPkr})
            </option>
          ))}
        </Select>
        <Input label="Entry Date" type="date" value={draft.entryDate} onChange={(e) => setDraft((d) => ({ ...d, entryDate: e.target.value }))} />
      </div>

      {/* Lines */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Lines</p>
          <Button variant="outline" size="sm" onClick={() => setDraft((d) => ({ ...d, lines: [...d.lines, { key: crypto.randomUUID(), accountId: "", side: "debit", amount: 0, description: "" }] }))}>
            <Plus className="mr-1 size-3.5" /> Add
          </Button>
        </div>

        {draft.lines.map((line, idx) => (
          <div key={line.key} className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <select
                value={line.accountId}
                onChange={(e) => setLine(idx, "accountId", e.target.value)}
                className={`${inputCls} flex-1 text-left`}
              >
                <option value="">Select account...</option>
                {accounts.filter((a) => a.status === "Active").map((a) => (
                  <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                ))}
              </select>
              <button type="button" onClick={() => setDraft((d) => ({ ...d, lines: d.lines.length > 2 ? d.lines.filter((_, i) => i !== idx) : d.lines }))} className="text-muted-foreground hover:text-destructive shrink-0">
                <Trash2 className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-[10px] font-medium text-muted-foreground mb-1">Side</p>
                <select value={line.side} onChange={(e) => setLine(idx, "side", e.target.value)} className={inputCls}>
                  <option value="debit">Debit</option>
                  <option value="credit">Credit</option>
                </select>
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground mb-1">Amount (PKR)</p>
                <input type="number" min={0} step="0.01" value={line.amount} onChange={(e) => setLine(idx, "amount", Number(e.target.value || 0))} className={`${inputCls} text-right tabular-nums`} />
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground mb-1">Description</p>
                <input value={line.description} onChange={(e) => setLine(idx, "description", e.target.value)} className={`${inputCls} text-left`} placeholder="Note" />
              </div>
            </div>
          </div>
        ))}

        {/* Balance check */}
        <div className={`rounded-lg p-3 text-sm ${isBalanced ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
          <div className="flex justify-between">
            <span>Debits: {money(totalDebits)}</span>
            <span>Credits: {money(totalCredits)}</span>
          </div>
          {!isBalanced && totalDebits + totalCredits > 0 && (
            <p className="mt-1 text-xs font-semibold">Imbalance: {money(Math.abs(totalDebits - totalCredits))}</p>
          )}
        </div>
      </div>

      <Textarea label="Memo" value={draft.memo} onChange={(e) => setDraft((d) => ({ ...d, memo: e.target.value }))} />

      {error && <p className="text-sm text-destructive">{error}</p>}
    </CmsModal>
  );
}
