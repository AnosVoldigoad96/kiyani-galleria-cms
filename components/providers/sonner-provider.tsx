"use client";

import { Toaster } from "sonner";

export function SonnerProvider() {
  return (
    <Toaster
      position="bottom-right"
      richColors
      toastOptions={{
        className:
          "rounded-2xl border border-[var(--border)] bg-white/95 text-[var(--foreground)] shadow-[0_20px_40px_rgba(34,34,34,0.12)] backdrop-blur",
      }}
    />
  );
}
