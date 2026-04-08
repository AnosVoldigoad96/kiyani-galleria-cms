-- Accounting system fix: Add missing accounts
-- Run in Hasura Console → Data → SQL tab

-- Add expense accounts
INSERT INTO public.accounting_accounts (code, name, category, description)
VALUES
  ('6000', 'Shipping Expense', 'expense', 'Delivery and shipping costs'),
  ('6100', 'Operating Expenses', 'expense', 'General operating costs'),
  ('6200', 'Marketing Expense', 'expense', 'Advertising and marketing costs'),
  ('6300', 'Packaging Expense', 'expense', 'Packaging materials and costs'),
  ('2100', 'Sales Tax Payable', 'liability', 'GST/Sales tax collected'),
  ('3000', 'Owner Capital', 'equity', 'Owner investment in business'),
  ('3100', 'Retained Earnings', 'equity', 'Accumulated profits')
ON CONFLICT (code) DO NOTHING;
