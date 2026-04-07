# Separate Staff Roles Guide

This is the full future-state guide for moving to separate JWT roles while keeping both storefront and CMS working.

Target role model:

- `anonymous` for guests
- `user` for authenticated storefront customers
- `cms_user` for authenticated staff

Business role model:

- `public.profiles.role = customer | manager | admin`

Use this guide later if you decide to migrate away from the current shared `user` role setup.

## Goal

After this migration:

- customers only get storefront schema
- staff get CMS/accounting schema
- `profiles.role` still decides manager vs admin business logic
- Hasura permissions are cleanly separated per JWT role

## Core Principle

JWT role controls broad schema access.

- `anonymous` sees public storefront reads
- `user` sees customer storefront reads/writes
- `cms_user` sees CMS/accounting reads/writes

`public.profiles.role` controls business authorization.

- `customer`
- `manager`
- `admin`

## Required JWT Claims

### Guest

No auth token.

### Customer token

- `x-hasura-default-role = user`
- `x-hasura-allowed-roles` includes `user`
- `x-hasura-user-id = auth.users.id`

### Staff token

- `x-hasura-default-role = cms_user`
- `x-hasura-allowed-roles` includes `cms_user`
- optionally also includes `user`
- `x-hasura-user-id = auth.users.id`

## Required Profile Rule

Every authenticated user should still have a `public.profiles` row.

Expected values:

- storefront customer: `role = customer`
- CMS manager: `role = manager`
- CMS admin: `role = admin`

## Migration Order

1. Keep current system working.
2. Add all `cms_user` permissions in Hasura.
3. Make staff tokens emit `cms_user`.
4. Test staff login and CMS.
5. Confirm customer storefront still works.
6. Remove old CMS permissions from `user`.

Do not remove current `user` CMS permissions before staff tokens actually switch to `cms_user`.

## Permission Strategy By Role

### Role `anonymous`

Purpose:

- public storefront browsing only

Expected access:

- read visible categories
- read live subcategories
- read live products
- read published reviews

No writes.

### Role `user`

Purpose:

- authenticated storefront customers only

Expected access:

- own profile
- public catalog
- favorites
- carts
- cart items
- own orders
- own order items
- own custom requests

No CMS/accounting access.

### Role `cms_user`

Purpose:

- authenticated staff only

Expected access:

- all CMS catalog tables
- all reviews and replies
- all orders and order items
- all custom requests
- brand settings
- accounting tables

## Table-By-Table Final Permission Map

Below is the recommended final state after migration.

## 1. `public.profiles`

### `anonymous`

No permissions.

### `user`

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

No `insert`, `update`, `delete`.

### `cms_user`

Add `select`

Row filter:

```json
{}
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

Optional `update` only if staff should edit profile records in Hasura directly.

## 2. `public.categories`

### `anonymous`

Add `select`

Row filter:

```json
{
  "is_visible": {
    "_eq": true
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

### `user`

Add `select`

Use the same row filter:

```json
{
  "is_visible": {
    "_eq": true
  }
}
```

Use the same columns.

No writes.

### `cms_user`

Add `select`, `insert`, `update`, `delete`

Row filter / row check:

```json
{}
```

Select columns:

- `id`
- `name`
- `slug`
- `description`
- `sort_order`
- `is_visible`
- `created_at`
- `updated_at`

Insert/update columns:

- `name`
- `slug`
- `description`
- `sort_order`
- `is_visible`

## 3. `public.subcategories`

### `anonymous`

Add `select`

Row filter:

```json
{
  "status": {
    "_eq": "live"
  }
}
```

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

### `user`

Add `select`

Use the same row filter and columns.

No writes.

### `cms_user`

Add `select`, `insert`, `update`, `delete`

Row filter / row check:

```json
{}
```

Select columns:

- `id`
- `category_id`
- `name`
- `slug`
- `description`
- `sort_order`
- `status`
- `created_at`
- `updated_at`

Insert/update columns:

- `category_id`
- `name`
- `slug`
- `description`
- `sort_order`
- `status`

## 4. `public.products`

### `anonymous`

Add `select`

Row filter:

```json
{
  "status": {
    "_eq": "live"
  }
}
```

Columns:

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
- `created_at`
- `updated_at`

### `user`

Add `select`

Use the same row filter and columns.

No writes.

### `cms_user`

Add `select`, `insert`, `update`, `delete`

Row filter / row check:

```json
{}
```

Select columns:

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

Insert/update columns:

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

Recommended presets:

- insert: `created_by = X-Hasura-User-Id`
- insert/update: `updated_by = X-Hasura-User-Id`

## 5. `public.product_features`

### `anonymous`

Option A:
No permission if storefront does not query features directly.

Option B:
Add `select` if storefront reads them.

Row filter:

```json
{
  "product": {
    "status": {
      "_eq": "live"
    }
  }
}
```

Columns:

- `id`
- `product_id`
- `feature`
- `sort_order`
- `created_at`

### `user`

If storefront reads features, use the same `select`.
Otherwise no permission.

No writes.

### `cms_user`

Add `select`, `insert`, `update`, `delete`

Row filter / row check:

```json
{}
```

Select columns:

- `id`
- `product_id`
- `feature`
- `sort_order`
- `created_at`

Insert/update columns:

- `product_id`
- `feature`
- `sort_order`

## 6. `public.reviews`

### `anonymous`

Add `select`

Row filter:

```json
{
  "status": {
    "_eq": "published"
  }
}
```

Columns:

- `id`
- `product_id`
- `user_id`
- `customer_name`
- `rating`
- `comment`
- `status`
- `created_at`
- `updated_at`

### `user`

Add `select`

Use the same row filter and columns.

If storefront later allows customer review submission, add separate customer-safe `insert`.

### `cms_user`

Add `select`, `update`, optional `delete`

Row filter:

```json
{}
```

Select columns:

- `id`
- `product_id`
- `user_id`
- `customer_name`
- `rating`
- `comment`
- `status`
- `created_at`
- `updated_at`

Update columns:

- `status`

## 7. `public.review_replies`

### `anonymous`

No permissions.

### `user`

No permissions unless storefront must show replies directly.

If storefront needs replies, use:

```json
{
  "review": {
    "status": {
      "_eq": "published"
    }
  }
}
```

Read-only.

### `cms_user`

Add `select`, `insert`, `update`, `delete`

Row filter / row check:

```json
{}
```

Select columns:

- `id`
- `review_id`
- `replied_by`
- `reply`
- `created_at`
- `updated_at`

Insert/update columns:

- `review_id`
- `replied_by`
- `reply`

Preset:

- `replied_by = X-Hasura-User-Id`

## 8. `public.favorites`

### `anonymous`

No permissions.

### `user`

Add `select`

```json
{
  "user_id": {
    "_eq": "X-Hasura-User-Id"
  }
}
```

Columns:

- `id`
- `user_id`
- `product_id`
- `created_at`

Add `insert`

Row check:

```json
{
  "user_id": {
    "_eq": "X-Hasura-User-Id"
  }
}
```

Insert columns:

- `product_id`

Preset:

- `user_id = X-Hasura-User-Id`

Add `delete`

Row filter:

```json
{
  "user_id": {
    "_eq": "X-Hasura-User-Id"
  }
}
```

No `update`.

### `cms_user`

Optional.
Usually not needed unless staff should inspect customer favorites.

## 9. `public.carts`

### `anonymous`

No permissions.

### `user`

Add `select`

```json
{
  "user_id": {
    "_eq": "X-Hasura-User-Id"
  }
}
```

Columns:

- `id`
- `user_id`
- `created_at`
- `updated_at`

Add `insert`

Row check:

```json
{
  "user_id": {
    "_eq": "X-Hasura-User-Id"
  }
}
```

Insert columns:

- `user_id`

Preset:

- `user_id = X-Hasura-User-Id`

Optional `update`

Row filter:

```json
{
  "user_id": {
    "_eq": "X-Hasura-User-Id"
  }
}
```

Update columns:

- `updated_at`

### `cms_user`

Usually no permission needed.

## 10. `public.cart_items`

### `anonymous`

No permissions.

### `user`

Add `select`

```json
{
  "cart": {
    "user_id": {
      "_eq": "X-Hasura-User-Id"
    }
  }
}
```

Columns:

- `id`
- `cart_id`
- `product_id`
- `quantity`
- `created_at`
- `updated_at`

Add `insert`

Row check:

```json
{
  "cart": {
    "user_id": {
      "_eq": "X-Hasura-User-Id"
    }
  }
}
```

Insert columns:

- `cart_id`
- `product_id`
- `quantity`

Add `update`

Row filter:

```json
{
  "cart": {
    "user_id": {
      "_eq": "X-Hasura-User-Id"
    }
  }
}
```

Update columns:

- `quantity`
- `updated_at`

Add `delete`

Use the same row filter.

### `cms_user`

Usually no permission needed.

## 11. `public.orders`

### `anonymous`

No permissions.

### `user`

Add `select`

```json
{
  "user_id": {
    "_eq": "X-Hasura-User-Id"
  }
}
```

Columns:

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

Add `insert`

Row check:

```json
{
  "user_id": {
    "_eq": "X-Hasura-User-Id"
  }
}
```

Insert columns:

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

Preset:

- `user_id = X-Hasura-User-Id`

No customer `update` or `delete`.

### `cms_user`

Add `select`, `update`

Row filter:

```json
{}
```

Select columns:

- same as `user`

Update columns:

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

Usually no `delete`.

## 12. `public.order_items`

### `anonymous`

No permissions.

### `user`

Add `select`

```json
{
  "order": {
    "user_id": {
      "_eq": "X-Hasura-User-Id"
    }
  }
}
```

Columns:

- `id`
- `order_id`
- `product_id`
- `product_name`
- `sku`
- `quantity`
- `unit_price_pkr`
- `total_price_pkr`

Add `insert`

Row check:

```json
{
  "order": {
    "user_id": {
      "_eq": "X-Hasura-User-Id"
    }
  }
}
```

Insert columns:

- `order_id`
- `product_id`
- `product_name`
- `sku`
- `quantity`
- `unit_price_pkr`
- `total_price_pkr`

No customer `update` or `delete`.

### `cms_user`

Add `select`, `update`

Row filter:

```json
{}
```

Select columns:

- `id`
- `order_id`
- `product_id`
- `product_name`
- `sku`
- `quantity`
- `unit_price_pkr`
- `total_price_pkr`

Update columns:

- `product_name`
- `sku`
- `quantity`
- `unit_price_pkr`
- `total_price_pkr`

## 13. `public.custom_requests`

### `anonymous`

No permissions.

### `user`

If customers can submit custom requests, add:

`select`

```json
{
  "user_id": {
    "_eq": "X-Hasura-User-Id"
  }
}
```

`insert`

Row check:

```json
{
  "user_id": {
    "_eq": "X-Hasura-User-Id"
  }
}
```

Select columns:

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

Insert columns:

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

Preset:

- `user_id = X-Hasura-User-Id`

No customer `update` or `delete`.

### `cms_user`

Add `select`, `insert`, `update`, `delete`

Row filter / row check:

```json
{}
```

Select columns:

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

Insert/update columns:

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

## 14. `public.brand_settings`

### `anonymous`

No permissions.

### `user`

No permissions.

### `cms_user`

Add `select`, `insert`, `update`, optional `delete`

Row filter / row check:

```json
{}
```

Select columns:

- `key`
- `value`
- `updated_by`
- `updated_at`

Insert/update columns:

- `key`
- `value`
- `updated_by`

Preset:

- `updated_by = X-Hasura-User-Id`

## 15. `public.accounting_accounts`

### `anonymous`

No permissions.

### `user`

No permissions.

### `cms_user`

Add `select`, `insert`, `update`, optional `delete`

Row filter / row check:

```json
{}
```

Select columns:

- `id`
- `code`
- `name`
- `category`
- `description`
- `is_active`
- `created_at`
- `updated_at`

Insert/update columns:

- `code`
- `name`
- `category`
- `description`
- `is_active`

## 16. `public.invoices`

### `anonymous`

No permissions.

### `user`

No permissions.

### `cms_user`

Add `select`, `insert`, `update`, optional `delete`

Row filter / row check:

```json
{}
```

Select columns:

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

Insert/update columns:

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

Presets:

- insert: `created_by = X-Hasura-User-Id`
- insert/update: `updated_by = X-Hasura-User-Id`

## 17. `public.invoice_lines`

### `anonymous`

No permissions.

### `user`

No permissions.

### `cms_user`

Add `select`, `insert`, `update`, optional `delete`

Row filter / row check:

```json
{}
```

Select columns:

- `id`
- `invoice_id`
- `product_id`
- `description`
- `quantity`
- `unit_price_pkr`
- `line_total_pkr`
- `sort_order`
- `created_at`

Insert/update columns:

- `invoice_id`
- `product_id`
- `description`
- `quantity`
- `unit_price_pkr`
- `line_total_pkr`
- `sort_order`

## 18. `public.journal_entries`

### `anonymous`

No permissions.

### `user`

No permissions.

### `cms_user`

Add `select`, `insert`, `update`, optional `delete`

Row filter / row check:

```json
{}
```

Select columns:

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

Insert/update columns:

- `journal_no`
- `entry_date`
- `reference_type`
- `reference_id`
- `memo`
- `status`
- `posted_by`
- `created_by`
- `updated_by`

Presets:

- insert: `created_by = X-Hasura-User-Id`
- insert/update: `updated_by = X-Hasura-User-Id`

## 19. `public.journal_lines`

### `anonymous`

No permissions.

### `user`

No permissions.

### `cms_user`

Add `select`, `insert`, `update`, optional `delete`

Row filter / row check:

```json
{}
```

Select columns:

- `id`
- `journal_entry_id`
- `account_id`
- `description`
- `debit_pkr`
- `credit_pkr`
- `line_order`
- `created_at`

Insert/update columns:

- `journal_entry_id`
- `account_id`
- `description`
- `debit_pkr`
- `credit_pkr`
- `line_order`

## Required Relationships

Track these in Hasura before testing permissions:

- `product_features.product`
- `review_replies.review`
- `cart_items.cart`
- `cart_items.product`
- `favorites.product`
- `favorites.profile`
- `orders.order_items`
- `order_items.order`
- `order_items.product`
- `custom_requests.assigned_to_profile` if you create it
- `invoices.order`
- `invoice_lines.invoice`
- `invoice_lines.product`
- `journal_lines.journal_entry`
- `journal_lines.account`

## Safe Rollout Checklist

### Step 1

Create all `cms_user` permissions exactly as above.

### Step 2

Do not remove current `user` CMS permissions yet.

### Step 3

Update staff JWT claims so staff logins receive:

- default role `cms_user`

### Step 4

Test one staff account:

- `/cms`
- `/cms/debug`
- products
- accounting

### Step 5

Test one customer account:

- storefront
- favorites
- cart
- checkout
- custom requests

### Step 6

Only after staff works under `cms_user`, remove old CMS/accounting permissions from `user`.

At that point:

- `user` becomes storefront-only
- `cms_user` becomes CMS-only

## Final Expected State

### `anonymous`

Public storefront reads only.

### `user`

Customer storefront role only.

### `cms_user`

Staff CMS/accounting role only.

### `profiles.role`

Still used for:

- `customer`
- `manager`
- `admin`

and for business logic inside the CMS.
