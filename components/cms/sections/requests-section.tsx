"use client";

import { useMemo, useState } from "react";

import { motion } from "framer-motion";
import { Pencil, Plus, Reply, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { CmsModal } from "@/components/cms/cms-modal";
import { ConfirmDeleteModal } from "@/components/cms/products/confirm-delete-modal";
import { FilterBar } from "@/components/cms/ui/filter-bar";
import {
  ActionButton,
  StatusBadge,
  sectionTone,
  surfaceClassName,
} from "@/components/cms/cms-shared";
import { Button } from "@/components/ui/button";
import type { CmsRequest } from "@/lib/cms-data";

import {
  createRequest,
  deleteRequest,
  updateRequest,
  type RequestPayload,
  type RequestPriority,
  type RequestStatus,
} from "@/components/cms/requests/requests-api";

type RequestsSectionProps = {
  requests: CmsRequest[];
  onRefresh?: () => void;
};

type RequestDraft = {
  requestNo: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  requestType: string;
  brief: string;
  budgetPkr: string;
  dueDate: string;
  priority: RequestPriority;
  status: RequestStatus;
};

const inputClassName =
  "w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200";

function generateRequestNo() {
  const now = new Date();
  const stamp = [
    now.getFullYear().toString(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "-",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
  return `REQ-${stamp}`;
}

function draftFromRequest(request: CmsRequest | null): RequestDraft {
  if (!request) {
    return {
      requestNo: generateRequestNo(),
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      requestType: "",
      brief: "",
      budgetPkr: "",
      dueDate: "",
      priority: "medium",
      status: "new",
    };
  }

  return {
    requestNo: request.requestNo,
    customerName: request.customer,
    customerEmail: request.customerEmail,
    customerPhone: request.customerPhone,
    requestType: request.type,
    brief: request.brief,
    budgetPkr: request.budgetPkrValue === null ? "" : String(request.budgetPkrValue),
    dueDate: request.dueDateValue ?? "",
    priority: request.priorityCode,
    status: request.statusCode,
  };
}

export function RequestsSection({ requests, onRefresh }: RequestsSectionProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorRequest, setEditorRequest] = useState<CmsRequest | null>(null);
  const [draft, setDraft] = useState<RequestDraft>(() => draftFromRequest(null));
  const [deleteTarget, setDeleteTarget] = useState<CmsRequest | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (statusFilter !== "all" && r.statusCode !== statusFilter) return false;
      if (priorityFilter !== "all" && r.priorityCode !== priorityFilter) return false;
      return true;
    });
  }, [requests, statusFilter, priorityFilter]);

  const hasFilters = statusFilter !== "all" || priorityFilter !== "all";

  const openCreate = () => {
    setError(null);
    setEditorRequest(null);
    setDraft(draftFromRequest(null));
    setEditorOpen(true);
  };

  const openEdit = (request: CmsRequest) => {
    setError(null);
    setEditorRequest(request);
    setDraft(draftFromRequest(request));
    setEditorOpen(true);
  };

  const saveRequest = async () => {
    if (!draft.requestNo.trim()) {
      setError("Request number is required.");
      return;
    }
    if (!draft.customerName.trim()) {
      setError("Customer name is required.");
      return;
    }
    if (!draft.requestType.trim()) {
      setError("Request type is required.");
      return;
    }
    if (!draft.brief.trim()) {
      setError("Request brief is required.");
      return;
    }

    const payload: RequestPayload = {
      request_no: draft.requestNo.trim(),
      user_id: null,
      customer_name: draft.customerName.trim(),
      customer_email: draft.customerEmail.trim() || null,
      customer_phone: draft.customerPhone.trim() || null,
      request_type: draft.requestType.trim(),
      brief: draft.brief.trim(),
      budget_pkr: draft.budgetPkr.trim() ? Number(draft.budgetPkr) : null,
      due_date: draft.dueDate || null,
      priority: draft.priority,
      status: draft.status,
      assigned_to: null,
    };

    setIsSaving(true);
    setError(null);
    try {
      if (editorRequest) {
        await updateRequest(editorRequest.requestId, payload);
        toast.success("Request updated.");
      } else {
        await createRequest(payload);
        toast.success("Request created.");
      }
      setEditorOpen(false);
      setEditorRequest(null);
      onRefresh?.();
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Failed to save request.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const removeRequest = async () => {
    if (!deleteTarget) {
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await deleteRequest(deleteTarget.requestId);
      toast.success("Request deleted.");
      setDeleteTarget(null);
      onRefresh?.();
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Failed to delete request.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const quoteRequest = async (request: CmsRequest) => {
    setIsSaving(true);
    setError(null);
    try {
      await updateRequest(request.requestId, { status: "quoted" });
      toast.success("Request moved to quoted.");
      onRefresh?.();
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Failed to update request.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Requests</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Capture briefs, progress through quote and production, track value.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          <Plus className="mr-1.5 size-4" />
          New Request
        </Button>
      </div>

      <FilterBar
        filters={[
          {
            label: "Status",
            value: statusFilter,
            options: [
              { label: "All statuses", value: "all" },
              { label: "New", value: "new" },
              { label: "Quoted", value: "quoted" },
              { label: "In Progress", value: "in_progress" },
              { label: "Completed", value: "completed" },
              { label: "Cancelled", value: "cancelled" },
            ],
            onChange: setStatusFilter,
          },
          {
            label: "Priority",
            value: priorityFilter,
            options: [
              { label: "All priorities", value: "all" },
              { label: "High", value: "high" },
              { label: "Medium", value: "medium" },
              { label: "Low", value: "low" },
            ],
            onChange: setPriorityFilter,
          },
        ]}
        hasActiveFilters={hasFilters}
        onClearAll={() => { setStatusFilter("all"); setPriorityFilter("all"); }}
      />

      <section className="grid gap-6 xl:grid-cols-3">
        {filteredRequests.length ? (
          filteredRequests.map((request, index) => (
            <motion.article
              key={request.requestId}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.08 }}
              className={surfaceClassName("group p-8")}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                    {request.requestNo}
                  </p>
                  <h2 className="mt-2 text-2xl font-bold text-[var(--foreground)] transition-colors group-hover:text-[var(--primary)]">
                    {request.type}
                  </h2>
                </div>
                <StatusBadge tone={sectionTone(request.status)}>{request.status}</StatusBadge>
              </div>
              <div className="mt-6 flex items-center gap-2 border-y border-[var(--border)]/30 py-4">
                <div className="flex size-8 items-center justify-center rounded-full bg-black/5 text-xs font-bold text-[var(--foreground)]">
                  {request.customer[0]}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[var(--foreground)]">{request.customer}</p>
                  <p className="truncate text-xs text-[var(--muted-foreground)]">
                    {request.customerEmail || "No email"}
                  </p>
                </div>
              </div>
              <p className="mt-5 text-sm italic leading-relaxed text-[var(--muted-foreground)]">
                &ldquo;{request.brief}&rdquo;
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="flex items-center justify-between rounded-2xl border border-[var(--border)]/50 bg-black/[0.02] px-4 py-3 text-xs font-bold text-[var(--foreground)]">
                  <span className="uppercase tracking-tighter text-[var(--muted-foreground)]">Due</span>
                  {request.dueDate}
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-[var(--border)]/50 bg-black/[0.02] px-4 py-3 text-xs font-bold text-[var(--primary)]">
                  <span className="uppercase tracking-tighter text-[var(--muted-foreground)]">Budget</span>
                  {request.budgetPkr}
                </div>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <StatusBadge tone={sectionTone(request.priority)}>{request.priority}</StatusBadge>
                <ActionButton onClick={() => openEdit(request)} disabled={isSaving}>
                  <Pencil className="size-3" />
                  Update
                </ActionButton>
                <ActionButton onClick={() => quoteRequest(request)} disabled={isSaving}>
                  <Reply className="size-3" />
                  Quote
                </ActionButton>
                <ActionButton
                  tone="danger"
                  onClick={() => setDeleteTarget(request)}
                  disabled={isSaving}
                >
                  <Trash2 className="size-3" />
                  Delete
                </ActionButton>
              </div>
            </motion.article>
          ))
        ) : (
          <article className={surfaceClassName("p-8 xl:col-span-3")}>
            <p className="text-sm text-muted-foreground">No custom requests found.</p>
          </article>
        )}
      </section>

      <CmsModal
        open={editorOpen}
        title={editorRequest ? "Edit request" : "Create request"}
        description="Save customer requirements, planned budget, and workflow status."
        onClose={() => {
          setEditorOpen(false);
          setError(null);
        }}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditorOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={saveRequest} disabled={isSaving}>
              {isSaving ? "Saving..." : editorRequest ? "Update request" : "Create request"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Request no</span>
            <input
              value={draft.requestNo}
              onChange={(event) =>
                setDraft((current) => ({ ...current, requestNo: event.target.value }))
              }
              className={inputClassName}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Type</span>
            <input
              value={draft.requestType}
              onChange={(event) =>
                setDraft((current) => ({ ...current, requestType: event.target.value }))
              }
              className={inputClassName}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer name</span>
            <input
              value={draft.customerName}
              onChange={(event) =>
                setDraft((current) => ({ ...current, customerName: event.target.value }))
              }
              className={inputClassName}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer email</span>
            <input
              type="email"
              value={draft.customerEmail}
              onChange={(event) =>
                setDraft((current) => ({ ...current, customerEmail: event.target.value }))
              }
              className={inputClassName}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer phone</span>
            <input
              value={draft.customerPhone}
              onChange={(event) =>
                setDraft((current) => ({ ...current, customerPhone: event.target.value }))
              }
              className={inputClassName}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Due date</span>
            <input
              type="date"
              value={draft.dueDate}
              onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))}
              className={inputClassName}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Budget (PKR)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={draft.budgetPkr}
              onChange={(event) =>
                setDraft((current) => ({ ...current, budgetPkr: event.target.value }))
              }
              className={inputClassName}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Priority</span>
            <select
              value={draft.priority}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  priority: event.target.value as RequestPriority,
                }))
              }
              className={inputClassName}
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</span>
            <select
              value={draft.status}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  status: event.target.value as RequestStatus,
                }))
              }
              className={inputClassName}
            >
              <option value="new">New</option>
              <option value="quoted">Quoted</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
        </div>
        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Brief</span>
          <textarea
            rows={4}
            value={draft.brief}
            onChange={(event) => setDraft((current) => ({ ...current, brief: event.target.value }))}
            className={inputClassName}
          />
        </label>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </CmsModal>

      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title="Delete request"
        description={`You're about to delete "${deleteTarget?.requestNo ?? ""}".`}
        onClose={() => {
          setDeleteTarget(null);
          setError(null);
        }}
        onConfirm={removeRequest}
        isSaving={isSaving}
        error={error}
      />
    </section>
  );
}
