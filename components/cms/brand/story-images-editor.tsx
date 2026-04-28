"use client";

import {
  ImageCollectionEditor,
  type CollectionImage,
  type SlotConfig,
} from "@/components/cms/brand/image-collection-editor";

export type StoryImage = CollectionImage;

// Preview is wider than tall to mimic the story page composition
const SLOTS: SlotConfig[] = [
  {
    index: 0,
    label: "Slot 1 — Banner hero",
    hint: "Wide 21:9 banner shown above the heritage section.",
    previewClass: "absolute top-0 left-0 right-0 h-[42%] rounded-2xl",
  },
  {
    index: 1,
    label: "Slot 2 — Heritage portrait",
    hint: "4:3 image next to the 'Our Heritage' text block.",
    previewClass: "absolute bottom-[2%] left-0 w-[38%] h-[54%] rounded-2xl",
  },
  {
    index: 2,
    label: "Slot 3 — Workshop detail",
    hint: "4:5 portrait. Left of the staggered grid.",
    previewClass: "absolute bottom-[2%] left-[40%] w-[28%] h-[48%] rounded-2xl",
  },
  {
    index: 3,
    label: "Slot 4 — Sisters at work",
    hint: "4:5 portrait. Right of the staggered grid (raised slightly).",
    previewClass: "absolute bottom-[10%] right-0 w-[28%] h-[48%] rounded-2xl",
  },
];

export function StoryImagesEditor({
  initialImages,
  onRefresh,
}: {
  initialImages: StoryImage[];
  onRefresh?: () => void;
}) {
  return (
    <ImageCollectionEditor
      eyebrow="Story page"
      title="About page images"
      description="4 photos shown across the story page: the banner, the heritage portrait, and two grid tiles."
      settingKey="story_images"
      slots={SLOTS}
      initialImages={initialImages}
      previewAspect="aspect-[16/10]"
      onRefresh={onRefresh}
    />
  );
}
