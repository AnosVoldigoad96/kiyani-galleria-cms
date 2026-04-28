-- =============================================================================
-- ACCOUNTING UPGRADE — run once in Hasura Console → Data → SQL tab.
-- Idempotent: safe to re-run.
--
-- Brings a pre-existing database up to the schema defined in
-- /accounting_schema.sql (the canonical source of truth) by adding only the
-- new columns, tables, triggers, and seed rows introduced in the accounting fix.
--
-- Run this BEFORE deploying the updated CMS — otherwise `cash_account_code`,
-- `invoice_payments`, etc. will be referenced against a schema that lacks them.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- New columns on existing tables
-- -----------------------------------------------------------------------------

alter table public.payment_methods
  add column if not exists cash_account_code text;

alter table public.invoices
  add column if not exists shipping_pkr numeric(12,2) not null default 0,
  add column if not exists payment_method_id uuid references public.payment_methods(id) on delete set null;

alter table public.invoice_lines
  add column if not exists our_cost_pkr numeric(12,2) not null default 0;

alter table public.journal_entries
  add column if not exists reverses_entry_id uuid references public.journal_entries(id) on delete set null;

-- -----------------------------------------------------------------------------
-- New tables
-- -----------------------------------------------------------------------------

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

-- -----------------------------------------------------------------------------
-- Helpful indexes added alongside the upgrade
-- -----------------------------------------------------------------------------

create index if not exists idx_invoices_due_date on public.invoices(due_date);
create index if not exists idx_journal_entries_reference on public.journal_entries(reference_type, reference_id);

-- -----------------------------------------------------------------------------
-- Immutability triggers: posted journal entries and their lines cannot be edited.
-- Corrections must use reversing entries (journal_entries.reverses_entry_id).
-- -----------------------------------------------------------------------------

create or replace function public.journal_entries_enforce_immutability()
returns trigger language plpgsql as $$
begin
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

  if not exists (select 1 from pg_trigger where tgname = 'journal_entries_audit_trg') then
    create trigger journal_entries_audit_trg
    after insert or update or delete on public.journal_entries
    for each row execute function public.journal_entries_audit();
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Top up the canonical chart of accounts.
-- -----------------------------------------------------------------------------

insert into public.accounting_accounts (code, name, category, description)
values
  ('1010', 'Bank - Primary',       'asset',     'Primary business bank account'),
  ('2100', 'Sales Tax Payable',    'liability', 'GST / sales tax collected, owed to FBR'),
  ('2200', 'Customer Advances',    'liability', 'Overpayments / prepayments owed to customers'),
  ('3000', 'Owner Capital',        'equity',    'Owner investment in business'),
  ('3100', 'Retained Earnings',    'equity',    'Accumulated profits'),
  ('4100', 'Shipping Revenue',     'revenue',   'Shipping charged to customers'),
  ('4900', 'Sales Returns',        'revenue',   'Contra-revenue for customer refunds / returns'),
  ('6000', 'Shipping Expense',     'expense',   'Delivery cost paid to carriers'),
  ('6100', 'Operating Expenses',   'expense',   'General operating costs'),
  ('6200', 'Marketing Expense',    'expense',   'Advertising and marketing'),
  ('6300', 'Packaging Expense',    'expense',   'Packaging materials')
on conflict (code) do nothing;

-- -----------------------------------------------------------------------------
-- Hasura metadata: remember to "Track" payment_methods.cash_account_code,
-- invoice_payments (table), and journal_audit_log (table) from the Hasura
-- console, then reload metadata so GraphQL picks them up.
-- -----------------------------------------------------------------------------

commit;
