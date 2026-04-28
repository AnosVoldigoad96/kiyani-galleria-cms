"use client";

import { requestAdminGraphql } from "@/lib/admin-graphql-client";

// ============================================================================
// Types
// ============================================================================

export type InvoiceStatusCode =
  | "draft"
  | "issued"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "void";

export type InvoicePayload = {
  invoice_no: string;
  order_id: string | null;
  customer_profile_id: string | null;
  customer_name: string;
  customer_email: string | null;
  issue_date: string;
  due_date: string | null;
  subtotal_pkr: number;
  discount_pkr: number;
  shipping_pkr?: number;
  tax_pkr: number;
  total_pkr: number;
  paid_pkr: number;
  balance_pkr: number;
  status: InvoiceStatusCode;
  notes: string | null;
  payment_method_id?: string | null;
};

export type InvoiceLinePayload = {
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price_pkr: number;
  line_total_pkr: number;
  our_cost_pkr: number;
};

type GraphqlWrap<T> = {
  body: {
    data?: T;
    errors?: Array<{ message: string }>;
  };
};

// ============================================================================
// Account codes (match accounting_schema.sql seeds)
// ============================================================================

const CASH_CODE = "1000";
const AR_CODE = "1100";
const INVENTORY_CODE = "1200";
const TAX_LIABILITY_CODE = "2100";
const CUSTOMER_ADVANCES_CODE = "2200";
const SALES_CODE = "4000";
const SALES_RETURNS_CODE = "4900";
const COGS_CODE = "5000";

const REF_INVOICE_SALE = "invoice_sale";
const REF_INVOICE_PAYMENT = "invoice_payment";
const REF_INVOICE_REFUND = "invoice_refund";

// ============================================================================
// Helpers
// ============================================================================

function unwrap<T>(response: GraphqlWrap<T>, message: string): T {
  if (response.body.errors?.length) {
    throw new Error(response.body.errors.map((item) => item.message).join(", "));
  }
  if (!response.body.data) {
    throw new Error(message);
  }
  return response.body.data;
}

function money(value: number): number {
  return Number((Number.isFinite(value) ? value : 0).toFixed(2));
}

function tsSuffix(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}${String(d.getMilliseconds()).padStart(3, "0")}`;
}

function buildSaleJournalNo(invoiceNo: string): string {
  return `${invoiceNo.replace(/^INV/i, "JRN-SALE")}`;
}
function buildPaymentJournalNo(invoiceNo: string): string {
  return `${invoiceNo.replace(/^INV/i, "JRN-PAY")}-${tsSuffix()}`;
}
function buildReversalJournalNo(originalNo: string): string {
  return `${originalNo}-REV-${tsSuffix()}`;
}
function buildRefundJournalNo(invoiceNo: string): string {
  return `${invoiceNo.replace(/^INV/i, "JRN-REFUND")}-${tsSuffix()}`;
}

type JournalLineDraft = {
  account_id: string;
  description: string;
  debit_pkr: number;
  credit_pkr: number;
  line_order: number;
};

type AccountMap = Map<string, { id: string; code: string }>;

function requireAccount(accounts: AccountMap, code: string, context: string): string {
  const acct = accounts.get(code);
  if (!acct) {
    throw new Error(
      `Accounting account ${code} is missing but required for ${context}. Run accounting_schema.sql to seed the canonical chart of accounts.`,
    );
  }
  return acct.id;
}

// ============================================================================
// Load accounts + payment methods (one round-trip)
// ============================================================================

async function loadAccountingContext(): Promise<{
  accounts: AccountMap;
  paymentMethodAccounts: Map<string, string>;
}> {
  // Fetch accounts first — always present.
  const accountsResp = await requestAdminGraphql<{
    accounting_accounts: Array<{ id: string; code: string; is_active: boolean }>;
  }>(
    `query AccountingAccounts {
      accounting_accounts(where: { is_active: { _eq: true } }) { id code is_active }
    }`,
  );
  const accounts: AccountMap = new Map(
    unwrap(accountsResp, "Failed to load accounting accounts.").accounting_accounts.map((a) => [
      a.code,
      { id: a.id, code: a.code },
    ]),
  );

  // Payment methods with cash_account_code. If the column hasn't been added yet,
  // gracefully fall back to a query without it (all methods will default to 1000).
  const paymentMethodAccounts = new Map<string, string>();
  let pms: Array<{ id: string; cash_account_code: string | null }> = [];
  try {
    const resp = await requestAdminGraphql<{
      payment_methods: Array<{ id: string; cash_account_code: string | null }>;
    }>(
      `query PaymentMethodAccounts { payment_methods { id cash_account_code } }`,
    );
    if (resp.body.errors?.length) throw new Error(resp.body.errors.map((e) => e.message).join(", "));
    pms = resp.body.data?.payment_methods ?? [];
  } catch {
    const fallback = await requestAdminGraphql<{ payment_methods: Array<{ id: string }> }>(
      `query PaymentMethodsBasic { payment_methods { id } }`,
    );
    pms = (unwrap(fallback, "Failed to load payment methods.").payment_methods ?? []).map((pm) => ({
      id: pm.id,
      cash_account_code: null,
    }));
  }
  for (const pm of pms) {
    const code = pm.cash_account_code ?? CASH_CODE;
    const acct = accounts.get(code) ?? accounts.get(CASH_CODE);
    if (acct) paymentMethodAccounts.set(pm.id, acct.id);
  }
  return { accounts, paymentMethodAccounts };
}

function resolveCashAccountId(
  accounts: AccountMap,
  paymentMethodAccounts: Map<string, string>,
  paymentMethodId: string | null | undefined,
): string {
  if (paymentMethodId && paymentMethodAccounts.has(paymentMethodId)) {
    return paymentMethodAccounts.get(paymentMethodId)!;
  }
  return requireAccount(accounts, CASH_CODE, "cash receipt");
}

// ============================================================================
// Invoice line CRUD
// ============================================================================

async function replaceInvoiceLines(invoiceId: string, lines: InvoiceLinePayload[]) {
  const deleteResponse = await requestAdminGraphql<{
    delete_invoice_lines: { affected_rows: number };
  }>(
    `mutation DeleteInvoiceLines($invoiceId: uuid!) {
      delete_invoice_lines(where: { invoice_id: { _eq: $invoiceId } }) { affected_rows }
    }`,
    { invoiceId },
  );
  unwrap(deleteResponse, "Failed to clear invoice lines.");

  if (!lines.length) return;

  const insertResponse = await requestAdminGraphql<{
    insert_invoice_lines: { affected_rows: number };
  }>(
    `mutation InsertInvoiceLines($objects: [invoice_lines_insert_input!]!) {
      insert_invoice_lines(objects: $objects) { affected_rows }
    }`,
    {
      objects: lines.map((line, index) => ({
        invoice_id: invoiceId,
        product_id: line.product_id,
        description: line.description,
        quantity: money(line.quantity),
        unit_price_pkr: money(line.unit_price_pkr),
        line_total_pkr: money(line.line_total_pkr),
        our_cost_pkr: money(line.our_cost_pkr),
        sort_order: index,
      })),
    },
  );
  unwrap(insertResponse, "Failed to save invoice lines.");
}

// ============================================================================
// Journal primitives: insert entry + lines in two round-trips.
// Posted journals are immutable by DB trigger — to change them, reverse + re-post.
// ============================================================================

async function insertJournalEntry(entry: {
  journal_no: string;
  entry_date: string;
  reference_type: string;
  reference_id: string | null;
  memo: string;
  status: "draft" | "posted" | "void";
  reverses_entry_id?: string | null;
}): Promise<string> {
  const response = await requestAdminGraphql<{ insert_journal_entries_one: { id: string } | null }>(
    `mutation InsertJournalEntry($object: journal_entries_insert_input!) {
      insert_journal_entries_one(object: $object) { id }
    }`,
    { object: entry },
  );
  const data = unwrap(response, "Failed to create journal entry.");
  const id = data.insert_journal_entries_one?.id;
  if (!id) throw new Error("Journal entry id was not returned.");
  return id;
}

async function insertJournalLines(journalEntryId: string, lines: JournalLineDraft[]) {
  if (!lines.length) return;
  const debitTotal = lines.reduce((s, l) => s + l.debit_pkr, 0);
  const creditTotal = lines.reduce((s, l) => s + l.credit_pkr, 0);
  if (Math.abs(debitTotal - creditTotal) > 0.01) {
    throw new Error(
      `Journal lines are out of balance: debits=${debitTotal.toFixed(2)} credits=${creditTotal.toFixed(2)}. Refusing to post.`,
    );
  }
  const response = await requestAdminGraphql<{ insert_journal_lines: { affected_rows: number } }>(
    `mutation InsertJournalLines($objects: [journal_lines_insert_input!]!) {
      insert_journal_lines(objects: $objects) { affected_rows }
    }`,
    {
      objects: lines.map((line) => ({
        journal_entry_id: journalEntryId,
        account_id: line.account_id,
        description: line.description,
        debit_pkr: money(line.debit_pkr),
        credit_pkr: money(line.credit_pkr),
        line_order: line.line_order,
      })),
    },
  );
  unwrap(response, "Failed to insert journal lines.");
}

async function postJournal(
  entry: {
    journal_no: string;
    entry_date: string;
    reference_type: string;
    reference_id: string | null;
    memo: string;
    reverses_entry_id?: string | null;
  },
  lines: JournalLineDraft[],
  status: "draft" | "posted" = "posted",
): Promise<string> {
  const journalId = await insertJournalEntry({ ...entry, status: "draft" });
  await insertJournalLines(journalId, lines);
  if (status === "posted") {
    await requestAdminGraphql(
      `mutation PostJournal($id: uuid!) {
        update_journal_entries_by_pk(pk_columns: { id: $id }, _set: { status: "posted" }) { id }
      }`,
      { id: journalId },
    );
  }
  return journalId;
}

async function loadJournalEntryLines(journalEntryId: string): Promise<{
  entry: { id: string; journal_no: string; entry_date: string; reference_type: string; reference_id: string | null; memo: string; status: string };
  lines: Array<{ account_id: string; description: string | null; debit_pkr: number; credit_pkr: number; line_order: number }>;
}> {
  const response = await requestAdminGraphql<{
    journal_entries_by_pk: null | {
      id: string; journal_no: string; entry_date: string;
      reference_type: string; reference_id: string | null; memo: string; status: string;
    };
    journal_lines: Array<{
      account_id: string; description: string | null; debit_pkr: number; credit_pkr: number; line_order: number;
    }>;
  }>(
    `query JournalEntryWithLines($id: uuid!) {
      journal_entries_by_pk(id: $id) {
        id journal_no entry_date reference_type reference_id memo status
      }
      journal_lines(where: { journal_entry_id: { _eq: $id } }, order_by: { line_order: asc }) {
        account_id description debit_pkr credit_pkr line_order
      }
    }`,
    { id: journalEntryId },
  );
  const data = unwrap(response, "Failed to load journal entry.");
  if (!data.journal_entries_by_pk) throw new Error(`Journal entry ${journalEntryId} not found.`);
  return { entry: data.journal_entries_by_pk, lines: data.journal_lines };
}

async function reversePostedJournal(journalEntryId: string, reversalDate: string, memo: string): Promise<string> {
  const { entry, lines } = await loadJournalEntryLines(journalEntryId);
  if (entry.status !== "posted") {
    // Draft entries can be directly deleted — no reversal needed.
    if (entry.status === "draft") {
      await requestAdminGraphql(
        `mutation DeleteDraftJournal($id: uuid!) {
          delete_journal_lines(where: { journal_entry_id: { _eq: $id } }) { affected_rows }
          delete_journal_entries_by_pk(id: $id) { id }
        }`,
        { id: journalEntryId },
      );
    }
    return journalEntryId;
  }
  const flippedLines: JournalLineDraft[] = lines.map((l, idx) => ({
    account_id: l.account_id,
    description: `REVERSAL: ${l.description ?? ""}`.trim(),
    debit_pkr: Number(l.credit_pkr ?? 0),
    credit_pkr: Number(l.debit_pkr ?? 0),
    line_order: idx,
  }));
  return postJournal(
    {
      journal_no: buildReversalJournalNo(entry.journal_no),
      entry_date: reversalDate,
      reference_type: entry.reference_type,
      reference_id: entry.reference_id,
      memo,
      reverses_entry_id: entry.id,
    },
    flippedLines,
    "posted",
  );
}

// ============================================================================
// Build sale journal (AR + Revenue + Tax + COGS/Inventory pair).
// Cash is handled by payment journals, not the sale journal.
// ============================================================================

function buildSaleJournalLines(
  payload: InvoicePayload,
  accounts: AccountMap,
  totalCogs: number,
): JournalLineDraft[] {
  const total = money(payload.total_pkr);
  const tax = money(payload.tax_pkr);
  const revenueAmount = money(total - tax);

  if (total <= 0) return [];

  const lines: JournalLineDraft[] = [];
  let ord = 0;

  // Debit: full total goes to AR. Cash portion moves from AR → Cash via payment journal.
  lines.push({
    account_id: requireAccount(accounts, AR_CODE, "invoice receivable"),
    description: "Amount receivable",
    debit_pkr: total,
    credit_pkr: 0,
    line_order: ord++,
  });

  // Credit: Revenue (product + shipping revenue combined — customer pays for it all)
  if (revenueAmount > 0) {
    lines.push({
      account_id: requireAccount(accounts, SALES_CODE, "sales revenue"),
      description: payload.shipping_pkr && payload.shipping_pkr > 0 ? "Sales revenue (incl. shipping)" : "Sales revenue",
      debit_pkr: 0,
      credit_pkr: revenueAmount,
      line_order: ord++,
    });
  }

  // Credit: Tax liability. REQUIRED when tax > 0 — fail loudly if account is missing.
  if (tax > 0) {
    lines.push({
      account_id: requireAccount(accounts, TAX_LIABILITY_CODE, "sales tax"),
      description: "Sales tax collected",
      debit_pkr: 0,
      credit_pkr: tax,
      line_order: ord++,
    });
  }

  // COGS pair (self-balancing)
  const cogs = money(totalCogs);
  if (cogs > 0) {
    lines.push({
      account_id: requireAccount(accounts, COGS_CODE, "cost of goods sold"),
      description: "Cost of goods sold",
      debit_pkr: cogs,
      credit_pkr: 0,
      line_order: ord++,
    });
    lines.push({
      account_id: requireAccount(accounts, INVENTORY_CODE, "inventory release"),
      description: "Inventory released",
      debit_pkr: 0,
      credit_pkr: cogs,
      line_order: ord++,
    });
  }

  return lines;
}

function buildPaymentJournalLines(
  paymentAmount: number,
  currentOutstanding: number,
  accounts: AccountMap,
  cashAccountId: string,
): JournalLineDraft[] {
  const payment = money(paymentAmount);
  if (payment <= 0) return [];

  const outstanding = Math.max(0, money(currentOutstanding));
  const appliedToAR = Math.min(payment, outstanding);
  const overpayment = money(payment - appliedToAR);

  const lines: JournalLineDraft[] = [];
  let ord = 0;

  // Debit: cash received into the selected payment method's account
  lines.push({
    account_id: cashAccountId,
    description: "Cash received",
    debit_pkr: payment,
    credit_pkr: 0,
    line_order: ord++,
  });

  // Credit: AR for the portion settling the invoice
  if (appliedToAR > 0) {
    lines.push({
      account_id: requireAccount(accounts, AR_CODE, "AR settlement"),
      description: "AR settled",
      debit_pkr: 0,
      credit_pkr: appliedToAR,
      line_order: ord++,
    });
  }

  // Credit: Customer Advances for any overpayment (liability we owe back to the customer)
  if (overpayment > 0) {
    lines.push({
      account_id: requireAccount(accounts, CUSTOMER_ADVANCES_CODE, "overpayment credit"),
      description: "Customer overpayment credited to advances",
      debit_pkr: 0,
      credit_pkr: overpayment,
      line_order: ord++,
    });
  }

  return lines;
}

// ============================================================================
// Sale journal sync (issue-time posting).
// - Draft invoice: sale journal is draft (or absent).
// - Issued/paid invoice: sale journal is posted.
// - Void invoice: any posted sale journal is reversed.
// - Content change to a posted sale journal → reverse + re-post.
// ============================================================================

async function computeTotalCogs(invoiceId: string): Promise<number> {
  const response = await requestAdminGraphql<{
    invoice_lines: Array<{ quantity: number; our_cost_pkr: number }>;
  }>(
    `query InvoiceLinesCost($invoiceId: uuid!) {
      invoice_lines(where: { invoice_id: { _eq: $invoiceId } }) { quantity our_cost_pkr }
    }`,
    { invoiceId },
  );
  const lines = unwrap(response, "Failed to load invoice lines for COGS.").invoice_lines;
  return lines.reduce((sum, l) => sum + Number(l.quantity ?? 0) * Number(l.our_cost_pkr ?? 0), 0);
}

async function findSaleJournal(invoiceId: string): Promise<{ id: string; status: string } | null> {
  const response = await requestAdminGraphql<{
    journal_entries: Array<{ id: string; status: string }>;
  }>(
    `query FindSaleJournal($invoiceId: uuid!) {
      journal_entries(
        where: {
          reference_type: { _eq: "${REF_INVOICE_SALE}" }
          reference_id: { _eq: $invoiceId }
          reverses_entry_id: { _is_null: true }
          status: { _neq: "void" }
        }
        order_by: { created_at: desc }
        limit: 1
      ) { id status }
    }`,
    { invoiceId },
  );
  const rows = unwrap(response, "Failed to find sale journal.").journal_entries;
  return rows[0] ?? null;
}

async function syncSaleJournal(
  invoiceId: string,
  payload: InvoicePayload,
  accounts: AccountMap,
): Promise<void> {
  const existing = await findSaleJournal(invoiceId);

  // Invoice moved to void: reverse any posted sale journal and stop.
  if (payload.status === "void") {
    if (existing) {
      await reversePostedJournal(existing.id, payload.issue_date, `Void invoice ${payload.invoice_no}`);
    }
    return;
  }

  // Draft invoice: keep any existing sale journal in draft state, or leave absent.
  const desiredStatus: "draft" | "posted" = payload.status === "draft" ? "draft" : "posted";
  const totalCogs = await computeTotalCogs(invoiceId);
  const newLines = buildSaleJournalLines(payload, accounts, totalCogs);

  if (!newLines.length) {
    // Nothing to post. If there's an existing journal, reverse/delete it.
    if (existing) {
      await reversePostedJournal(existing.id, payload.issue_date, `Invoice ${payload.invoice_no} became zero total`);
    }
    return;
  }

  if (!existing) {
    await postJournal(
      {
        journal_no: `${buildSaleJournalNo(payload.invoice_no)}-${tsSuffix()}`,
        entry_date: payload.issue_date,
        reference_type: REF_INVOICE_SALE,
        reference_id: invoiceId,
        memo: `Invoice ${payload.invoice_no} — sale`,
      },
      newLines,
      desiredStatus,
    );
    return;
  }

  if (existing.status === "draft") {
    // Draft journal: we can delete and replace (trigger permits line mutation on drafts).
    await requestAdminGraphql(
      `mutation ClearDraftLines($id: uuid!) {
        delete_journal_lines(where: { journal_entry_id: { _eq: $id } }) { affected_rows }
      }`,
      { id: existing.id },
    );
    await insertJournalLines(existing.id, newLines);
    await requestAdminGraphql(
      `mutation SetJournalStatus($id: uuid!, $status: journal_status!) {
        update_journal_entries_by_pk(pk_columns: { id: $id }, _set: { status: $status }) { id }
      }`,
      { id: existing.id, status: desiredStatus },
    );
    return;
  }

  // Posted journal: reverse it and post a new one. Preserves audit trail.
  await reversePostedJournal(existing.id, payload.issue_date, `Correction for invoice ${payload.invoice_no}`);
  await postJournal(
    {
      journal_no: `${buildSaleJournalNo(payload.invoice_no)}-${tsSuffix()}`,
      entry_date: payload.issue_date,
      reference_type: REF_INVOICE_SALE,
      reference_id: invoiceId,
      memo: `Invoice ${payload.invoice_no} — sale (revised)`,
    },
    newLines,
    "posted",
  );
}

// ============================================================================
// Public API
// ============================================================================

export async function createInvoice(
  payload: InvoicePayload,
  lines: InvoiceLinePayload[],
  syncJournal = true,
) {
  const { accounts, paymentMethodAccounts } = await loadAccountingContext();

  const createResponse = await requestAdminGraphql<{ insert_invoices_one: { id: string } | null }>(
    `mutation CreateInvoice($object: invoices_insert_input!) {
      insert_invoices_one(object: $object) { id }
    }`,
    { object: { ...payload, paid_pkr: 0, balance_pkr: money(payload.total_pkr) } },
  );
  const data = unwrap(createResponse, "Invoice was not created.");
  const invoiceId = data.insert_invoices_one?.id;
  if (!invoiceId) throw new Error("Invoice id was not returned.");

  // Best-effort rollback on downstream failure (no real transaction without server-side code).
  const rollback = async () => {
    await requestAdminGraphql(
      `mutation RollbackInvoice($id: uuid!) {
        delete_invoice_lines(where: { invoice_id: { _eq: $id } }) { affected_rows }
        delete_invoices_by_pk(id: $id) { id }
      }`,
      { id: invoiceId },
    ).catch(() => undefined);
  };

  try {
    await replaceInvoiceLines(invoiceId, lines);

    if (syncJournal) {
      await syncSaleJournal(invoiceId, payload, accounts);
    }

    // If the editor included an initial paid amount, record it as a payment (at issue_date).
    const initialPaid = money(payload.paid_pkr);
    if (initialPaid > 0) {
      await recordPaymentInternal({
        invoiceId,
        paymentAmount: initialPaid,
        currentPaid: 0,
        totalPkr: money(payload.total_pkr),
        paymentDate: payload.issue_date,
        paymentMethodId: payload.payment_method_id ?? null,
        accounts,
        paymentMethodAccounts,
        memo: `Initial payment on ${payload.invoice_no}`,
      });
    }
  } catch (e) {
    await rollback();
    throw e;
  }

  return { invoiceId };
}

export async function updateInvoice(
  invoiceId: string,
  payload: InvoicePayload,
  lines: InvoiceLinePayload[],
  syncJournal = true,
) {
  const { accounts } = await loadAccountingContext();

  // Only update header fields; paid_pkr/balance_pkr are derived from payments.
  // Exclude those from the set to prevent drift.
  const headerFields: Partial<InvoicePayload> = { ...payload };
  delete headerFields.paid_pkr;
  delete headerFields.balance_pkr;
  const updateResponse = await requestAdminGraphql<{
    update_invoices_by_pk: { id: string } | null;
  }>(
    `mutation UpdateInvoice($id: uuid!, $set: invoices_set_input!) {
      update_invoices_by_pk(pk_columns: { id: $id }, _set: $set) { id }
    }`,
    { id: invoiceId, set: headerFields },
  );
  unwrap(updateResponse, "Invoice was not updated.");

  await replaceInvoiceLines(invoiceId, lines);

  if (syncJournal) {
    await syncSaleJournal(invoiceId, payload, accounts);
  }

  // Recompute paid_pkr and balance_pkr from invoice_payments ledger.
  await recomputeInvoiceTotals(invoiceId, payload.total_pkr);

  // Sync linked order payment status. Failures are fatal — we should not silently diverge.
  if (payload.order_id) {
    const orderPaymentStatus =
      payload.status === "paid" ? "paid"
      : payload.status === "partially_paid" ? "pending"
      : payload.status === "void" ? "failed"
      : "pending";
    const syncResponse = await requestAdminGraphql(
      `mutation SyncOrderPayment($id: uuid!, $set: orders_set_input!) {
        update_orders_by_pk(pk_columns: { id: $id }, _set: $set) { id }
      }`,
      { id: payload.order_id, set: { payment_status: orderPaymentStatus } },
    );
    unwrap(syncResponse, "Failed to sync linked order payment status.");
  }
}

export async function deleteInvoice(invoiceId: string) {
  // Block deletion when any posted sale journal exists — reversing entries preserve
  // the audit trail, so voiding is the correct operation.
  const check = await requestAdminGraphql<{
    journal_entries: Array<{ id: string }>;
  }>(
    `query HasPostedJournals($invoiceId: uuid!) {
      journal_entries(where: {
        reference_id: { _eq: $invoiceId }
        status: { _eq: "posted" }
      }) { id }
    }`,
    { invoiceId },
  );
  const posted = unwrap(check, "Failed to check journal state.").journal_entries;
  if (posted.length) {
    throw new Error(
      "Invoice has posted journal entries — voiding is required to preserve the audit trail. Set status to Void instead of deleting.",
    );
  }

  // Safe to remove: drop draft journals, invoice lines, then the invoice row.
  await requestAdminGraphql(
    `mutation HardDeleteInvoice($invoiceId: uuid!) {
      delete_journal_lines(where: { journal_entry: { reference_id: { _eq: $invoiceId } } }) { affected_rows }
      delete_journal_entries(where: { reference_id: { _eq: $invoiceId } }) { affected_rows }
      delete_invoice_payments(where: { invoice_id: { _eq: $invoiceId } }) { affected_rows }
      delete_invoice_lines(where: { invoice_id: { _eq: $invoiceId } }) { affected_rows }
      delete_invoices_by_pk(id: $invoiceId) { id }
    }`,
    { invoiceId },
  ).then((r) => unwrap(r, "Failed to delete invoice."));
}

// ============================================================================
// Payment recording
// ============================================================================

async function recomputeInvoiceTotals(invoiceId: string, totalPkr: number): Promise<{
  paid: number; balance: number; status: InvoiceStatusCode;
}> {
  const response = await requestAdminGraphql<{
    invoice_payments_aggregate: { aggregate: { sum: { amount_pkr: number | null } | null } | null };
    invoices_by_pk: { status: InvoiceStatusCode; due_date: string | null } | null;
  }>(
    `query SumPayments($invoiceId: uuid!) {
      invoice_payments_aggregate(where: { invoice_id: { _eq: $invoiceId } }) {
        aggregate { sum { amount_pkr } }
      }
      invoices_by_pk(id: $invoiceId) { status due_date }
    }`,
    { invoiceId },
  );
  const data = unwrap(response, "Failed to recompute invoice totals.");
  const paid = money(Number(data.invoice_payments_aggregate.aggregate?.sum?.amount_pkr ?? 0));
  const balance = Math.max(0, money(totalPkr - paid));
  const existingStatus = data.invoices_by_pk?.status ?? "issued";

  // Don't auto-change status for void/draft; respect user's manual choice.
  let nextStatus: InvoiceStatusCode = existingStatus;
  if (existingStatus !== "void" && existingStatus !== "draft") {
    if (paid <= 0) {
      nextStatus = "issued";
    } else if (paid + 0.01 < totalPkr) {
      nextStatus = "partially_paid";
    } else {
      nextStatus = "paid";
    }
    // If the due_date has passed and it's not paid, mark overdue.
    const dueDate = data.invoices_by_pk?.due_date;
    if (nextStatus !== "paid" && dueDate) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const due = new Date(dueDate);
      if (!Number.isNaN(due.getTime()) && due < today) {
        nextStatus = "overdue";
      }
    }
  }

  const updateResponse = await requestAdminGraphql(
    `mutation SetInvoiceTotals($id: uuid!, $set: invoices_set_input!) {
      update_invoices_by_pk(pk_columns: { id: $id }, _set: $set) { id }
    }`,
    {
      id: invoiceId,
      set: { paid_pkr: paid, balance_pkr: balance, status: nextStatus },
    },
  );
  unwrap(updateResponse, "Failed to persist invoice totals.");

  return { paid, balance, status: nextStatus };
}

type RecordPaymentArgs = {
  invoiceId: string;
  paymentAmount: number;
  currentPaid: number;
  totalPkr: number;
  paymentDate: string;
  paymentMethodId: string | null;
  accounts: AccountMap;
  paymentMethodAccounts: Map<string, string>;
  memo?: string;
};

async function recordPaymentInternal(args: RecordPaymentArgs) {
  const { invoiceId, paymentAmount, currentPaid, totalPkr, paymentDate, paymentMethodId, accounts, paymentMethodAccounts, memo } = args;
  const amount = money(paymentAmount);
  if (amount <= 0) throw new Error("Payment amount must be greater than zero.");

  const outstanding = Math.max(0, money(totalPkr - currentPaid));
  const overpayment = money(Math.max(0, amount - outstanding));
  const cashAccountId = resolveCashAccountId(accounts, paymentMethodAccounts, paymentMethodId);

  const invoiceNoResp = await requestAdminGraphql<{ invoices_by_pk: { invoice_no: string } | null }>(
    `query InvoiceNo($id: uuid!) { invoices_by_pk(id: $id) { invoice_no } }`,
    { id: invoiceId },
  );
  const invoiceNo = unwrap(invoiceNoResp, "Failed to resolve invoice.").invoices_by_pk?.invoice_no ?? "INV";

  const journalLines = buildPaymentJournalLines(amount, outstanding, accounts, cashAccountId);
  const journalId = await postJournal(
    {
      journal_no: buildPaymentJournalNo(invoiceNo),
      entry_date: paymentDate,
      reference_type: REF_INVOICE_PAYMENT,
      reference_id: invoiceId,
      memo: memo ?? `Payment on ${invoiceNo}`,
    },
    journalLines,
    "posted",
  );

  const insertPayment = await requestAdminGraphql(
    `mutation InsertInvoicePayment($object: invoice_payments_insert_input!) {
      insert_invoice_payments_one(object: $object) { id }
    }`,
    {
      object: {
        invoice_id: invoiceId,
        amount_pkr: amount,
        payment_date: paymentDate,
        payment_method_id: paymentMethodId,
        journal_entry_id: journalId,
        is_overpayment: overpayment > 0,
        memo: memo ?? null,
      },
    },
  );
  unwrap(insertPayment, "Failed to record invoice payment.");
}

export async function recordPayment(
  invoiceId: string,
  paymentAmount: number,
  currentPaid: number,
  totalPkr: number,
  options: { paymentDate?: string; paymentMethodId?: string | null; memo?: string } = {},
) {
  const { accounts, paymentMethodAccounts } = await loadAccountingContext();
  const paymentDate = options.paymentDate ?? new Date().toISOString().slice(0, 10);

  // Resolve payment method from invoice if not supplied.
  let paymentMethodId: string | null = options.paymentMethodId ?? null;
  if (!paymentMethodId) {
    const invPm = await requestAdminGraphql<{ invoices_by_pk: { payment_method_id: string | null } | null }>(
      `query InvoicePaymentMethod($id: uuid!) { invoices_by_pk(id: $id) { payment_method_id } }`,
      { id: invoiceId },
    );
    paymentMethodId = unwrap(invPm, "Failed to resolve invoice.").invoices_by_pk?.payment_method_id ?? null;
  }

  await recordPaymentInternal({
    invoiceId,
    paymentAmount,
    currentPaid,
    totalPkr,
    paymentDate,
    paymentMethodId,
    accounts,
    paymentMethodAccounts,
    memo: options.memo,
  });

  const totals = await recomputeInvoiceTotals(invoiceId, totalPkr);

  // Sync linked order payment status if the invoice is now fully paid.
  const inv = await requestAdminGraphql<{ invoices_by_pk: { order_id: string | null } | null }>(
    `query InvoiceOrder($id: uuid!) { invoices_by_pk(id: $id) { order_id } }`,
    { id: invoiceId },
  );
  const orderId = unwrap(inv, "Failed to load invoice order.").invoices_by_pk?.order_id ?? null;
  if (orderId && totals.status === "paid") {
    const sync = await requestAdminGraphql(
      `mutation OrderPaid($id: uuid!, $set: orders_set_input!) {
        update_orders_by_pk(pk_columns: { id: $id }, _set: $set) { id }
      }`,
      { id: orderId, set: { payment_status: "paid" } },
    );
    unwrap(sync, "Failed to update linked order payment status.");
  }

  return { newPaid: totals.paid, newBalance: totals.balance, newStatus: totals.status };
}

export async function approveFullPayment(
  invoiceId: string,
  totalPkr: number,
  options: { paymentDate?: string; paymentMethodId?: string | null } = {},
) {
  // Query current paid amount to support reuse from partially paid invoices.
  const response = await requestAdminGraphql<{ invoices_by_pk: { paid_pkr: number } | null }>(
    `query InvoicePaid($id: uuid!) { invoices_by_pk(id: $id) { paid_pkr } }`,
    { id: invoiceId },
  );
  const current = Number(unwrap(response, "Failed to load invoice.").invoices_by_pk?.paid_pkr ?? 0);
  const remaining = Math.max(0, money(totalPkr - current));
  if (remaining <= 0) return { newPaid: current, newBalance: 0, newStatus: "paid" as InvoiceStatusCode };
  return recordPayment(invoiceId, remaining, current, totalPkr, options);
}

// ============================================================================
// Refunds / credit notes (reversing journals)
// ============================================================================

export async function issueRefund(
  invoiceId: string,
  refundAmount: number,
  options: { refundDate?: string; paymentMethodId?: string | null; reason?: string } = {},
) {
  const amount = money(refundAmount);
  if (amount <= 0) throw new Error("Refund amount must be greater than zero.");

  const { accounts, paymentMethodAccounts } = await loadAccountingContext();
  const refundDate = options.refundDate ?? new Date().toISOString().slice(0, 10);

  const response = await requestAdminGraphql<{
    invoices_by_pk: { invoice_no: string; order_id: string | null; payment_method_id: string | null; paid_pkr: number; total_pkr: number } | null;
  }>(
    `query InvoiceForRefund($id: uuid!) {
      invoices_by_pk(id: $id) { invoice_no order_id payment_method_id paid_pkr total_pkr }
    }`,
    { id: invoiceId },
  );
  const inv = unwrap(response, "Failed to load invoice.").invoices_by_pk;
  if (!inv) throw new Error("Invoice not found.");
  if (amount > Number(inv.paid_pkr)) {
    throw new Error(`Refund amount (${amount}) exceeds paid amount (${Number(inv.paid_pkr)}).`);
  }

  const paymentMethodId = options.paymentMethodId ?? inv.payment_method_id;
  const cashAccountId = resolveCashAccountId(accounts, paymentMethodAccounts, paymentMethodId);

  // Refund entry: Debit Sales Returns (contra-revenue), Credit Cash.
  // If the invoice is still owed (AR balance > 0), route via AR instead.
  // Straightforward pattern: reduce revenue by amount, reduce cash by amount.
  const lines: JournalLineDraft[] = [
    {
      account_id: requireAccount(accounts, SALES_RETURNS_CODE, "refund contra-revenue"),
      description: `Refund${options.reason ? `: ${options.reason}` : ""}`,
      debit_pkr: amount,
      credit_pkr: 0,
      line_order: 0,
    },
    {
      account_id: cashAccountId,
      description: "Cash refunded to customer",
      debit_pkr: 0,
      credit_pkr: amount,
      line_order: 1,
    },
  ];

  await postJournal(
    {
      journal_no: buildRefundJournalNo(inv.invoice_no),
      entry_date: refundDate,
      reference_type: REF_INVOICE_REFUND,
      reference_id: invoiceId,
      memo: `Refund on ${inv.invoice_no}${options.reason ? ` — ${options.reason}` : ""}`,
    },
    lines,
    "posted",
  );

  // Record the refund as a negative invoice_payments entry for traceability via a memo.
  const insertPayment = await requestAdminGraphql(
    `mutation InsertRefundPayment($object: invoice_payments_insert_input!) {
      insert_invoice_payments_one(object: $object) { id }
    }`,
    {
      object: {
        invoice_id: invoiceId,
        amount_pkr: -amount,
        payment_date: refundDate,
        payment_method_id: paymentMethodId,
        is_overpayment: false,
        memo: options.reason ? `Refund: ${options.reason}` : "Refund issued",
      },
    },
  );
  unwrap(insertPayment, "Failed to record refund payment row.");

  const totals = await recomputeInvoiceTotals(invoiceId, Number(inv.total_pkr));
  return totals;
}
