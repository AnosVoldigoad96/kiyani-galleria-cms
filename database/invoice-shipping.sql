-- Add shipping column to invoices
-- Run in Hasura Console → Data → SQL tab
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS shipping_pkr numeric(12,2) NOT NULL DEFAULT 0;
