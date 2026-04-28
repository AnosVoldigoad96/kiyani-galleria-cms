-- SUPERSEDED: the canonical chart of accounts, payment_methods table, invoice_payments
-- table, immutability triggers, audit log, and all seed accounts now live in
-- ../accounting_schema.sql. Run that file once instead of this patch.
--
-- Kept here as a minimal idempotent top-up so existing databases still converge if someone
-- re-runs migrations in order.

INSERT INTO public.accounting_accounts (code, name, category, description)
VALUES
  ('6000', 'Shipping Expense',  'expense',   'Delivery and shipping costs'),
  ('6100', 'Operating Expenses','expense',   'General operating costs'),
  ('6200', 'Marketing Expense', 'expense',   'Advertising and marketing costs'),
  ('6300', 'Packaging Expense', 'expense',   'Packaging materials and costs'),
  ('2100', 'Sales Tax Payable', 'liability', 'GST/Sales tax collected'),
  ('2200', 'Customer Advances', 'liability', 'Overpayments / prepayments owed to customers'),
  ('3000', 'Owner Capital',     'equity',    'Owner investment in business'),
  ('3100', 'Retained Earnings', 'equity',    'Accumulated profits'),
  ('4100', 'Shipping Revenue',  'revenue',   'Shipping charged to customers'),
  ('4900', 'Sales Returns',     'revenue',   'Contra-revenue for customer refunds / returns'),
  ('1010', 'Bank - Primary',    'asset',     'Primary business bank account')
ON CONFLICT (code) DO NOTHING;
