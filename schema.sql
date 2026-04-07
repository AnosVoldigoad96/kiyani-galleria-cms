begin;

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'record_status') then
    create type public.record_status as enum ('draft', 'live', 'archived');
  end if;

  if not exists (select 1 from pg_type where typname = 'review_status') then
    create type public.review_status as enum ('pending', 'published', 'flagged');
  end if;

  if not exists (select 1 from pg_type where typname = 'request_priority') then
    create type public.request_priority as enum ('low', 'medium', 'high');
  end if;

  if not exists (select 1 from pg_type where typname = 'request_status') then
    create type public.request_status as enum ('new', 'quoted', 'in_progress', 'completed', 'cancelled');
  end if;

  if not exists (select 1 from pg_type where typname = 'order_payment_status') then
    create type public.order_payment_status as enum ('pending', 'paid', 'failed', 'refunded');
  end if;

  if not exists (select 1 from pg_type where typname = 'order_fulfillment_status') then
    create type public.order_fulfillment_status as enum ('processing', 'packed', 'dispatched', 'delivered', 'cancelled');
  end if;

  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'manager', 'customer');
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text unique,
  role public.app_role not null default 'customer',
  status text not null default 'active',
  phone text,
  city text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  sort_order integer not null default 0,
  status public.record_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, name),
  unique (category_id, slug)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  category_id uuid not null references public.categories(id) on delete restrict,
  subcategory_id uuid references public.subcategories(id) on delete set null,
  name text not null,
  slug text not null unique,
  image_url text,
  image_alt text,
  description text not null,
  price_pkr numeric(12,2) not null default 0,
  rating numeric(2,1) not null default 0,
  stock_quantity integer not null default 0,
  stock_label text,
  discount_enabled boolean not null default false,
  discount_percentage numeric(5,2) not null default 0,
  is_trending boolean not null default false,
  is_best_seller boolean not null default false,
  is_new_arrival boolean not null default false,
  is_top_rated boolean not null default false,
  is_deal_of_the_day boolean not null default false,
  status public.record_status not null default 'draft',
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_features (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  feature text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  customer_name text not null,
  rating numeric(2,1) not null default 0,
  comment text not null,
  status public.review_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.review_replies (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null unique references public.reviews(id) on delete cascade,
  replied_by uuid references public.profiles(id) on delete set null,
  reply text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  user_id uuid references public.profiles(id) on delete set null,
  customer_name text not null,
  customer_email text,
  customer_phone text,
  city text,
  address text,
  payment_status public.order_payment_status not null default 'pending',
  fulfillment_status public.order_fulfillment_status not null default 'processing',
  subtotal_pkr numeric(12,2) not null default 0,
  discount_pkr numeric(12,2) not null default 0,
  shipping_pkr numeric(12,2) not null default 0,
  total_pkr numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  sku text,
  quantity integer not null default 1,
  unit_price_pkr numeric(12,2) not null default 0,
  total_price_pkr numeric(12,2) not null default 0
);

create table if not exists public.custom_requests (
  id uuid primary key default gen_random_uuid(),
  request_no text not null unique,
  user_id uuid references public.profiles(id) on delete set null,
  customer_name text not null,
  customer_email text,
  customer_phone text,
  request_type text not null,
  brief text not null,
  budget_pkr numeric(12,2),
  due_date date,
  priority public.request_priority not null default 'medium',
  status public.request_status not null default 'new',
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brand_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_subcategories_category_id on public.subcategories(category_id);
create index if not exists idx_products_category_id on public.products(category_id);
create index if not exists idx_products_subcategory_id on public.products(subcategory_id);
create index if not exists idx_products_status on public.products(status);
create index if not exists idx_reviews_product_id on public.reviews(product_id);
create index if not exists idx_reviews_status on public.reviews(status);
create index if not exists idx_orders_user_id on public.orders(user_id);
create index if not exists idx_orders_payment_status on public.orders(payment_status);
create index if not exists idx_orders_fulfillment_status on public.orders(fulfillment_status);
create index if not exists idx_order_items_order_id on public.order_items(order_id);
create index if not exists idx_custom_requests_user_id on public.custom_requests(user_id);
create index if not exists idx_custom_requests_status on public.custom_requests(status);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_profiles_updated_at') then
    create trigger set_profiles_updated_at
    before update on public.profiles
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_categories_updated_at') then
    create trigger set_categories_updated_at
    before update on public.categories
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_subcategories_updated_at') then
    create trigger set_subcategories_updated_at
    before update on public.subcategories
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_products_updated_at') then
    create trigger set_products_updated_at
    before update on public.products
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_reviews_updated_at') then
    create trigger set_reviews_updated_at
    before update on public.reviews
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_review_replies_updated_at') then
    create trigger set_review_replies_updated_at
    before update on public.review_replies
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_orders_updated_at') then
    create trigger set_orders_updated_at
    before update on public.orders
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_custom_requests_updated_at') then
    create trigger set_custom_requests_updated_at
    before update on public.custom_requests
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_brand_settings_updated_at') then
    create trigger set_brand_settings_updated_at
    before update on public.brand_settings
    for each row execute function public.set_updated_at();
  end if;
end $$;

insert into public.brand_settings (key, value)
values
  ('announcement_bar', '{"text":"Handmade keepsakes made to order in Pakistan"}'::jsonb),
  ('primary_cta_label', '{"text":"Shop curated gifts"}'::jsonb),
  ('review_request_message', '{"text":"Tell us how your order felt when it arrived"}'::jsonb),
  ('brand_voice', '{"text":"Soft, polished, handmade, premium"}'::jsonb)
on conflict (key) do nothing;

commit;
