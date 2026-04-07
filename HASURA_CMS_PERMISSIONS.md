# CMS Hasura Permissions

This is the clean implementation guide for the CMS and accounting side of the project.

Use it when you want to stop the role confusion and apply one consistent permission model.

This guide assumes:

- storefront users already use Hasura roles `anonymous` and `user`
- customers and staff both authenticate with JWT role `user`
- business access is controlled by `public.profiles.role`

This file does not replace the storefront guide.
It complements it.

The storefront guide remains:

- [STOREFRONT_PERMISSIONS.md](C:/Users/skill/Downloads/Vibe%20Coding/CraftsbyKiyani/crafts-kiyani-frontend/STOREFRONT_PERMISSIONS.md)

## Goal

After following this file:

- customers still use the storefront normally
- staff still authenticate with JWT role `user`
- only `profiles.role = admin` or `manager` can access CMS/accounting tables
- Hasura exposes the correct query and mutation fields to role `user` for staff only
- old conflicting CMS permissions are removed

## The Correct Role Model

Keep these Hasura JWT roles:

- `anonymous`
- `user`
- `me` if Nhost already uses it

Do not use these as frontend JWT roles:

- `customer`
- `admin`
- `manager`

Those are business roles stored in `public.profiles.role`.

Meaning:

- customer account:
  - JWT role = `user`
  - `public.profiles.role = customer`
  - storefront allowed
  - CMS/accounting blocked

- staff account:
  - JWT role = `user`
  - `public.profiles.role = admin` or `manager`
  - storefront allowed
  - CMS/accounting allowed

## Required JWT Claims

Your authenticated token should contain:

- `x-hasura-default-role = user`
- `x-hasura-allowed-roles` includes `user`
- `x-hasura-user-id = auth.users.id`

## Required Business Role Data

Every CMS user must have a row in `public.profiles`.

The row must use:

- `role = admin` or `role = manager`

If the row is missing, or role is `customer`, CMS/accounting must stay blocked.

## Shared Staff Filter

This is the core filter used to expose CMS/accounting tables only to staff:

```json
{
  "_exists": {
    "_table": {
      "schema": "public",
      "name": "profiles"
    },
    "_where": {
      "_and": [
        {
          "id": {
            "_eq": "X-Hasura-User-Id"
          }
        },
        {
          "role": {
            "_in": [
              "admin",
              "manager"
            ]
          }
        }
      ]
    }
  }
}
```

This filter is what keeps CMS/accounting off customer accounts even though they also use JWT role `user`.

## CMS Tables Covered By This Guide

Catalog / CMS tables:

- `public.categories`
- `public.subcategories`
- `public.products`
- `public.product_features`
- `public.reviews`
- `public.review_replies`
- `public.orders`
- `public.order_items`
- `public.custom_requests`
- `public.brand_settings`
- `public.profiles`

Accounting tables:

- `public.accounting_accounts`
- `public.invoices`
- `public.invoice_lines`
- `public.journal_entries`
- `public.journal_lines`

## Before You Start

For each table below:

1. open Hasura Console
2. go to `Data`
3. open the table
4. open `Permissions`
5. inspect role `user`
6. remove old conflicting CMS permissions for role `user`
7. recreate them exactly as described below

Important:

- do not delete the storefront permissions that already exist for `anonymous`
- do not remove storefront `user` permissions on customer tables unless they conflict directly
- do not create a new client-facing JWT role for admin users

## Step 1: `public.profiles`

Purpose:

- the app must always be able to read the current user's own profile
- the app uses this to discover whether the current `user` is `admin`, `manager`, or `customer`

### Role `user`

Add `select`

Row filter:

```json
{
  "id": {
    "_eq": "X-Hasura-User-Id"
  }
}
```

Columns:

- `id`
- `full_name`
- `email`
- `role`
- `status`
- `phone`
- `city`
- `avatar_url`
- `created_at`
- `updated_at`

Do not add client-side:

- `insert`
- `update`
- `delete`

Why:

- every signed-in user, including customers, must be able to read their own role
- CMS access is decided after reading this row

## Step 2: `public.categories`

### Role `user`

Keep storefront `select` permission if you already have it.

For CMS access, make sure `user` can also see category data when the staff filter passes.

If you are using one shared `select` permission, use the least restrictive rule that still works for both storefront and CMS.
The safest clean split is:

- storefront reads happen through the existing storefront rule
- CMS reads happen through the server admin route

For full GraphiQL/schema visibility as staff, add or update `select` using the staff filter:

```json
{
  "_exists": {
    "_table": {
      "schema": "public",
      "name": "profiles"
    },
    "_where": {
      "_and": [
        {
          "id": {
            "_eq": "X-Hasura-User-Id"
          }
        },
        {
          "role": {
            "_in": [
              "admin",
              "manager"
            ]
          }
        }
      ]
    }
  }
}
```

Columns:

- `id`
- `name`
- `slug`
- `description`
- `sort_order`
- `is_visible`
- `created_at`
- `updated_at`

Add staff-only write permissions:

- `insert`
- `update`
- `delete`

Use the same staff filter for row check / row filter where applicable.

Allowed insert/update columns:

- `name`
- `slug`
- `description`
- `sort_order`
- `is_visible`

## Step 3: `public.subcategories`

### Role `user`

Add `select`

Use the shared staff filter.

Columns:

- `id`
- `category_id`
- `name`
- `slug`
- `description`
- `sort_order`
- `status`
- `created_at`
- `updated_at`

Add staff-only:

- `insert`
- `update`
- `delete`

Allowed insert/update columns:

- `category_id`
- `name`
- `slug`
- `description`
- `sort_order`
- `status`

## Step 4: `public.products`

### Role `user`

Keep storefront `select` for live products as described in the storefront file.

For CMS/accounting staff access, the row filter should use the shared staff filter.

Columns to allow for staff:

- `id`
- `sku`
- `category_id`
- `subcategory_id`
- `name`
- `slug`
- `image_url`
- `image_alt`
- `description`
- `price_pkr`
- `our_price_pkr`
- `rating`
- `stock_quantity`
- `stock_label`
- `discount_enabled`
- `discount_percentage`
- `is_trending`
- `is_best_seller`
- `is_new_arrival`
- `is_top_rated`
- `is_deal_of_the_day`
- `status`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`

Add staff-only:

- `insert`
- `update`
- `delete`

Insert columns:

- `sku`
- `category_id`
- `subcategory_id`
- `name`
- `slug`
- `image_url`
- `image_alt`
- `description`
- `price_pkr`
- `our_price_pkr`
- `rating`
- `stock_quantity`
- `stock_label`
- `discount_enabled`
- `discount_percentage`
- `is_trending`
- `is_best_seller`
- `is_new_arrival`
- `is_top_rated`
- `is_deal_of_the_day`
- `status`
- `created_by`
- `updated_by`

Update columns:

- same as insert, except primary key is not updated

Recommended presets:

- `created_by = X-Hasura-User-Id` for insert
- `updated_by = X-Hasura-User-Id` for insert/update if you want automatic ownership tracking

## Step 5: `public.product_features`

### Role `user`

Add `select`

Use the shared staff filter.

Columns:

- `id`
- `product_id`
- `feature`
- `sort_order`
- `created_at`

Add staff-only:

- `insert`
- `update`
- `delete`

Insert/update columns:

- `product_id`
- `feature`
- `sort_order`

## Step 6: `public.reviews`

### Role `user`

Keep storefront published-review access from the storefront file.

For CMS moderation, staff should also get:

- `select`
- `update`
- optional `delete`

Use the shared staff filter.

Columns for staff:

- `id`
- `product_id`
- `user_id`
- `customer_name`
- `rating`
- `comment`
- `status`
- `created_at`
- `updated_at`

Allowed update columns:

- `status`

Do not allow customer-side review moderation through this permission.

## Step 7: `public.review_replies`

### Role `user`

Add `select`

Use the shared staff filter.

Columns:

- `id`
- `review_id`
- `replied_by`
- `reply`
- `created_at`
- `updated_at`

Add staff-only:

- `insert`
- `update`
- `delete`

Allowed insert/update columns:

- `review_id`
- `replied_by`
- `reply`

Recommended preset:

- `replied_by = X-Hasura-User-Id`

## Step 8: `public.orders`

This table is shared by storefront customers and CMS staff.

### Role `user`

Keep storefront customer permissions from the storefront guide.

For staff, also allow CMS access using the shared staff filter.

Columns for staff:

- `id`
- `order_no`
- `user_id`
- `customer_name`
- `customer_email`
- `customer_phone`
- `city`
- `address`
- `payment_status`
- `fulfillment_status`
- `subtotal_pkr`
- `discount_pkr`
- `shipping_pkr`
- `total_pkr`
- `notes`
- `created_at`
- `updated_at`

Add staff-only:

- `select`
- `update`

Allowed update columns:

- `customer_name`
- `customer_email`
- `customer_phone`
- `city`
- `address`
- `payment_status`
- `fulfillment_status`
- `subtotal_pkr`
- `discount_pkr`
- `shipping_pkr`
- `total_pkr`
- `notes`

Usually do not allow client-side `delete` on orders.

## Step 9: `public.order_items`

This table is also shared.

### Role `user`

Keep storefront customer permissions from the storefront guide.

For staff, also allow:

- `select`
- `update`

Use the shared staff filter.

Columns for staff:

- `id`
- `order_id`
- `product_id`
- `product_name`
- `sku`
- `quantity`
- `unit_price_pkr`
- `total_price_pkr`

Allowed update columns:

- `product_name`
- `sku`
- `quantity`
- `unit_price_pkr`
- `total_price_pkr`

## Step 10: `public.custom_requests`

### Role `user`

Add `select`

Use the shared staff filter.

Columns:

- `id`
- `request_no`
- `user_id`
- `customer_name`
- `customer_email`
- `customer_phone`
- `request_type`
- `brief`
- `budget_pkr`
- `due_date`
- `priority`
- `status`
- `assigned_to`
- `created_at`
- `updated_at`

Add staff-only:

- `insert`
- `update`
- `delete`

Allowed insert/update columns:

- `request_no`
- `user_id`
- `customer_name`
- `customer_email`
- `customer_phone`
- `request_type`
- `brief`
- `budget_pkr`
- `due_date`
- `priority`
- `status`
- `assigned_to`

## Step 11: `public.brand_settings`

### Role `user`

Add `select`

Use the shared staff filter.

Columns:

- `key`
- `value`
- `updated_by`
- `updated_at`

Add staff-only:

- `insert`
- `update`
- optional `delete`

Allowed insert/update columns:

- `key`
- `value`
- `updated_by`

Recommended preset:

- `updated_by = X-Hasura-User-Id`

## Step 12: `public.accounting_accounts`

### Role `user`

Add `select`

Use the shared staff filter.

Columns:

- `id`
- `code`
- `name`
- `category`
- `description`
- `is_active`
- `created_at`
- `updated_at`

Add staff-only:

- `insert`
- `update`
- optional `delete`

Allowed insert/update columns:

- `code`
- `name`
- `category`
- `description`
- `is_active`

## Step 13: `public.invoices`

### Role `user`

Add `select`

Use the shared staff filter.

Columns:

- `id`
- `invoice_no`
- `order_id`
- `customer_profile_id`
- `customer_name`
- `customer_email`
- `issue_date`
- `due_date`
- `subtotal_pkr`
- `discount_pkr`
- `tax_pkr`
- `total_pkr`
- `paid_pkr`
- `balance_pkr`
- `status`
- `notes`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`

Add staff-only:

- `insert`
- `update`
- optional `delete`

Allowed insert/update columns:

- `invoice_no`
- `order_id`
- `customer_profile_id`
- `customer_name`
- `customer_email`
- `issue_date`
- `due_date`
- `subtotal_pkr`
- `discount_pkr`
- `tax_pkr`
- `total_pkr`
- `paid_pkr`
- `balance_pkr`
- `status`
- `notes`
- `created_by`
- `updated_by`

Recommended presets:

- `created_by = X-Hasura-User-Id`
- `updated_by = X-Hasura-User-Id`

## Step 14: `public.invoice_lines`

### Role `user`

Add `select`

Use the shared staff filter.

Columns:

- `id`
- `invoice_id`
- `product_id`
- `description`
- `quantity`
- `unit_price_pkr`
- `line_total_pkr`
- `sort_order`
- `created_at`

Add staff-only:

- `insert`
- `update`
- optional `delete`

Allowed insert/update columns:

- `invoice_id`
- `product_id`
- `description`
- `quantity`
- `unit_price_pkr`
- `line_total_pkr`
- `sort_order`

## Step 15: `public.journal_entries`

### Role `user`

Add `select`

Use the shared staff filter.

Columns:

- `id`
- `journal_no`
- `entry_date`
- `reference_type`
- `reference_id`
- `memo`
- `status`
- `posted_by`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`

Add staff-only:

- `insert`
- `update`
- optional `delete`

Allowed insert/update columns:

- `journal_no`
- `entry_date`
- `reference_type`
- `reference_id`
- `memo`
- `status`
- `posted_by`
- `created_by`
- `updated_by`

Recommended presets:

- `created_by = X-Hasura-User-Id`
- `updated_by = X-Hasura-User-Id`

## Step 16: `public.journal_lines`

### Role `user`

Add `select`

Use the shared staff filter.

Columns:

- `id`
- `journal_entry_id`
- `account_id`
- `description`
- `debit_pkr`
- `credit_pkr`
- `line_order`
- `created_at`

Add staff-only:

- `insert`
- `update`
- optional `delete`

Allowed insert/update columns:

- `journal_entry_id`
- `account_id`
- `description`
- `debit_pkr`
- `credit_pkr`
- `line_order`

## Step 17: Tables That Should Not Get Customer CMS Writes

Do not give customer-facing browser writes on these tables outside the staff-gated permissions above:

- `categories`
- `subcategories`
- `products`
- `product_features`
- `review_replies`
- `brand_settings`
- `accounting_accounts`
- `invoices`
- `invoice_lines`
- `journal_entries`
- `journal_lines`

## Step 18: Metadata / Relationships Check

Before testing schema visibility, confirm Hasura has tracked relationships for:

- `subcategories.category`
- `products.category`
- `products.subcategory`
- `product_features.product`
- `reviews.product`
- `review_replies.review`
- `orders.order_items`
- `order_items.order`
- `invoices.order`
- `invoice_lines.invoice`
- `invoice_lines.product`
- `journal_lines.journal_entry`
- `journal_lines.account`

If any are missing:

1. go to `Data`
2. open the table
3. open `Relationships`
4. add/track the missing relationship

## Step 19: Verify Query Schema As Staff

Use a real authenticated admin or manager user.

In GraphiQL, either send the real bearer token or simulate:

```json
{
  "x-hasura-role": "user",
  "x-hasura-user-id": "<staff-user-id>"
}
```

Run:

```graphql
query CheckStaffQueryRoot {
  __type(name: "query_root") {
    fields {
      name
    }
  }
}
```

You should see CMS/accounting fields such as:

- `profiles`
- `categories`
- `subcategories`
- `products`
- `product_features`
- `reviews`
- `review_replies`
- `orders`
- `order_items`
- `custom_requests`
- `brand_settings`
- `accounting_accounts`
- `invoices`
- `invoice_lines`
- `journal_entries`
- `journal_lines`

If these are missing for a staff user, the permission on that table is incomplete.

## Step 20: Verify Query Schema As Customer

Now test with a real customer account:

```json
{
  "x-hasura-role": "user",
  "x-hasura-user-id": "<customer-user-id>"
}
```

Customers should still see storefront tables from the storefront guide.

Customers should not gain CMS/accounting access simply because JWT role is `user`.

If customer GraphQL still exposes admin-only tables in the client path, your table filters are too broad.

## Step 21: Verify Current Role Row

Run:

```graphql
query CheckCurrentProfile($id: uuid!) {
  profiles_by_pk(id: $id) {
    id
    email
    role
    status
  }
}
```

Variables:

```json
{
  "id": "<staff-user-id>"
}
```

Expected:

- staff user returns `admin` or `manager`
- customer user returns `customer`

## Step 22: App-Level Expectation

The CMS app itself now uses:

- `/api/profile-role` to read the current user's own `profiles.role`
- `/api/hasura-admin` for server-side admin CMS/accounting reads and writes

That means:

- Hasura still needs correct `profiles` permissions for role discovery
- the server route still depends on the user truly being `admin` or `manager`

## Final Expected Model

### Role `anonymous`

Storefront only.
No CMS/accounting access.

### Role `user`

Used by both:

- customers
- admins
- managers

Actual access decided by `public.profiles.role`.

### `public.profiles.role = customer`

- storefront allowed
- CMS denied
- accounting denied

### `public.profiles.role = admin` or `manager`

- storefront allowed
- CMS allowed
- accounting allowed

## If CMS Still Fails

Check in this order:

1. confirm the signed-in account's `auth.users.id`
2. confirm there is a matching row in `public.profiles`
3. confirm that row has `role = admin` or `manager`
4. confirm `profiles` `select` permission exists for role `user`
5. confirm the CMS/accounting tables use the shared staff filter
6. sign out and sign back in
7. open `/cms/debug`

If `/cms/debug` shows `appRole = customer`, you are logged into the wrong account or the wrong `profiles` row was updated.
