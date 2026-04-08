-- SEO columns for products, categories, and subcategories
-- Run this in the Hasura Console → Data → SQL tab
-- All columns are nullable so existing rows are unaffected.

-- Products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS meta_title text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS meta_description text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS keywords text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS og_title text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS og_description text;

-- Categories
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS meta_title text;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS meta_description text;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS keywords text;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS og_title text;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS og_description text;

-- Subcategories
ALTER TABLE public.subcategories ADD COLUMN IF NOT EXISTS meta_title text;
ALTER TABLE public.subcategories ADD COLUMN IF NOT EXISTS meta_description text;
ALTER TABLE public.subcategories ADD COLUMN IF NOT EXISTS keywords text;
ALTER TABLE public.subcategories ADD COLUMN IF NOT EXISTS og_title text;
ALTER TABLE public.subcategories ADD COLUMN IF NOT EXISTS og_description text;
