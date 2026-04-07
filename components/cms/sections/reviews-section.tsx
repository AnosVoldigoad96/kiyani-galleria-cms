"use client";

import { useMemo, useState } from "react";

import { motion } from "framer-motion";
import { Pencil, Reply, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { CmsModal } from "@/components/cms/cms-modal";
import { ConfirmDeleteModal } from "@/components/cms/products/confirm-delete-modal";
import { FilterBar } from "@/components/cms/ui/filter-bar";
import { StatCard } from "@/components/cms/ui/stat-card";
import { Button } from "@/components/ui/button";
import type { CmsReview } from "@/lib/cms-data";

import {
  deleteReview,
  deleteReviewReply,
  saveReviewReply,
  updateReview,
  type ReviewStatus,
} from "@/components/cms/reviews/reviews-api";
import {
  ActionButton,
  Stars,
  StatusBadge,
  sectionTone,
  surfaceClassName,
} from "@/components/cms/cms-shared";

type ReviewsSectionProps = {
  reviews: CmsReview[];
  onRefresh?: () => void;
};

type ReviewDraft = {
  customer: string;
  rating: number;
  comment: string;
  status: ReviewStatus;
  reply: string;
};

const inputClassName =
  "w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200";

function draftFromReview(review: CmsReview): ReviewDraft {
  return {
    customer: review.customer,
    rating: review.rating,
    comment: review.comment,
    status: review.statusCode,
    reply: review.reply ?? "",
  };
}

export function ReviewsSection({ reviews, onRefresh }: ReviewsSectionProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorReview, setEditorReview] = useState<CmsReview | null>(null);
  const [draft, setDraft] = useState<ReviewDraft>({
    customer: "",
    rating: 5,
    comment: "",
    status: "pending",
    reply: "",
  });
  const [deleteTarget, setDeleteTarget] = useState<CmsReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");

  const stats = useMemo(() => {
    const published = reviews.filter((review) => review.statusCode === "published").length;
    const pending = reviews.filter((review) => review.statusCode === "pending").length;
    const flagged = reviews.filter((review) => review.statusCode === "flagged").length;
    const avgRating =
      reviews.length > 0
        ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
        : "0.0";

    return { published, pending, flagged, avgRating };
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    return reviews.filter((r) => {
      if (statusFilter !== "all" && r.statusCode !== statusFilter) return false;
      if (ratingFilter !== "all" && String(Math.round(r.rating)) !== ratingFilter) return false;
      return true;
    });
  }, [reviews, statusFilter, ratingFilter]);

  const hasFilters = statusFilter !== "all" || ratingFilter !== "all";

  const openEditor = (review: CmsReview) => {
    setError(null);
    setEditorReview(review);
    setDraft(draftFromReview(review));
    setEditorOpen(true);
  };

  const saveReviewChanges = async () => {
    if (!editorReview) {
      return;
    }

    if (!draft.customer.trim()) {
      setError("Customer name is required.");
      return;
    }
    if (!draft.comment.trim()) {
      setError("Review comment is required.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await updateReview(editorReview.reviewId, {
        customer_name: draft.customer.trim(),
        rating: Math.max(1, Math.min(5, Number(draft.rating || 1))),
        comment: draft.comment.trim(),
        status: draft.status,
      });

      if (draft.reply.trim()) {
        await saveReviewReply(editorReview.reviewId, draft.reply.trim());
      } else if (editorReview.reply) {
        await deleteReviewReply(editorReview.reviewId);
      }

      toast.success("Review updated.");
      setEditorOpen(false);
      setEditorReview(null);
      onRefresh?.();
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Failed to save review.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const quickReply = async (review: CmsReview) => {
    setIsSaving(true);
    setError(null);
    try {
      await saveReviewReply(review.reviewId, review.reply ?? "Thank you for sharing your feedback.");
      await updateReview(review.reviewId, { status: "published" });
      toast.success("Reply saved and review published.");
      onRefresh?.();
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Failed to update review.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const removeReview = async () => {
    if (!deleteTarget) {
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await deleteReview(deleteTarget.reviewId);
      toast.success("Review deleted.");
      setDeleteTarget(null);
      onRefresh?.();
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Failed to delete review.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Reviews</h2>
          <p className="mt-1 text-sm text-muted-foreground">Moderate customer feedback and manage replies.</p>
        </div>
        <Button
          onClick={() => {
            const firstPending = reviews.find((review) => review.statusCode !== "published");
            if (firstPending) openEditor(firstPending);
          }}
        >
          <Reply className="mr-1.5 size-4" />
          Reply Queue
        </Button>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Published" value={String(stats.published)} detail={`Avg rating ${stats.avgRating}`} />
        <StatCard label="Pending" value={String(stats.pending)} detail="Action required" />
        <StatCard label="Flagged" value={String(stats.flagged)} detail="Moderation queue" />
      </section>

      <FilterBar
        filters={[
          {
            label: "Status",
            value: statusFilter,
            options: [
              { label: "All statuses", value: "all" },
              { label: "Published", value: "published" },
              { label: "Pending", value: "pending" },
              { label: "Flagged", value: "flagged" },
            ],
            onChange: setStatusFilter,
          },
          {
            label: "Rating",
            value: ratingFilter,
            options: [
              { label: "All ratings", value: "all" },
              { label: "5 stars", value: "5" },
              { label: "4 stars", value: "4" },
              { label: "3 stars", value: "3" },
              { label: "2 stars", value: "2" },
              { label: "1 star", value: "1" },
            ],
            onChange: setRatingFilter,
          },
        ]}
        hasActiveFilters={hasFilters}
        onClearAll={() => { setStatusFilter("all"); setRatingFilter("all"); }}
      />

      <section className="grid gap-4 xl:grid-cols-2">
        {filteredReviews.length ? filteredReviews.map((review, index) => (
            <motion.article
              key={review.reviewId}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.08 }}
              className="group flex flex-col justify-between rounded-[2.5rem] border border-white/60 bg-white/40 p-6 shadow-sm transition-all duration-500 hover:bg-white hover:shadow-xl hover:shadow-black/5"
            >
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-[var(--primary)]/10 text-xl font-bold text-[var(--primary)]">
                      {review.customer[0]}
                    </div>
                    <div>
                      <p className="font-bold tracking-tight text-[var(--foreground)]">{review.customer}</p>
                      <p className="mt-0.5 text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                        {review.product} <span className="mx-1 opacity-30">/</span> {review.date}
                      </p>
                    </div>
                  </div>
                  <StatusBadge tone={sectionTone(review.status)}>{review.status}</StatusBadge>
                </div>
                <div className="mt-5 flex items-center gap-2 border-y border-[var(--border)]/30 py-4">
                  <Stars value={review.rating} />
                </div>
                <p className="mt-5 text-sm font-medium leading-relaxed text-[var(--foreground)]">
                  &ldquo;{review.comment}&rdquo;
                </p>
                <div className="mt-6 rounded-2xl border border-[var(--border)]/50 bg-black/[0.02] p-5 backdrop-blur-sm">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                    Official Reply
                  </p>
                  <p className="mt-3 text-sm italic leading-relaxed text-[var(--foreground)]/80">
                    {review.reply ?? "Pending response from the Kiyani Studio team..."}
                  </p>
                </div>
              </div>
              <div className="mt-8 flex flex-wrap gap-2">
                <ActionButton onClick={() => quickReply(review)} disabled={isSaving}>
                  <Reply className="size-3" />
                  Reply
                </ActionButton>
                <ActionButton onClick={() => openEditor(review)} disabled={isSaving}>
                  <Pencil className="size-3" />
                  Edit
                </ActionButton>
                <ActionButton tone="danger" onClick={() => setDeleteTarget(review)} disabled={isSaving}>
                  <Trash2 className="size-3" />
                  Remove
                </ActionButton>
              </div>
            </motion.article>
          )) : (
            <p className="text-sm text-muted-foreground xl:col-span-2 py-8 text-center">No reviews match the current filters.</p>
          )}
      </section>

      <CmsModal
        open={editorOpen}
        title="Edit review"
        description={editorReview ? `${editorReview.product} review moderation` : ""}
        onClose={() => {
          setEditorOpen(false);
          setError(null);
        }}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setEditorOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="button" onClick={saveReviewChanges} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save review"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer</span>
            <input
              value={draft.customer}
              onChange={(event) => setDraft((current) => ({ ...current, customer: event.target.value }))}
              className={inputClassName}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rating</span>
            <input
              type="number"
              min={1}
              max={5}
              step="0.1"
              value={draft.rating}
              onChange={(event) =>
                setDraft((current) => ({ ...current, rating: Number(event.target.value || 1) }))
              }
              className={inputClassName}
            />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</span>
            <select
              value={draft.status}
              onChange={(event) =>
                setDraft((current) => ({ ...current, status: event.target.value as ReviewStatus }))
              }
              className={inputClassName}
            >
              <option value="pending">Pending</option>
              <option value="published">Published</option>
              <option value="flagged">Flagged</option>
            </select>
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Review comment</span>
            <textarea
              rows={4}
              value={draft.comment}
              onChange={(event) => setDraft((current) => ({ ...current, comment: event.target.value }))}
              className={inputClassName}
            />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Official reply</span>
            <textarea
              rows={3}
              value={draft.reply}
              onChange={(event) => setDraft((current) => ({ ...current, reply: event.target.value }))}
              className={inputClassName}
              placeholder="Leave empty to remove reply"
            />
          </label>
        </div>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </CmsModal>

      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title="Delete review"
        description={`You're about to delete review "${deleteTarget?.reviewId ?? ""}".`}
        onClose={() => {
          setDeleteTarget(null);
          setError(null);
        }}
        onConfirm={removeReview}
        isSaving={isSaving}
        error={error}
      />
    </div>
  );
}
