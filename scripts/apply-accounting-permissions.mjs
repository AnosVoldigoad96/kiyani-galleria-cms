// Grant admin/manager CRUD on new accounting tables (invoice_payments, journal_audit_log).
// Matches the _exists filter pattern used by existing accounting tables.

import "dotenv/config";

const sub = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
const region = process.env.NEXT_PUBLIC_NHOST_REGION;
const secret = process.env.HASURA_ADMIN_SECRET;
if (!sub || !region || !secret) {
  console.error("Missing env vars");
  process.exit(1);
}

const HASURA = `https://${sub}.hasura.${region}.nhost.run`;
const HEADERS = {
  "Content-Type": "application/json",
  "x-hasura-admin-secret": secret,
};

const STAFF_FILTER = {
  _exists: {
    _table: { name: "profiles", schema: "public" },
    _where: {
      _and: [
        { id: { _eq: "X-Hasura-User-Id" } },
        { role: { _in: ["admin", "manager"] } },
      ],
    },
  },
};

async function hasura(body) {
  const res = await fetch(`${HASURA}/v1/metadata`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  }
  return data;
}

async function dropPerm(type, table, role) {
  try {
    await hasura({
      type: `pg_drop_${type}_permission`,
      args: { source: "default", table: { schema: "public", name: table }, role },
    });
  } catch (e) {
    const msg = e.message || String(e);
    if (!msg.includes("does not exist") && !msg.includes("not found") && !msg.includes("permission-denied")) {
      // Other errors are ok — we'll overwrite via create.
    }
  }
}

async function createSelect(table, columns = "*") {
  await dropPerm("select", table, "user");
  await hasura({
    type: "pg_create_select_permission",
    args: {
      source: "default",
      table: { schema: "public", name: table },
      role: "user",
      permission: { columns, filter: STAFF_FILTER },
    },
  });
}

async function createInsert(table, columns = "*") {
  await dropPerm("insert", table, "user");
  await hasura({
    type: "pg_create_insert_permission",
    args: {
      source: "default",
      table: { schema: "public", name: table },
      role: "user",
      permission: { check: STAFF_FILTER, columns },
    },
  });
}

async function createUpdate(table, columns = "*") {
  await dropPerm("update", table, "user");
  await hasura({
    type: "pg_create_update_permission",
    args: {
      source: "default",
      table: { schema: "public", name: table },
      role: "user",
      permission: { columns, filter: STAFF_FILTER, check: STAFF_FILTER },
    },
  });
}

async function createDelete(table) {
  await dropPerm("delete", table, "user");
  await hasura({
    type: "pg_create_delete_permission",
    args: {
      source: "default",
      table: { schema: "public", name: table },
      role: "user",
      permission: { filter: STAFF_FILTER },
    },
  });
}

async function main() {
  console.log(`Hasura: ${HASURA}`);

  // Full CRUD on invoice_payments (admin/manager only).
  process.stdout.write("• invoice_payments select... "); await createSelect("invoice_payments"); console.log("ok");
  process.stdout.write("• invoice_payments insert... "); await createInsert("invoice_payments"); console.log("ok");
  process.stdout.write("• invoice_payments update... "); await createUpdate("invoice_payments"); console.log("ok");
  process.stdout.write("• invoice_payments delete... "); await createDelete("invoice_payments"); console.log("ok");

  // Read-only on journal_audit_log (no one should mutate audit records).
  process.stdout.write("• journal_audit_log select... "); await createSelect("journal_audit_log"); console.log("ok");

  await hasura({ type: "reload_metadata", args: { reload_sources: true } });
  console.log("• reload metadata... ok");

  console.log("\nDone.");
}

main().catch((e) => {
  console.error("\nFAILED:", e.message || e);
  process.exit(1);
});
