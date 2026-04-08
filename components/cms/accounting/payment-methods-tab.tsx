"use client";

import { useState } from "react";

import { CreditCard, Pencil, Plus, Smartphone, Building2, Banknote, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { CmsModal } from "@/components/cms/cms-modal";
import { ConfirmDeleteModal } from "@/components/cms/products/confirm-delete-modal";
import { Button } from "@/components/ui/button";
import type { CmsPaymentMethod } from "@/lib/cms-data";

import {
  createPaymentMethod,
  deletePaymentMethod,
  updatePaymentMethod,
  type PaymentMethodPayload,
} from "./payment-methods-api";

type PaymentMethodsTabProps = {
  methods: CmsPaymentMethod[];
  onRefresh?: () => void;
};

type Draft = {
  name: string;
  type: string;
  accountTitle: string;
  accountNumber: string;
  bankName: string;
  instructions: string;
  isActive: boolean;
  sortOrder: string;
};

const TYPES = [
  { value: "mobile", label: "Mobile Wallet", icon: Smartphone },
  { value: "bank", label: "Bank Transfer", icon: Building2 },
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "other", label: "Other", icon: CreditCard },
];

function emptyDraft(): Draft {
  return {
    name: "",
    type: "mobile",
    accountTitle: "",
    accountNumber: "",
    bankName: "",
    instructions: "",
    isActive: true,
    sortOrder: "0",
  };
}

function draftFromMethod(m: CmsPaymentMethod): Draft {
  return {
    name: m.name,
    type: m.type,
    accountTitle: m.accountTitle,
    accountNumber: m.accountNumber,
    bankName: m.bankName,
    instructions: m.instructions,
    isActive: m.isActive,
    sortOrder: String(m.sortOrder),
  };
}

const inputClass =
  "w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200";
const labelClass = "text-xs font-semibold uppercase tracking-wide text-muted-foreground";

export function PaymentMethodsTab({ methods, onRefresh }: PaymentMethodsTabProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<CmsPaymentMethod | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [deleteTarget, setDeleteTarget] = useState<CmsPaymentMethod | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCreate = () => {
    setEditingMethod(null);
    setDraft(emptyDraft());
    setError(null);
    setEditorOpen(true);
  };

  const openEdit = (method: CmsPaymentMethod) => {
    setEditingMethod(method);
    setDraft(draftFromMethod(method));
    setError(null);
    setEditorOpen(true);
  };

  const save = async () => {
    if (!draft.name.trim()) { setError("Name is required."); return; }

    const payload: PaymentMethodPayload = {
      name: draft.name.trim(),
      type: draft.type,
      account_title: draft.accountTitle.trim() || null,
      account_number: draft.accountNumber.trim() || null,
      bank_name: draft.bankName.trim() || null,
      instructions: draft.instructions.trim() || null,
      is_active: draft.isActive,
      sort_order: Number(draft.sortOrder) || 0,
    };

    setIsSaving(true);
    setError(null);
    try {
      if (editingMethod) {
        await updatePaymentMethod(editingMethod.id, payload);
        toast.success("Payment method updated.");
      } else {
        await createPaymentMethod(payload);
        toast.success("Payment method created.");
      }
      setEditorOpen(false);
      onRefresh?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save.";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setIsSaving(true);
    try {
      await deletePaymentMethod(deleteTarget.id);
      toast.success("Payment method deleted.");
      setDeleteTarget(null);
      onRefresh?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Payment Methods</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure payment options that appear on invoices.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          <Plus className="mr-1.5 size-4" /> Add Method
        </Button>
      </div>

      {methods.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No payment methods configured. Add one to include payment details on invoices.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 sm:px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Name</th>
                <th className="hidden sm:table-cell px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Type</th>
                <th className="hidden md:table-cell px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Account</th>
                <th className="px-3 sm:px-4 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Active</th>
                <th className="px-3 sm:px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {methods.map((m) => {
                const typeInfo = TYPES.find((t) => t.value === m.type) ?? TYPES[3];
                const Icon = typeInfo.icon;
                return (
                  <tr key={m.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-3 sm:px-4 py-3 text-sm font-semibold text-foreground">
                      <div className="flex items-center gap-2">
                        <Icon className="size-4 text-muted-foreground shrink-0" />
                        <div>
                          {m.name}
                          <span className="sm:hidden block text-xs text-muted-foreground font-normal">{typeInfo.label}{m.accountNumber ? ` · ${m.accountNumber}` : ""}</span>
                        </div>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3 text-sm text-muted-foreground">{typeInfo.label}</td>
                    <td className="hidden md:table-cell px-4 py-3 text-sm">
                      <span className="text-foreground">{m.accountTitle || "—"}</span>
                      {m.accountNumber && <span className="text-muted-foreground ml-2 text-xs">{m.accountNumber}</span>}
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-center">
                      <span className={`inline-block size-2.5 rounded-full ${m.isActive ? "bg-emerald-500" : "bg-border"}`} />
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 sm:gap-2">
                        <button onClick={() => openEdit(m)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                          <Pencil className="size-3.5" />
                        </button>
                        <button onClick={() => setDeleteTarget(m)} className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors">
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Editor Modal */}
      <CmsModal
        open={editorOpen}
        title={editingMethod ? "Edit payment method" : "Add payment method"}
        description="Configure account details that will appear on invoices."
        onClose={() => { setEditorOpen(false); setError(null); }}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditorOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={save} disabled={isSaving}>
              {isSaving ? "Saving..." : editingMethod ? "Update" : "Create"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className={labelClass}>Method Name *</span>
            <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} className={inputClass} placeholder="JazzCash" />
          </label>
          <label className="space-y-1">
            <span className={labelClass}>Type</span>
            <select value={draft.type} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))} className={inputClass}>
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className={labelClass}>Account Title</span>
            <input value={draft.accountTitle} onChange={(e) => setDraft((d) => ({ ...d, accountTitle: e.target.value }))} className={inputClass} placeholder="Muhammad Kiyani" />
          </label>
          <label className="space-y-1">
            <span className={labelClass}>Account / IBAN Number</span>
            <input value={draft.accountNumber} onChange={(e) => setDraft((d) => ({ ...d, accountNumber: e.target.value }))} className={inputClass} placeholder="03XX-XXXXXXX" />
          </label>
          <label className="space-y-1">
            <span className={labelClass}>Bank Name</span>
            <input value={draft.bankName} onChange={(e) => setDraft((d) => ({ ...d, bankName: e.target.value }))} className={inputClass} placeholder="Allied Bank" />
          </label>
        </div>
        <label className="space-y-1">
          <span className={labelClass}>Custom Instructions</span>
          <textarea value={draft.instructions} onChange={(e) => setDraft((d) => ({ ...d, instructions: e.target.value }))} className={inputClass} rows={3} placeholder="Any special payment instructions for customers." />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-3 rounded-xl border border-border bg-white px-3 py-2.5 text-sm">
            <input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.checked }))} />
            Active (visible on invoices)
          </label>
          <label className="space-y-1">
            <span className={labelClass}>Sort Order</span>
            <input type="number" value={draft.sortOrder} onChange={(e) => setDraft((d) => ({ ...d, sortOrder: e.target.value }))} className={inputClass} min="0" />
          </label>
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </CmsModal>

      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title="Delete payment method"
        description={`You're about to delete "${deleteTarget?.name ?? ""}".`}
        onClose={() => { setDeleteTarget(null); setError(null); }}
        onConfirm={remove}
        isSaving={isSaving}
        error={error}
      />
    </section>
  );
}
