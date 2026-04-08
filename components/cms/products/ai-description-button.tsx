"use client";

import { Sparkles, Loader2 } from "lucide-react";

type AiDescriptionButtonProps = {
  onClick: () => void;
  isGenerating: boolean;
};

export function AiDescriptionButton({ onClick, isGenerating }: AiDescriptionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isGenerating}
      title="Generate description with AI"
      className="inline-flex items-center justify-center size-7 rounded-lg bg-[var(--primary)] text-white transition-all hover:opacity-90 disabled:opacity-50 shrink-0"
    >
      {isGenerating ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <Sparkles size={14} />
      )}
    </button>
  );
}
