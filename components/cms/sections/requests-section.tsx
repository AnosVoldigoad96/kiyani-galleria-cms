"use client";

import { Fragment, useMemo, useState } from "react";

import { ChevronDown, Pencil, Plus, Reply, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { CmsModal } from "@/components/cms/cms-modal";
import { ConfirmDeleteModal } from "@/components/cms/products/confirm-delete-modal";
import { OrderEditor, type RequestPrefill } from "@/components/cms/orders/order-editor";
import { FilterBar } from "@/components/cms/ui/filter-bar";
import {
  ActionButton,
  StatusBadge,
  sectionTone,
  surfaceClassName,
} from "@/components/cms/cms-shared";
import { Button } from "@/components/ui/button";
import type { CmsProduct, CmsRequest } from "@/lib/cms-data";

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
  products: CmsProduct[];
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

function RequestsTable({
  requests,
  isSaving,
  onEdit,
  onQuote,
  onConvert,
  onDelete,
}: {
  requests: CmsRequest[];
  isSaving: boolean;
  onEdit: (r: CmsRequest) => void;
  onQuote: (r: CmsRequest) => void;
  onConvert: (r: CmsRequest) => void;
  onDelete: (r: CmsRequest) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (requests.length === 0) {
    return (
      <div className={surfaceClassName("p-8")}>
        <p className="text-sm text-muted-foreground">No custom requests found.</p>
      </div>
    );
  }

  const thClass = "px-3 sm:px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]";
  const tdClass = "px-3 sm:px-4 py-3 text-sm";

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className={`${thClass} w-8`} />
            <th className={thClass}>Request</th>
            <th className={`${thClass} hidden sm:table-cell`}>Type</th>
            <th className={thClass}>Status</th>
            <th className={`${thClass} hidden md:table-cell`}>Budget</th>
            <th className={`${thClass} hidden lg:table-cell`}>Due</th>
            <th className={`${thClass} text-right`}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => {
            const isExpanded = expandedId === request.requestId;
            return (
              <Fragment key={request.requestId}>
                <tr
                  className="border-b border-[var(--border)]/50 transition-colors hover:bg-black/[0.015] cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : request.requestId)}
                >
                  <td className={tdClass}>
                    <ChevronDown
                      size={14}
                      className={`text-[var(--muted-foreground)] transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </td>
                  <td className={tdClass}>
                    <span className="font-semibold text-[var(--foreground)] block">{request.customer}</span>
                    <span className="text-xs text-[var(--muted-foreground)]">{request.requestNo}</span>
                    <span className="sm:hidden block mt-0.5 text-xs text-[var(--muted-foreground)]">{request.type}</span>
                  </td>
                  <td className={`${tdClass} font-medium hidden sm:table-cell`}>{request.type}</td>
                  <td className={tdClass}>
                    <div className="flex flex-col gap-1">
                      <StatusBadge tone={sectionTone(request.status)}>{request.status}</StatusBadge>
                      <StatusBadge tone={sectionTone(request.priority)}>{request.priority}</StatusBadge>
                    </div>
                  </td>
                  <td className={`${tdClass} font-semibold text-[var(--primary)] hidden md:table-cell`}>{request.budgetPkr}</td>
                  <td className={`${tdClass} text-[var(--muted-foreground)] hidden lg:table-cell`}>{request.dueDate}</td>
                  <td className={`${tdClass} text-right`}>
                    <div className="flex items-center justify-end gap-1 sm:gap-2" onClick={(e) => e.stopPropagation()}>
                      {request.statusCode !== "completed" && request.statusCode !== "cancelled" && (
                        <ActionButton onClick={() => onConvert(request)} disabled={isSaving}>
                          <ShoppingBag className="size-3" />
                        </ActionButton>
                      )}
                      <ActionButton onClick={() => onEdit(request)} disabled={isSaving}>
                        <Pencil className="size-3" />
                      </ActionButton>
                      <ActionButton onClick={() => onQuote(request)} disabled={isSaving}>
                        <Reply className="size-3" />
                      </ActionButton>
                      <ActionButton tone="danger" onClick={() => onDelete(request)} disabled={isSaving}>
                        <Trash2 className="size-3" />
                      </ActionButton>
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="border-b border-[var(--border)]/50 bg-[var(--muted)]/30">
                    <td colSpan={7} className="px-4 sm:px-6 py-4">
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)] mb-1">Contact</p>
                          <p className="text-sm font-semibold text-[var(--foreground)]">{request.customer}</p>
                          <p className="text-sm text-[var(--muted-foreground)]">{request.customerEmail || "No email"}</p>
                          <p className="text-sm text-[var(--muted-foreground)]">{request.customerPhone || "No phone"}</p>
                        </div>
                        <div className="md:hidden">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)] mb-1">Budget</p>
                          <p className="text-sm font-semibold text-[var(--primary)]">{request.budgetPkr}</p>
                        </div>
                        <div className="lg:hidden">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)] mb-1">Due Date</p>
                          <p className="text-sm text-[var(--foreground)]">{request.dueDate}</p>
                        </div>
                        <div className="sm:col-span-2 lg:col-span-2">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)] mb-1">Brief</p>
                          <p className="text-sm leading-relaxed text-[var(--foreground)] italic">
                            &ldquo;{request.brief}&rdquo;
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function RequestsSection({ requests, products, onRefresh }: RequestsSectionProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorRequest, setEditorRequest] = useState<CmsRequest | null>(null);
  const [draft, setDraft] = useState<RequestDraft>(() => draftFromRequest(null));
  const [deleteTarget, setDeleteTarget] = useState<CmsRequest | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [orderEditorOpen, setOrderEditorOpen] = useState(false);
  const [convertingRequest, setConvertingRequest] = useState<CmsRequest | null>(null);

  const convertToOrder = (request: CmsRequest) => {
    setConvertingRequest(request);
    setOrderEditorOpen(true);
  };

  const handleOrderCreated = async () => {
    // Update request status to in_progress after order is created
    if (convertingRequest) {
      try {
        await updateRequest(convertingRequest.requestId, { status: "in_progress" });
      } catch { /* non-critical */ }
    }
    setOrderEditorOpen(false);
    setConvertingRequest(null);
    onRefresh?.();
  };

  const requestPrefill: RequestPrefill | null = convertingRequest ? {
    orderNo: convertingRequest.requestNo,
    userId: convertingRequest.userId,
    customerName: convertingRequest.customer,
    customerEmail: convertingRequest.customerEmail,
    customerPhone: convertingRequest.customerPhone,
    notes: `[${convertingRequest.type}] ${convertingRequest.brief}`,
    budgetPkr: convertingRequest.budgetPkrValue ?? 0,
  } : null;

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

      {/* Mobile: Card layout */}
      <div className="sm:hidden space-y-3">
        {filteredRequests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No custom requests found.
          </div>
        ) : (
          filteredRequests.map((request) => (
            <div key={request.requestId} className="rounded-xl border border-border bg-white p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-foreground">{request.customer}</p>
                  <p className="text-xs text-muted-foreground">{request.requestNo}</p>
                </div>
                <StatusBadge tone={sectionTone(request.status)}>{request.status}</StatusBadge>
              </div>
              <p className="text-sm text-muted-foreground italic line-clamp-2">&ldquo;{request.brief}&rdquo;</p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{request.type}</span>
                <StatusBadge tone={sectionTone(request.priority)}>{request.priority}</StatusBadge>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <div className="text-xs text-muted-foreground">
                  {request.budgetPkr !== "PKR 0" && <span className="text-primary font-semibold mr-3">{request.budgetPkr}</span>}
                  {request.dueDate !== "No date" && <span>{request.dueDate}</span>}
                </div>
                <div className="flex gap-1">
                  {request.statusCode !== "completed" && request.statusCode !== "cancelled" && (
                    <ActionButton onClick={() => convertToOrder(request)} disabled={isSaving}><ShoppingBag className="size-3" /></ActionButton>
                  )}
                  <ActionButton onClick={() => openEdit(request)} disabled={isSaving}><Pencil className="size-3" /></ActionButton>
                  <ActionButton onClick={() => quoteRequest(request)} disabled={isSaving}><Reply className="size-3" /></ActionButton>
                  <ActionButton tone="danger" onClick={() => setDeleteTarget(request)} disabled={isSaving}><Trash2 className="size-3" /></ActionButton>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop: Table layout */}
      <div className="hidden sm:block">
        <RequestsTable
          requests={filteredRequests}
          isSaving={isSaving}
          onEdit={openEdit}
          onQuote={quoteRequest}
          onConvert={convertToOrder}
          onDelete={(r) => setDeleteTarget(r)}
        />
      </div>

      {/* Order Editor for converting request to order */}
      <OrderEditor
        open={orderEditorOpen}
        editingOrder={null}
        products={products}
        prefillFromRequest={requestPrefill}
        onClose={() => { setOrderEditorOpen(false); setConvertingRequest(null); }}
        onRefresh={handleOrderCreated}
      />

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
