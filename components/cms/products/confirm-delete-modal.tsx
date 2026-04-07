"use client";

import { CmsModal } from "@/components/cms/cms-modal";
import { Button } from "@/components/ui/button";

type ConfirmDeleteModalProps = {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isSaving: boolean;
  error: string | null;
};

export function ConfirmDeleteModal({
  open,
  title,
  description,
  onClose,
  onConfirm,
  isSaving,
  error,
}: ConfirmDeleteModalProps) {
  return (
    <CmsModal
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={isSaving}>
            {isSaving ? "Deleting..." : "Delete"}
          </Button>
        </>
      }
    >
      <p className="text-sm text-[var(--muted-foreground)]">
        This action is permanent and will immediately remove the data from the storefront.
      </p>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </CmsModal>
  );
}
