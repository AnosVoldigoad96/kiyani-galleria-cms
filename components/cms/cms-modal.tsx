"use client";

import type { ReactNode } from "react";

import { AnimatePresence, motion } from "framer-motion";

type CmsModalProps = {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
};

export function CmsModal({
  open,
  title,
  description,
  children,
  footer,
  onClose,
}: CmsModalProps) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.button
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            className="fixed inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className="relative flex flex-col w-full max-w-2xl max-h-[90vh] sm:max-h-[85vh] rounded-2xl sm:rounded-[2rem] border border-[var(--border)] bg-white shadow-[0_20px_60px_rgba(34,34,34,0.2)] overflow-hidden"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <div className="flex flex-shrink-0 items-start justify-between gap-4 p-5 sm:p-8 border-b border-[var(--border)]/30 z-10 bg-white">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                  CMS
                </p>
                <h2 className="mt-1 text-xl font-semibold text-[var(--foreground)]">
                  {title}
                </h2>
                {description ? (
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">{description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
              >
                Close
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-5 sm:space-y-6">
              {children}
            </div>
            
            {footer ? (
              <div className="flex flex-shrink-0 flex-col-reverse sm:flex-row justify-end gap-3 p-5 sm:p-8 border-t border-[var(--border)]/30 z-10 bg-[var(--muted)]/30 [&>*]:w-full sm:[&>*]:w-auto">
                {footer}
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
