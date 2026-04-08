# Database Setup

This project is currently structured around a PostgreSQL database managed through Nhost/Hasura.

## Stack

- Database: PostgreSQL
- Auth source: `auth.users` from Nhost Auth
- API layer: Hasura GraphQL over the public schema
- App auth client: `@nhost/nhost-js`

## Current App Expectations

The CMS and auth flow currently expect:

- Nhost email/password login only
- A `public.profiles` table linked to `auth.users`
- Product catalog data with categories, subcategories, features, reviews, orders, requests, and brand settings
- Foreign-key relationships so Hasura can expose nested GraphQL fields

## Enums

The database setup uses these enum types:

- `public.record_status`
  - `draft`
  - `live`
  - `archived`

- `public.review_status`
  - `pending`
  - `published`
  - `flagged`

- `public.request_priority`
  - `low`
  - `medium`
  - `high`

- `public.request_status`
  - `new`
  - `quoted`
  - `in_progress`
  - `completed`
  - `cancelled`

- `public.order_payment_status`
  - `pending`
  - `paid`
  - `failed`
  - `refunded`

- `public.order_fulfillment_status`
  - `processing`
  - `packed`
  - `dispatched`
  - `delivered`
  - `cancelled`

- `public.app_role`
  - `admin`
  - `manager`
  - `customer`

## Tables

### `public.profiles`

Extends Nhost auth users with app-specific information.

Columns:

- `id uuid primary key references auth.users(id)`
- `full_name text`
- `email text unique`
- `role public.app_role`
- `status text`
- `phone text`
- `city text`
- `avatar_url text`
- `created_at timestamptz`
- `updated_at timestamptz`

Purpose:

- Stores app roles for CMS access
- Holds display information for admin/customer records

### `public.categories`

Top-level product taxonomy.

Columns:

- `id uuid primary key`
- `name text unique`
- `slug text unique`
- `description text`
- `sort_order integer`
- `is_visible boolean`
- `meta_title text` (AI-generated SEO title, max 60 chars)
- `meta_description text` (AI-generated meta description, max 160 chars)
- `keywords text` (comma-separated search keywords)
- `og_title text` (Open Graph social sharing title)
- `og_description text` (Open Graph social sharing description)
- `created_at timestamptz`
- `updated_at timestamptz`

### `public.subcategories`

Child taxonomy under categories.

Columns:

- `id uuid primary key`
- `category_id uuid references public.categories(id)`
- `name text`
- `slug text`
- `description text`
- `sort_order integer`
- `status public.record_status`
- `meta_title text` (AI-generated SEO title)
- `meta_description text` (AI-generated meta description)
- `keywords text` (comma-separated search keywords)
- `og_title text` (Open Graph title)
- `og_description text` (Open Graph description)
- `created_at timestamptz`
- `updated_at timestamptz`

Constraints:

- unique per category on `name`
- unique per category on `slug`

### `public.products`

Main product catalog table used by the CMS.

Columns:

- `id uuid primary key`
- `sku text unique`
- `category_id uuid references public.categories(id)`
- `subcategory_id uuid references public.subcategories(id)`
- `name text`
- `slug text unique`
- `image_url text`
- `image_alt text`
- `description text`
- `price_pkr numeric(12,2)`
- `rating numeric(2,1)`
- `stock_quantity integer`
- `stock_label text`
- `discount_enabled boolean`
- `discount_percentage numeric(5,2)`
- `is_trending boolean`
- `is_best_seller boolean`
- `is_new_arrival boolean`
- `is_top_rated boolean`
- `is_deal_of_the_day boolean`
- `status public.record_status`
- `created_by uuid references public.profiles(id)`
- `updated_by uuid references public.profiles(id)`
- `meta_title text` (AI-generated SEO title, max 60 chars)
- `meta_description text` (AI-generated meta description, max 160 chars)
- `keywords text` (comma-separated extensive search keywords, used for frontend search)
- `og_title text` (Open Graph social sharing title)
- `og_description text` (Open Graph social sharing description)
- `created_at timestamptz`
- `updated_at timestamptz`

Purpose:

- Supports the CMS product management requirements
- Stores PKR pricing, discount toggle, merchandising flags, and status
- SEO fields are AI-generated via Groq Llama API and editable by staff

### `public.product_features`

Stores repeatable product feature rows.

Columns:

- `id uuid primary key`
- `product_id uuid references public.products(id)`
- `feature text`
- `sort_order integer`
- `created_at timestamptz`

Purpose:

- Keeps product features normalized instead of storing them in a single text field

### `public.reviews`

Customer product reviews.

Columns:

- `id uuid primary key`
- `product_id uuid references public.products(id)`
- `user_id uuid references public.profiles(id)`
- `customer_name text`
- `rating numeric(2,1)`
- `comment text`
- `status public.review_status`
- `created_at timestamptz`
- `updated_at timestamptz`

### `public.review_replies`

Single admin reply per review.

Columns:

- `id uuid primary key`
- `review_id uuid unique references public.reviews(id)`
- `replied_by uuid references public.profiles(id)`
- `reply text`
- `created_at timestamptz`
- `updated_at timestamptz`

Purpose:

- Supports CMS reply workflow for moderation and responses

### `public.orders`

Order header table.

Columns:

- `id uuid primary key`
- `order_no text unique`
- `user_id uuid references public.profiles(id)`
- `customer_name text`
- `customer_email text`
- `customer_phone text`
- `city text`
- `address text`
- `payment_status public.order_payment_status`
- `fulfillment_status public.order_fulfillment_status`
- `subtotal_pkr numeric(12,2)`
- `discount_pkr numeric(12,2)`
- `shipping_pkr numeric(12,2)`
- `total_pkr numeric(12,2)`
- `notes text`
- `created_at timestamptz`
- `updated_at timestamptz`

### `public.order_items`

Line items for each order.

Columns:

- `id uuid primary key`
- `order_id uuid references public.orders(id)`
- `product_id uuid references public.products(id)`
- `product_name text`
- `sku text`
- `quantity integer`
- `unit_price_pkr numeric(12,2)`
- `total_price_pkr numeric(12,2)`

Purpose:

- Preserves product snapshots per order
- Models one-to-many order contents correctly

### `public.custom_requests`

Custom order and inquiry tracking.

Columns:

- `id uuid primary key`
- `request_no text unique`
- `user_id uuid references public.profiles(id)`
- `customer_name text`
- `customer_email text`
- `customer_phone text`
- `request_type text`
- `brief text`
- `budget_pkr numeric(12,2)`
- `due_date date`
- `priority public.request_priority`
- `status public.request_status`
- `assigned_to uuid references public.profiles(id)`
- `created_at timestamptz`
- `updated_at timestamptz`

### `public.brand_settings`

Simple key/value configuration table for the CMS and storefront.

Columns:

- `key text primary key`
- `value jsonb`
- `updated_by uuid references public.profiles(id)`
- `updated_at timestamptz`

Purpose:

- Stores editable brand/system settings without a dedicated table per setting

## Relationships

### User-related

- `auth.users.id -> public.profiles.id`
- `public.profiles.id -> public.orders.user_id`
- `public.profiles.id -> public.custom_requests.user_id`
- `public.profiles.id -> public.custom_requests.assigned_to`
- `public.profiles.id -> public.reviews.user_id`
- `public.profiles.id -> public.products.created_by`
- `public.profiles.id -> public.products.updated_by`
- `public.profiles.id -> public.review_replies.replied_by`
- `public.profiles.id -> public.brand_settings.updated_by`

### Catalog-related

- `public.categories.id -> public.subcategories.category_id`
- `public.categories.id -> public.products.category_id`
- `public.subcategories.id -> public.products.subcategory_id`
- `public.products.id -> public.product_features.product_id`
- `public.products.id -> public.reviews.product_id`
- `public.products.id -> public.order_items.product_id`

### Order-related

- `public.orders.id -> public.order_items.order_id`

### Review-related

- `public.reviews.id -> public.review_replies.review_id`

## Logical ERD

```text
auth.users
  -> profiles

profiles
  -> orders
  -> custom_requests
  -> reviews
  -> review_replies
  -> products (created_by / updated_by)
  -> brand_settings

categories
  -> subcategories
  -> products

subcategories
  -> products

products
  -> product_features
  -> reviews
  -> order_items

orders
  -> order_items

reviews
  -> review_replies
```

## Indexes

Expected indexes from the current SQL setup:

- `idx_subcategories_category_id`
- `idx_products_category_id`
- `idx_products_subcategory_id`
- `idx_products_status`
- `idx_reviews_product_id`
- `idx_reviews_status`
- `idx_orders_user_id`
- `idx_orders_payment_status`
- `idx_orders_fulfillment_status`
- `idx_order_items_order_id`
- `idx_custom_requests_user_id`
- `idx_custom_requests_status`

## Updated Timestamp Trigger

The schema uses a shared trigger function:

- `public.set_updated_at()`

Applied to:

- `profiles`
- `categories`
- `subcategories`
- `products`
- `reviews`
- `review_replies`
- `orders`
- `custom_requests`

This ensures `updated_at` is automatically refreshed on update.

## Seeded Brand Settings

The setup includes these default keys:

- `announcement_bar`
- `primary_cta_label`
- `review_request_message`
- `brand_voice`

## Auth Behavior in the App

Current app authentication behavior:

- Login route: `/login`
- Protected area: `/cms`
- Sign-in method: Nhost email/password only
- No signup flow in the app UI
- Auth guard redirects unauthenticated users from `/cms` to `/login`

Required env vars:

- `NEXT_PUBLIC_NHOST_SUBDOMAIN`
- `NEXT_PUBLIC_NHOST_REGION`

Or direct service URLs:

- `NEXT_PUBLIC_NHOST_AUTH_URL`
- `NEXT_PUBLIC_NHOST_GRAPHQL_URL`
- `NEXT_PUBLIC_NHOST_STORAGE_URL`
- `NEXT_PUBLIC_NHOST_FUNCTIONS_URL`

## Notes

- GraphQL is used after the schema exists. Tables and relationships must be created with SQL/migrations.
- Hasura should automatically expose relationship fields when foreign keys are present.
- Role-based permissions and RLS policies are not yet documented here unless you have already added them manually in Nhost/Hasura.
