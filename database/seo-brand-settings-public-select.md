# Hasura permissions: public SELECT on SEO brand_settings rows

Apply in **Hasura Console → Data → `brand_settings` → Permissions → role `public`**.

## SELECT permission

**Row select permission (custom check):**

```json
{
  "key": {
    "_in": [
      "seo_global",
      "seo_social",
      "seo_robots",
      "seo_verification",
      "seo_sitemap",
      "seo_organization"
    ]
  }
}
```

**Column select permission:** `key`, `value`, `updated_at`.
**Do NOT** expose `updated_by` to the public role.

**Aggregation permission:** off.
**Query limit:** 20 rows (safety cap).

## INSERT / UPDATE / DELETE

Not granted to `public`. Admin/manager roles retain full access.

## Rationale

Everything in these rows is rendered into the public HTML (title, description, OG image, social links, verification tokens, robots directives, sitemap config, Organization JSON-LD). Whitelisting by `key` prevents accidental exposure of future non-SEO `brand_settings` rows (e.g., feature flags, secrets).

## Smoke test (after applying)

From an unauthenticated client:

```graphql
query {
  brand_settings(where: { key: { _eq: "seo_global" } }) {
    key
    value
  }
}
```

Expected: one row returned. If you get a permission error, re-check the row/column permission form.
