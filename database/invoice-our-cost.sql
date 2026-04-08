-- Add our_cost column to invoice_lines for COGS tracking
-- Run in Hasura Console → Data → SQL tab
ALTER TABLE public.invoice_lines ADD COLUMN IF NOT EXISTS our_cost_pkr numeric(12,2) NOT NULL DEFAULT 0;
