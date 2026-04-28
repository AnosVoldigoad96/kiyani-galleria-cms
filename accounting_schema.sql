begin;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'accounting_account_category') then
    create type public.accounting_account_category as enum (
      'asset',
      'liability',
      'equity',
      'revenue',
      'expense',
      'cogs'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'invoice_status') then
    create type public.invoice_status as enum (
      'draft',
      'issued',
      'partially_paid',
      'paid',
      'overdue',
      'void'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'journal_status') then
    create type public.journal_status as enum ('draft', 'posted', 'void');
  end if;
end $$;

alter table public.products
  add column if not exists our_price_pkr numeric(12,2) not null default 0;

create table if not exists public.accounting_accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category public.accounting_account_category not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'mobile',
  account_title text,
  account_number text,
  bank_name text,
  instructions text,
  whatsapp_number text,
  -- Ledger account this payment method posts to. Null falls back to 1000 (Cash in Hand).
  cash_account_code text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no text not null unique,
  order_id uuid references public.orders(id) on delete set null,
  customer_profile_id uuid references public.profiles(id) on delete set null,
  customer_name text not null,
  customer_email text,
  issue_date date not null default current_date,
  due_date date,
  subtotal_pkr numeric(12,2) not null default 0,
  discount_pkr numeric(12,2) not null default 0,
  shipping_pkr numeric(12,2) not null default 0,
  tax_pkr numeric(12,2) not null default 0,
  total_pkr numeric(12,2) not null default 0,
  paid_pkr numeric(12,2) not null default 0,
  balance_pkr numeric(12,2) not null default 0,
  status public.invoice_status not null default 'draft',
  notes text,
  payment_method_id uuid references public.payment_methods(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Legacy installs may not have these columns; ensure they exist.
alter table public.invoices add column if not exists shipping_pkr numeric(12,2) not null default 0;
alter table public.invoices add column if not exists payment_method_id uuid references public.payment_methods(id) on delete set null;

create table if not exists public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  description text not null,
  quantity numeric(12,2) not null default 1,
  unit_price_pkr numeric(12,2) not null default 0,
  line_total_pkr numeric(12,2) not null default 0,
  our_cost_pkr numeric(12,2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.invoice_lines add column if not exists our_cost_pkr numeric(12,2) not null default 0;

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  journal_no text not null unique,
  entry_date date not null default current_date,
  reference_type text,
  reference_id uuid,
  memo text,
  status public.journal_status not null default 'draft',
  -- Reversing link: if this entry reverses a previously posted entry, this points at it.
  reverses_entry_id uuid references public.journal_entries(id) on delete set null,
  posted_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.journal_entries
  add column if not exists reverses_entry_id uuid references public.journal_entries(id) on delete set null;

create table if not exists public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references public.journal_entries(id) on delete cascade,
  account_id uuid not null references public.accounting_accounts(id) on delete restrict,
  description text,
  debit_pkr numeric(12,2) not null default 0,
  credit_pkr numeric(12,2) not null default 0,
  line_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint journal_lines_one_side_chk check (
    (debit_pkr > 0 and credit_pkr = 0) or
    (credit_pkr > 0 and debit_pkr = 0) or
    (credit_pkr = 0 and debit_pkr = 0)
  )
);

-- Payment history: each customer payment is its own ledger event with its own date.
-- Refunds are represented as negative amount_pkr rows.
create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount_pkr numeric(12,2) not null check (amount_pkr <> 0),
  payment_date date not null default current_date,
  payment_method_id uuid references public.payment_methods(id) on delete set null,
  journal_entry_id uuid references public.journal_entries(id) on delete set null,
  is_overpayment boolean not null default false,
  memo text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_invoice_payments_invoice_id on public.invoice_payments(invoice_id);
create index if not exists idx_invoice_payments_payment_date on public.invoice_payments(payment_date);

create index if not exists idx_invoices_order_id on public.invoices(order_id);
create index if not exists idx_invoices_customer_profile_id on public.invoices(customer_profile_id);
create index if not exists idx_invoices_status on public.invoices(status);
create index if not exists idx_invoices_due_date on public.invoices(due_date);
create index if not exists idx_invoice_lines_invoice_id on public.invoice_lines(invoice_id);
create index if not exists idx_journal_entries_status on public.journal_entries(status);
create index if not exists idx_journal_entries_entry_date on public.journal_entries(entry_date);
create index if not exists idx_journal_entries_reference on public.journal_entries(reference_type, reference_id);
create index if not exists idx_journal_lines_journal_entry_id on public.journal_lines(journal_entry_id);
create index if not exists idx_journal_lines_account_id on public.journal_lines(account_id);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_accounting_accounts_updated_at') then
    create trigger set_accounting_accounts_updated_at
    before update on public.accounting_accounts
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_invoices_updated_at') then
    create trigger set_invoices_updated_at
    before update on public.invoices
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_journal_entries_updated_at') then
    create trigger set_journal_entries_updated_at
    before update on public.journal_entries
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_payment_methods_updated_at') then
    create trigger set_payment_methods_updated_at
    before update on public.payment_methods
    for each row execute function public.set_updated_at();
  end if;
end $$;

-- ============================================================================
-- IMMUTABILITY: posted journal entries cannot be edited or have lines mutated.
-- Corrections must use reversing entries (entry with reverses_entry_id set).
-- Draft entries are freely mutable; void entries are terminal.
-- ============================================================================

create or replace function public.journal_entries_enforce_immutability()
returns trigger language plpgsql as $$
begin
  -- Allow status transitions: draft → posted, posted → void, draft → void.
  -- Block any edit to a posted entry's content fields.
  if old.status = 'posted' and tg_op = 'UPDATE' then
    if new.status not in ('posted', 'void') then
      raise exception 'Posted journal entries cannot revert to draft (entry %). Use a reversing entry.', old.id;
    end if;
    if new.entry_date is distinct from old.entry_date
       or new.reference_type is distinct from old.reference_type
       or new.reference_id is distinct from old.reference_id
       or new.journal_no is distinct from old.journal_no then
      raise exception 'Posted journal entry % is immutable. Create a reversing entry instead.', old.id;
    end if;
  end if;
  if old.status = 'void' and tg_op = 'UPDATE' and new.status <> 'void' then
    raise exception 'Void journal entry % cannot be revived.', old.id;
  end if;
  return new;
end $$;

create or replace function public.journal_lines_enforce_immutability()
returns trigger language plpgsql as $$
declare
  parent_status public.journal_status;
begin
  if tg_op = 'DELETE' then
    select status into parent_status from public.journal_entries where id = old.journal_entry_id;
    if parent_status = 'posted' then
      raise exception 'Cannot delete lines on posted journal entry %. Use a reversing entry.', old.journal_entry_id;
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    select status into parent_status from public.journal_entries where id = old.journal_entry_id;
    if parent_status = 'posted' then
      raise exception 'Cannot modify lines on posted journal entry %.', old.journal_entry_id;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    select status into parent_status from public.journal_entries where id = new.journal_entry_id;
    if parent_status = 'void' then
      raise exception 'Cannot add lines to a void journal entry %.', new.journal_entry_id;
    end if;
    return new;
  end if;

  return new;
end $$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'journal_entries_immutability') then
    create trigger journal_entries_immutability
    before update on public.journal_entries
    for each row execute function public.journal_entries_enforce_immutability();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'journal_lines_immutability') then
    create trigger journal_lines_immutability
    before insert or update or delete on public.journal_lines
    for each row execute function public.journal_lines_enforce_immutability();
  end if;
end $$;

-- ============================================================================
-- AUDIT LOG: every write to a journal entry is logged.
-- ============================================================================

create table if not exists public.journal_audit_log (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid,
  action text not null,
  old_status public.journal_status,
  new_status public.journal_status,
  actor uuid references public.profiles(id) on delete set null,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_journal_audit_log_entry on public.journal_audit_log(journal_entry_id);

create or replace function public.journal_entries_audit()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    insert into public.journal_audit_log(journal_entry_id, action, new_status, actor)
    values (new.id, 'insert', new.status, new.created_by);
  elsif tg_op = 'UPDATE' then
    if old.status is distinct from new.status then
      insert into public.journal_audit_log(journal_entry_id, action, old_status, new_status, actor)
      values (new.id, 'status_change', old.status, new.status, new.updated_by);
    end if;
  elsif tg_op = 'DELETE' then
    insert into public.journal_audit_log(journal_entry_id, action, old_status, actor, details)
    values (old.id, 'delete', old.status, null, to_jsonb(old));
  end if;
  return coalesce(new, old);
end $$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'journal_entries_audit_trg') then
    create trigger journal_entries_audit_trg
    after insert or update or delete on public.journal_entries
    for each row execute function public.journal_entries_audit();
  end if;
end $$;

-- ============================================================================
-- SEED: canonical chart of accounts. Code is fully idempotent.
-- These codes are referenced directly from application code — do not rename.
-- ============================================================================

insert into public.accounting_accounts (code, name, category, description)
values
  ('1000', 'Cash in Hand',         'asset',     'Primary cash account (default)'),
  ('1010', 'Bank - Primary',       'asset',     'Primary business bank account'),
  ('1100', 'Accounts Receivable',  'asset',     'Outstanding customer invoices'),
  ('1200', 'Inventory',            'asset',     'Inventory carried at cost'),
  ('2000', 'Accounts Payable',     'liability', 'Vendor balances'),
  ('2100', 'Sales Tax Payable',    'liability', 'GST / sales tax collected, owed to FBR'),
  ('2200', 'Customer Advances',    'liability', 'Overpayments / prepayments owed to customers'),
  ('3000', 'Owner Capital',        'equity',    'Owner investment in business'),
  ('3100', 'Retained Earnings',    'equity',    'Accumulated profits'),
  ('4000', 'Sales Revenue',        'revenue',   'Retail sales income'),
  ('4100', 'Shipping Revenue',     'revenue',   'Shipping charged to customers'),
  ('4900', 'Sales Returns',        'revenue',   'Contra-revenue for customer refunds / returns'),
  ('5000', 'Cost of Goods Sold',   'cogs',      'Inventory cost recognized on sale'),
  ('6000', 'Shipping Expense',     'expense',   'Delivery cost paid to carriers'),
  ('6100', 'Operating Expenses',   'expense',   'General operating costs'),
  ('6200', 'Marketing Expense',    'expense',   'Advertising and marketing'),
  ('6300', 'Packaging Expense',    'expense',   'Packaging materials')
on conflict (code) do nothing;

commit;
