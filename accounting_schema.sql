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
  tax_pkr numeric(12,2) not null default 0,
  total_pkr numeric(12,2) not null default 0,
  paid_pkr numeric(12,2) not null default 0,
  balance_pkr numeric(12,2) not null default 0,
  status public.invoice_status not null default 'draft',
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  description text not null,
  quantity numeric(12,2) not null default 1,
  unit_price_pkr numeric(12,2) not null default 0,
  line_total_pkr numeric(12,2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  journal_no text not null unique,
  entry_date date not null default current_date,
  reference_type text,
  reference_id uuid,
  memo text,
  status public.journal_status not null default 'draft',
  posted_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create index if not exists idx_invoices_order_id on public.invoices(order_id);
create index if not exists idx_invoices_customer_profile_id on public.invoices(customer_profile_id);
create index if not exists idx_invoices_status on public.invoices(status);
create index if not exists idx_invoice_lines_invoice_id on public.invoice_lines(invoice_id);
create index if not exists idx_journal_entries_status on public.journal_entries(status);
create index if not exists idx_journal_entries_entry_date on public.journal_entries(entry_date);
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
end $$;

insert into public.accounting_accounts (code, name, category, description)
values
  ('1000', 'Cash in Hand', 'asset', 'Primary cash account'),
  ('1100', 'Accounts Receivable', 'asset', 'Outstanding customer invoices'),
  ('1200', 'Inventory', 'asset', 'Inventory carried at cost'),
  ('2000', 'Accounts Payable', 'liability', 'Vendor balances'),
  ('4000', 'Sales Revenue', 'revenue', 'Retail sales income'),
  ('5000', 'Cost of Goods Sold', 'cogs', 'Inventory cost recognized on sale')
on conflict (code) do nothing;

commit;
