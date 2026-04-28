// Run accounting-upgrade.sql against Hasura, then track/reload metadata.
// Uses HASURA_ADMIN_SECRET from .env.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import "dotenv/config";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const sub = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
const region = process.env.NEXT_PUBLIC_NHOST_REGION;
const secret = process.env.HASURA_ADMIN_SECRET;
if (!sub || !region || !secret) {
  console.error("Missing NEXT_PUBLIC_NHOST_SUBDOMAIN / NEXT_PUBLIC_NHOST_REGION / HASURA_ADMIN_SECRET in .env");
  process.exit(1);
}

const HASURA = `https://${sub}.hasura.${region}.nhost.run`;
const HEADERS = {
  "Content-Type": "application/json",
  "x-hasura-admin-secret": secret,
};

async function hasura(path, body) {
  const res = await fetch(`${HASURA}${path}`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    throw new Error(`${path} HTTP ${res.status}: ${typeof data === "string" ? data : JSON.stringify(data, null, 2)}`);
  }
  return data;
}

async function runSql(sql, label) {
  process.stdout.write(`• ${label}... `);
  const result = await hasura("/v2/query", {
    type: "run_sql",
    args: { sql, read_only: false, cascade: false },
  });
  console.log("ok");
  return result;
}

async function trackTable(name) {
  process.stdout.write(`• track ${name}... `);
  try {
    await hasura("/v1/metadata", {
      type: "pg_track_table",
      args: { source: "default", table: { schema: "public", name } },
    });
    console.log("ok");
  } catch (e) {
    const msg = e.message || String(e);
    if (msg.includes("already-tracked") || msg.includes("already tracked")) {
      console.log("already tracked");
    } else {
      throw e;
    }
  }
}

async function reload() {
  process.stdout.write(`• reload metadata... `);
  await hasura("/v1/metadata", { type: "reload_metadata", args: { reload_remote_schemas: true, reload_sources: true } });
  console.log("ok");
}

async function main() {
  console.log(`Hasura: ${HASURA}`);

  const sql = await readFile(join(ROOT, "database", "accounting-upgrade.sql"), "utf8");
  await runSql(sql, "apply accounting-upgrade.sql");

  // Track new tables. Existing tables with new columns auto-expose after reload.
  for (const t of ["invoice_payments", "journal_audit_log"]) {
    await trackTable(t);
  }

  await reload();

  console.log("\nDone. New columns/tables should now be reachable over GraphQL.");
}

main().catch((e) => {
  console.error("\nFAILED:", e.message || e);
  process.exit(1);
});
