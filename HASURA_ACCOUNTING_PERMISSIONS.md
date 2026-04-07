# Hasura Accounting Permissions

Apply these permissions to the `user` role if you want the CMS to expose accounting only to staff whose
`public.profiles.role` is `admin` or `manager`.

## Shared row filter for accounting tables

Use this filter for `select`, `insert`, `update`, and `delete` where appropriate:

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

## Tables to expose

- `products`
  - add column permission for `our_price_pkr`
- `accounting_accounts`
- `invoices`
- `invoice_lines`
- `journal_entries`
- `journal_lines`

## Recommended column permissions

### `products`

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

### `accounting_accounts`

- `id`
- `code`
- `name`
- `category`
- `description`
- `is_active`
- `created_at`
- `updated_at`

### `invoices`

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

### `invoice_lines`

- `id`
- `invoice_id`
- `product_id`
- `description`
- `quantity`
- `unit_price_pkr`
- `line_total_pkr`
- `sort_order`
- `created_at`

### `journal_entries`

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

### `journal_lines`

- `id`
- `journal_entry_id`
- `account_id`
- `description`
- `debit_pkr`
- `credit_pkr`
- `line_order`
- `created_at`

## Notes

- Relationships should auto-track in Hasura once metadata is refreshed.
- The CMS accounting screen is read-only right now, but these permissions are enough for future mutations too.
