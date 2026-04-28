"use client";

import {
  ImageCollectionEditor,
  type CollectionImage,
  type SlotConfig,
} from "@/components/cms/brand/image-collection-editor";

export type PromiseImage = CollectionImage;

const SLOTS: SlotConfig[] = [
  {
    index: 0,
    label: "Slot 1 — Large",
    hint: "Wide hero shot. Top-left, dominant.",
    previewClass: "absolute top-0 left-0 w-[58%] h-[62%] rounded-3xl",
  },
  {
    index: 1,
    label: "Slot 2 — Medium portrait",
    hint: "Vertical portrait works best. Top-right.",
    previewClass: "absolute top-[6%] right-0 w-[38%] h-[44%] rounded-2xl",
  },
  {
    index: 2,
    label: "Slot 3 — Square / landscape",
    hint: "Bottom-right.",
    previewClass: "absolute bottom-0 right-[8%] w-[42%] h-[40%] rounded-2xl",
  },
  {
    index: 3,
    label: "Slot 4 — Detail shot",
    hint: "Tight detail / closeup. Bottom-left, raised.",
    previewClass: "absolute bottom-[6%] left-[10%] w-[32%] h-[30%] rounded-2xl",
  },
];

export function PromiseCollageEditor({
  initialImages,
  onRefresh,
}: {
  initialImages: PromiseImage[];
  onRefresh?: () => void;
}) {
  return (
    <ImageCollectionEditor
      eyebrow="Homepage section"
      title="Promise collage"
      description='4 photos arranged as an asymmetrical collage on the homepage "The Kiyani Promise" section.'
      settingKey="promise_collage"
      slots={SLOTS}
      initialImages={initialImages}
      onRefresh={onRefresh}
    />
  );
}
