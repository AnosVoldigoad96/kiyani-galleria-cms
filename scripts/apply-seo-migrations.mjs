#!/usr/bin/env node
/**
 * Applies the SEO migrations + public-select permission against the Nhost Hasura
 * instance configured in .env.
 *
 * Usage: node scripts/apply-seo-migrations.mjs
 *
 * Steps:
 *   1. Probe Hasura health.
 *   2. Run database/seo-columns-v2.sql  (adds canonical/og_image/noindex/sitemap_* cols + indexes).
 *   3. Run database/seo-brand-settings-seed.sql  (seeds 6 global SEO rows, idempotent).
 *   4. Track new columns in Hasura metadata (products/categories/subcategories).
 *   5. Apply select permission for `public` role on brand_settings with key whitelist.
 *
 * Re-running is safe: all SQL is idempotent, tracking/permission calls handle duplicates.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// ───────────────────────────────────────────────────────────── env loader ──

function loadEnv() {
  const text = readFileSync(resolve(root, ".env"), "utf8");
  const map = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    map[m[1]] = m[2];
  }
  return map;
}

const env = loadEnv();
const subdomain = env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
const region = env.NEXT_PUBLIC_NHOST_REGION;
const adminSecret = env.HASURA_ADMIN_SECRET;

if (!subdomain || !region || !adminSecret) {
  console.error("Missing NEXT_PUBLIC_NHOST_SUBDOMAIN / NEXT_PUBLIC_NHOST_REGION / HASURA_ADMIN_SECRET in .env");
  process.exit(1);
}

const hasuraBase = `https://${subdomain}.hasura.${region}.nhost.run`;

async function hasura(path, body) {
  const res = await fetch(`${hasuraBase}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hasura-admin-secret": adminSecret,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { ok: res.ok, status: res.status, body: parsed };
}

// Hasura returns a `v2/query` error when a step is benign (already-exists-style).
// We treat a well-defined error set as non-fatal so the whole script can still succeed.
function isBenignMetadataError(msg) {
  if (!msg) return false;
  const s = String(msg).toLowerCase();
  return (
    s.includes("already exists") ||
    s.includes("already tracked") ||
    s.includes("is already tracked") ||
    s.includes("already defined") ||
    s.includes("view/table already tracked")
  );
}

async function runSql(sql, label) {
  process.stdout.write(`→ SQL: ${label}… `);
  const { ok, status, body } = await hasura("/v2/query", {
    type: "run_sql",
    args: { sql, cascade: false, read_only: false },
  });
  if (ok) {
    console.log("ok");
  } else {
    console.log("FAILED");
    console.error("status:", status);
    console.error("body:", JSON.stringify(body, null, 2));
    throw new Error(`SQL step failed: ${label}`);
  }
}

async function metadata(type, args, label, { allowBenign = true } = {}) {
  process.stdout.write(`→ metadata: ${label}… `);
  const { ok, status, body } = await hasura("/v1/metadata", { type, args });
  if (ok) {
    console.log("ok");
    return;
  }
  const msg = body?.error || body?.message || JSON.stringify(body);
  if (allowBenign && isBenignMetadataError(msg)) {
    console.log(`skipped (${msg})`);
    return;
  }
  console.log("FAILED");
  console.error({ status, body });
  throw new Error(`Metadata step failed: ${label}`);
}

// ───────────────────────────────────────────────────────────── main flow ──

async function main() {
  console.log(`Hasura: ${hasuraBase}`);
  console.log("Probing health…");
  const health = await hasura("/v1/metadata", { type: "export_metadata", args: {} });
  if (!health.ok) {
    console.error("Health probe failed:", health);
    process.exit(1);
  }
  console.log("  ✓ reachable, admin secret accepted.");

  // Step 2–3: SQL migrations
  const colsSql = readFileSync(resolve(root, "database", "seo-columns-v2.sql"), "utf8");
  await runSql(colsSql, "seo-columns-v2.sql");

  const seedSql = readFileSync(resolve(root, "database", "seo-brand-settings-seed.sql"), "utf8");
  await runSql(seedSql, "seo-brand-settings-seed.sql");

  // Step 4: Track new columns. Hasura auto-infers columns from the DB, but we
  // emit explicit set_table_customization calls so the GraphQL schema reloads.
  // For simplicity we reload the metadata — cheap and guaranteed to pick up new cols.
  await metadata("reload_metadata", { reload_remote_schemas: false, reload_sources: true }, "reload metadata (picks up new columns)");

  // Step 5: public SELECT permission on brand_settings (whitelisted keys)
  const publicSelectArgs = {
    source: "default",
    table: { schema: "public", name: "brand_settings" },
    role: "public",
    permission: {
      columns: ["key", "value", "updated_at"],
      filter: {
        key: {
          _in: [
            "seo_global",
            "seo_social",
            "seo_robots",
            "seo_verification",
            "seo_sitemap",
            "seo_organization",
          ],
        },
      },
      allow_aggregations: false,
      limit: 20,
    },
  };

  // Try create — if it already exists, drop + recreate so we get the latest shape.
  const create = await hasura("/v1/metadata", {
    type: "pg_create_select_permission",
    args: publicSelectArgs,
  });
  if (create.ok) {
    console.log("→ metadata: pg_create_select_permission (public, brand_settings)… ok");
  } else {
    const msg = create.body?.error || create.body?.message || JSON.stringify(create.body);
    if (/already exists/i.test(msg)) {
      console.log("→ metadata: existing public permission found — dropping + recreating…");
      await metadata(
        "pg_drop_select_permission",
        {
          source: "default",
          table: { schema: "public", name: "brand_settings" },
          role: "public",
        },
        "drop existing public select permission",
      );
      await metadata(
        "pg_create_select_permission",
        publicSelectArgs,
        "recreate public select permission",
        { allowBenign: false },
      );
    } else {
      console.error("create public permission failed:", create);
      throw new Error("Could not create public select permission");
    }
  }

  console.log("\n✓ All SEO operator actions applied successfully.");
}

main().catch((err) => {
  console.error("\n✗ SCRIPT FAILED:", err.message);
  process.exit(1);
});
