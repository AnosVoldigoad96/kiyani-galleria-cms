-- Escape hatch: per-entity structured data overrides (JSON-LD).
-- If non-null, the frontend merges this object into the auto-generated JSON-LD
-- for that entity — e.g. add custom `audience`, `isSimilarTo`, or override
-- `material`/`color` without a code change.
--
-- Shape: a JSON object (merged over defaults) or a JSON array (appended as
-- additional JSON-LD nodes).

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS structured_data_overrides jsonb;
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS structured_data_overrides jsonb;
ALTER TABLE public.subcategories
  ADD COLUMN IF NOT EXISTS structured_data_overrides jsonb;
