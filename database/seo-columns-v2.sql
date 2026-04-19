-- SEO columns v2: per-entity overrides for canonical URL, OG image, robots, sitemap.
-- Additive + nullable — safe to run on top of existing data.
-- Run in Hasura Console → Data → SQL, then "Track" the new columns in the relation.

-- Products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS canonical_url text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS og_image_url text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS robots_noindex boolean NOT NULL DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sitemap_priority numeric(2,1);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sitemap_changefreq text;

-- Categories
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS canonical_url text;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS og_image_url text;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS robots_noindex boolean NOT NULL DEFAULT false;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS sitemap_priority numeric(2,1);
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS sitemap_changefreq text;

-- Subcategories
ALTER TABLE public.subcategories ADD COLUMN IF NOT EXISTS canonical_url text;
ALTER TABLE public.subcategories ADD COLUMN IF NOT EXISTS og_image_url text;
ALTER TABLE public.subcategories ADD COLUMN IF NOT EXISTS robots_noindex boolean NOT NULL DEFAULT false;
ALTER TABLE public.subcategories ADD COLUMN IF NOT EXISTS sitemap_priority numeric(2,1);
ALTER TABLE public.subcategories ADD COLUMN IF NOT EXISTS sitemap_changefreq text;

-- Guard rails (only values we actually emit in sitemap.xml)
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_sitemap_changefreq_check,
  ADD  CONSTRAINT products_sitemap_changefreq_check
    CHECK (sitemap_changefreq IS NULL OR sitemap_changefreq IN
      ('always','hourly','daily','weekly','monthly','yearly','never'));

ALTER TABLE public.categories
  DROP CONSTRAINT IF EXISTS categories_sitemap_changefreq_check,
  ADD  CONSTRAINT categories_sitemap_changefreq_check
    CHECK (sitemap_changefreq IS NULL OR sitemap_changefreq IN
      ('always','hourly','daily','weekly','monthly','yearly','never'));

ALTER TABLE public.subcategories
  DROP CONSTRAINT IF EXISTS subcategories_sitemap_changefreq_check,
  ADD  CONSTRAINT subcategories_sitemap_changefreq_check
    CHECK (sitemap_changefreq IS NULL OR sitemap_changefreq IN
      ('always','hourly','daily','weekly','monthly','yearly','never'));

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_sitemap_priority_check,
  ADD  CONSTRAINT products_sitemap_priority_check
    CHECK (sitemap_priority IS NULL OR (sitemap_priority >= 0 AND sitemap_priority <= 1));

ALTER TABLE public.categories
  DROP CONSTRAINT IF EXISTS categories_sitemap_priority_check,
  ADD  CONSTRAINT categories_sitemap_priority_check
    CHECK (sitemap_priority IS NULL OR (sitemap_priority >= 0 AND sitemap_priority <= 1));

ALTER TABLE public.subcategories
  DROP CONSTRAINT IF EXISTS subcategories_sitemap_priority_check,
  ADD  CONSTRAINT subcategories_sitemap_priority_check
    CHECK (sitemap_priority IS NULL OR (sitemap_priority >= 0 AND sitemap_priority <= 1));

-- Partial indexes for sitemap queries (only hit indexable rows)
CREATE INDEX IF NOT EXISTS idx_products_indexable
  ON public.products (updated_at)
  WHERE status = 'live' AND robots_noindex = false;

CREATE INDEX IF NOT EXISTS idx_categories_indexable
  ON public.categories (updated_at)
  WHERE is_visible = true AND robots_noindex = false;

CREATE INDEX IF NOT EXISTS idx_subcategories_indexable
  ON public.subcategories (updated_at)
  WHERE status = 'live' AND robots_noindex = false;
