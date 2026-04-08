"use client";

import { requestAdminGraphql } from "@/lib/admin-graphql-client";

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

const CASH_CODE = "1000";
const AR_CODE = "1100";
const INVENTORY_CODE = "1200";
const TAX_LIABILITY_CODE = "2100";
const SALES_CODE = "4000";
const COGS_CODE = "5000";
const SHIPPING_EXPENSE_CODE = "6000";
const REF_TYPE = "invoice";

function unwrap<T>(response: GraphqlWrap<T>, message: string) {
  if (response.body.errors?.length) {
    throw new Error(response.body.errors.map((item) => item.message).join(", "));
  }

  if (!response.body.data) {
    throw new Error(message);
  }

  return response.body.data;
}

function money(value: number) {
  return Number((Number.isFinite(value) ? value : 0).toFixed(2));
}

function buildJournalNo(invoiceNo: string) {
  return invoiceNo.replace(/^INV/i, "JRN-INV");
}

function buildJournalStatus(status: InvoiceStatusCode) {
  return status === "void" ? "void" : "posted";
}

type JournalLineDraft = {
  account_id: string;
  description: string;
  debit_pkr: number;
  credit_pkr: number;
  line_order: number;
};

type AccountMap = Map<string, string>;

function buildInvoiceJournalLines(
  payload: InvoicePayload,
  accounts: AccountMap,
  totalCogs = 0,
) {
  if (payload.status === "void" || payload.total_pkr <= 0) {
    return [] as JournalLineDraft[];
  }

  const total = money(payload.total_pkr);
  const paid = Math.max(0, Math.min(money(payload.paid_pkr), total));
  const outstanding = money(total - paid);
  const discount = money(payload.discount_pkr);
  const shipping = money(payload.shipping_pkr ?? 0);
  const tax = money(payload.tax_pkr);
  const subtotal = money(payload.subtotal_pkr);

  const lines: JournalLineDraft[] = [];
  let lineOrder = 0;

  const acct = (code: string) => accounts.get(code);

  // total = subtotal - discount + shipping + tax
  // paid + outstanding = total (always)
  // Revenue = subtotal - discount (product sales)

  const revenueAmount = money(subtotal - discount);

  // === DEBITS (what we receive / expenses incurred) ===

  // 1. Cash received
  if (paid > 0 && acct(CASH_CODE)) {
    lines.push({ account_id: acct(CASH_CODE)!, description: "Cash received", debit_pkr: paid, credit_pkr: 0, line_order: lineOrder++ });
  }

  // 2. Accounts Receivable (unpaid portion)
  if (outstanding > 0 && acct(AR_CODE)) {
    lines.push({ account_id: acct(AR_CODE)!, description: "Amount receivable", debit_pkr: outstanding, credit_pkr: 0, line_order: lineOrder++ });
  }

  // 3. Shipping expense (tracked separately from revenue)
  if (shipping > 0 && acct(SHIPPING_EXPENSE_CODE)) {
    lines.push({ account_id: acct(SHIPPING_EXPENSE_CODE)!, description: "Shipping expense", debit_pkr: shipping, credit_pkr: 0, line_order: lineOrder++ });
  }

  // === CREDITS (revenue earned / liabilities / offsets) ===

  // 4. Sales Revenue (product revenue only)
  if (revenueAmount > 0 && acct(SALES_CODE)) {
    lines.push({ account_id: acct(SALES_CODE)!, description: "Sales revenue", debit_pkr: 0, credit_pkr: revenueAmount, line_order: lineOrder++ });
  }

  // 5. Tax liability
  if (tax > 0 && acct(TAX_LIABILITY_CODE)) {
    lines.push({ account_id: acct(TAX_LIABILITY_CODE)!, description: "Sales tax collected", debit_pkr: 0, credit_pkr: tax, line_order: lineOrder++ });
  }

  // 6. Shipping offset — customer reimbursement credited to shipping expense
  //    This zeroes out the shipping expense since customer paid for it.
  //    Net effect on Shipping Expense = 0 (pass-through).
  //    If actual carrier cost differs, create a manual journal to adjust.
  if (shipping > 0 && acct(SHIPPING_EXPENSE_CODE)) {
    lines.push({ account_id: acct(SHIPPING_EXPENSE_CODE)!, description: "Shipping reimbursed by customer", debit_pkr: 0, credit_pkr: shipping, line_order: lineOrder++ });
  }

  // Balance: Debits = paid + outstanding + shipping = total + shipping
  //          Credits = revenue + tax + shipping = (subtotal-discount) + tax + shipping
  //          total = (subtotal-discount) + shipping + tax
  //          So Credits = total - shipping + shipping = total... NO.
  //          Credits = (subtotal-discount) + tax + shipping
  //          total = (subtotal-discount) + shipping + tax
  //          Credits = total ✓  (same components)
  //          Debits = total + shipping ✗
  //
  // The problem: paid + outstanding = total (which includes shipping)
  // Adding shipping debit again = total + shipping. But shipping credit = shipping.
  // So: Debits = total + shipping, Credits = (subtotal-discount) + tax + shipping + shipping?
  // No — we credit shipping expense (not sales).
  // Debits: paid(total portion) + outstanding(total portion) + shipping_exp = total + shipping
  // Credits: revenue + tax + shipping_exp_credit = (subtotal-discount) + tax + shipping
  //        = (total - shipping) + shipping = total ✗ still total, not total + shipping
  //
  // THE FIX: Don't debit shipping expense on the invoice at all.
  // total already includes shipping → Cash/AR already captures it.
  // Recognize shipping as revenue (Credit Sales for total - tax).
  // Shipping expense should ONLY be recorded when you PAY the carrier.
  //
  // Clean approach: everything the customer pays is revenue (including shipping).

  // REMOVE shipping entries — replace with single clean revenue
  lines.length = 0;
  lineOrder = 0;

  // Debits
  if (paid > 0 && acct(CASH_CODE)) {
    lines.push({ account_id: acct(CASH_CODE)!, description: "Cash received", debit_pkr: paid, credit_pkr: 0, line_order: lineOrder++ });
  }
  if (outstanding > 0 && acct(AR_CODE)) {
    lines.push({ account_id: acct(AR_CODE)!, description: "Amount receivable", debit_pkr: outstanding, credit_pkr: 0, line_order: lineOrder++ });
  }

  // Credits — everything customer pays split into revenue + tax
  const totalRevenue = money(total - tax); // = subtotal - discount + shipping
  if (totalRevenue > 0 && acct(SALES_CODE)) {
    lines.push({ account_id: acct(SALES_CODE)!, description: `Sales revenue${shipping > 0 ? " (incl. shipping)" : ""}`, debit_pkr: 0, credit_pkr: totalRevenue, line_order: lineOrder++ });
  }
  if (tax > 0 && acct(TAX_LIABILITY_CODE)) {
    lines.push({ account_id: acct(TAX_LIABILITY_CODE)!, description: "Sales tax collected", debit_pkr: 0, credit_pkr: tax, line_order: lineOrder++ });
  }

  // Debits = paid + outstanding = total
  // Credits = totalRevenue + tax = (total - tax) + tax = total ✓ ALWAYS BALANCED

  // === COGS (self-balancing pair) ===
  const safeCogs = money(totalCogs);
  if (safeCogs > 0 && acct(COGS_CODE) && acct(INVENTORY_CODE)) {
    lines.push({ account_id: acct(COGS_CODE)!, description: "Cost of goods sold", debit_pkr: safeCogs, credit_pkr: 0, line_order: lineOrder++ });
    lines.push({ account_id: acct(INVENTORY_CODE)!, description: "Inventory released", debit_pkr: 0, credit_pkr: safeCogs, line_order: lineOrder++ });
  }

  // Grand total: Debits = total + COGS, Credits = total + COGS ✓

  return lines;
}

async function replaceInvoiceLines(invoiceId: string, lines: InvoiceLinePayload[]) {
  const deleteResponse = await requestAdminGraphql<{
    delete_invoice_lines: { affected_rows: number };
  }>(
    `
      mutation DeleteInvoiceLines($invoiceId: uuid!) {
        delete_invoice_lines(where: { invoice_id: { _eq: $invoiceId } }) {
          affected_rows
        }
      }
    `,
    { invoiceId },
  );
  unwrap(deleteResponse, "Failed to clear invoice lines.");

  if (!lines.length) {
    return;
  }

  const insertResponse = await requestAdminGraphql<{
    insert_invoice_lines: { affected_rows: number };
  }>(
    `
      mutation InsertInvoiceLines($objects: [invoice_lines_insert_input!]!) {
        insert_invoice_lines(objects: $objects) {
          affected_rows
        }
      }
    `,
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

async function syncInvoiceJournal(invoiceId: string, payload: InvoicePayload) {
  const neededCodes = [CASH_CODE, AR_CODE, SALES_CODE, TAX_LIABILITY_CODE, SHIPPING_EXPENSE_CODE, COGS_CODE, INVENTORY_CODE];
  const contextResponse = await requestAdminGraphql<{
    accounting_accounts: Array<{ id: string; code: string }>;
    journal_entries: Array<{ id: string }>;
  }>(
    `
      query InvoiceJournalContext($invoiceId: uuid!, $referenceType: String!, $codes: [String!]!) {
        accounting_accounts(
          where: { code: { _in: $codes }, is_active: { _eq: true } }
        ) {
          id
          code
        }
        journal_entries(
          where: {
            reference_type: { _eq: $referenceType }
            reference_id: { _eq: $invoiceId }
          }
          limit: 1
        ) {
          id
        }
      }
    `,
    { invoiceId, referenceType: REF_TYPE, codes: neededCodes },
  );

  const context = unwrap(contextResponse, "Failed to load accounting accounts.");
  const accounts: AccountMap = new Map(context.accounting_accounts.map((a) => [a.code, a.id]));

  if (!accounts.get(CASH_CODE) || !accounts.get(AR_CODE) || !accounts.get(SALES_CODE)) {
    throw new Error("Missing core accounting accounts (1000, 1100, 4000).");
  }

  const setPayload = {
    journal_no: buildJournalNo(payload.invoice_no),
    entry_date: payload.issue_date,
    reference_type: REF_TYPE,
    reference_id: invoiceId,
    memo: `Invoice ${payload.invoice_no} posting`,
    status: buildJournalStatus(payload.status),
  };

  const existingJournalId = context.journal_entries[0]?.id ?? null;
  let journalId: string | null = existingJournalId;

  if (existingJournalId) {
    const updateResponse = await requestAdminGraphql<{
      update_journal_entries_by_pk: { id: string } | null;
    }>(
      `
        mutation UpdateInvoiceJournal($id: uuid!, $set: journal_entries_set_input!) {
          update_journal_entries_by_pk(pk_columns: { id: $id }, _set: $set) {
            id
          }
        }
      `,
      { id: existingJournalId, set: setPayload },
    );
    unwrap(updateResponse, "Failed to update invoice journal.");
  } else {
    const insertResponse = await requestAdminGraphql<{
      insert_journal_entries_one: { id: string } | null;
    }>(
      `
        mutation InsertInvoiceJournal($object: journal_entries_insert_input!) {
          insert_journal_entries_one(object: $object) {
            id
          }
        }
      `,
      { object: setPayload },
    );
    const data = unwrap(insertResponse, "Failed to create invoice journal.");
    journalId = data.insert_journal_entries_one?.id ?? null;
  }

  if (!journalId) {
    throw new Error("Journal id was not returned.");
  }

  const ensuredJournalId = journalId;
  const clearLinesResponse = await requestAdminGraphql<{
    delete_journal_lines: { affected_rows: number };
  }>(
    `
      mutation DeleteInvoiceJournalLines($journalId: uuid!) {
        delete_journal_lines(where: { journal_entry_id: { _eq: $journalId } }) {
          affected_rows
        }
      }
    `,
    { journalId: ensuredJournalId },
  );
  unwrap(clearLinesResponse, "Failed to clear invoice journal lines.");

  // Calculate total COGS from invoice lines
  let totalCogs = 0;
  try {
    const linesRes = await requestAdminGraphql<{ invoice_lines: Array<{ quantity: number; our_cost_pkr: number }> }>(
      `query InvoiceLinesCost($invoiceId: uuid!) {
        invoice_lines(where: { invoice_id: { _eq: $invoiceId } }) { quantity our_cost_pkr }
      }`,
      { invoiceId },
    );
    totalCogs = (linesRes.body.data?.invoice_lines ?? []).reduce(
      (sum, l) => sum + Number(l.quantity ?? 0) * Number(l.our_cost_pkr ?? 0), 0,
    );
  } catch { /* COGS calculation is non-critical */ }

  const lines = buildInvoiceJournalLines(payload, accounts, totalCogs);

  if (!lines.length) {
    return;
  }

  const insertLinesResponse = await requestAdminGraphql<{
    insert_journal_lines: { affected_rows: number };
  }>(
    `
      mutation InsertInvoiceJournalLines($objects: [journal_lines_insert_input!]!) {
        insert_journal_lines(objects: $objects) {
          affected_rows
        }
      }
    `,
    {
      objects: lines.map((line) => ({
        journal_entry_id: ensuredJournalId,
        account_id: line.account_id,
        description: line.description,
        debit_pkr: money(line.debit_pkr),
        credit_pkr: money(line.credit_pkr),
        line_order: line.line_order,
      })),
    },
  );
  unwrap(insertLinesResponse, "Failed to save invoice journal lines.");
}

async function deleteInvoiceJournal(invoiceId: string) {
  const journalResponse = await requestAdminGraphql<{
    journal_entries: Array<{ id: string }>;
  }>(
    `
      query InvoiceJournalIds($invoiceId: uuid!, $referenceType: String!) {
        journal_entries(
          where: {
            reference_type: { _eq: $referenceType }
            reference_id: { _eq: $invoiceId }
          }
        ) {
          id
        }
      }
    `,
    { invoiceId, referenceType: REF_TYPE },
  );

  const journals = unwrap(journalResponse, "Failed to load invoice journal ids.").journal_entries;
  const journalIds = journals.map((journal) => journal.id);

  if (!journalIds.length) {
    return;
  }

  const deleteLinesResponse = await requestAdminGraphql<{
    delete_journal_lines: { affected_rows: number };
  }>(
    `
      mutation DeleteInvoiceJournalLinesBatch($ids: [uuid!]!) {
        delete_journal_lines(where: { journal_entry_id: { _in: $ids } }) {
          affected_rows
        }
      }
    `,
    { ids: journalIds },
  );
  unwrap(deleteLinesResponse, "Failed to delete invoice journal lines.");

  const deleteEntriesResponse = await requestAdminGraphql<{
    delete_journal_entries: { affected_rows: number };
  }>(
    `
      mutation DeleteInvoiceJournalsBatch($ids: [uuid!]!) {
        delete_journal_entries(where: { id: { _in: $ids } }) {
          affected_rows
        }
      }
    `,
    { ids: journalIds },
  );
  unwrap(deleteEntriesResponse, "Failed to delete invoice journals.");
}

export async function createInvoice(
  payload: InvoicePayload,
  lines: InvoiceLinePayload[],
  syncJournal = true,
) {
  const createResponse = await requestAdminGraphql<{ insert_invoices_one: { id: string } | null }>(
    `
      mutation CreateInvoice($object: invoices_insert_input!) {
        insert_invoices_one(object: $object) {
          id
        }
      }
    `,
    { object: payload },
  );
  const data = unwrap(createResponse, "Invoice was not created.");
  const invoiceId = data.insert_invoices_one?.id;

  if (!invoiceId) {
    throw new Error("Invoice id was not returned.");
  }

  await replaceInvoiceLines(invoiceId, lines);
  if (syncJournal) {
    await syncInvoiceJournal(invoiceId, payload);
  }
}

export async function updateInvoice(
  invoiceId: string,
  payload: InvoicePayload,
  lines: InvoiceLinePayload[],
  syncJournal = true,
) {
  const updateResponse = await requestAdminGraphql<{
    update_invoices_by_pk: { id: string } | null;
  }>(
    `
      mutation UpdateInvoice($id: uuid!, $set: invoices_set_input!) {
        update_invoices_by_pk(pk_columns: { id: $id }, _set: $set) {
          id
        }
      }
    `,
    { id: invoiceId, set: payload },
  );
  unwrap(updateResponse, "Invoice was not updated.");

  await replaceInvoiceLines(invoiceId, lines);
  if (syncJournal) {
    await syncInvoiceJournal(invoiceId, payload);
  } else {
    await deleteInvoiceJournal(invoiceId);
  }

  // Sync linked order payment status based on invoice status
  if (payload.order_id) {
    const orderPaymentStatus =
      payload.status === "paid" ? "paid"
      : payload.status === "partially_paid" ? "pending"
      : payload.status === "void" || payload.status === "overdue" ? "failed"
      : "pending";
    await requestAdminGraphql(
      `mutation SyncOrderPayment($id: uuid!, $set: orders_set_input!) {
        update_orders_by_pk(pk_columns: { id: $id }, _set: $set) { id }
      }`,
      { id: payload.order_id, set: { payment_status: orderPaymentStatus } },
    ).catch(() => { /* non-critical */ });
  }
}

export async function deleteInvoice(invoiceId: string) {
  await deleteInvoiceJournal(invoiceId);

  const deleteLinesResponse = await requestAdminGraphql<{
    delete_invoice_lines: { affected_rows: number };
  }>(
    `
      mutation DeleteInvoiceLinesBeforeDelete($invoiceId: uuid!) {
        delete_invoice_lines(where: { invoice_id: { _eq: $invoiceId } }) {
          affected_rows
        }
      }
    `,
    { invoiceId },
  );
  unwrap(deleteLinesResponse, "Failed to delete invoice lines.");

  const deleteInvoiceResponse = await requestAdminGraphql<{
    delete_invoices_by_pk: { id: string } | null;
  }>(
    `
      mutation DeleteInvoice($id: uuid!) {
        delete_invoices_by_pk(id: $id) {
          id
        }
      }
    `,
    { id: invoiceId },
  );
  unwrap(deleteInvoiceResponse, "Invoice was not deleted.");
}

/**
 * Record a payment on an invoice. Updates paid_pkr, balance_pkr, and auto-sets status.
 * - If paid >= total → status = "paid"
 * - If paid > 0 but < total → status = "partially_paid"
 * - If paid = 0 → keeps current status
 */
export async function recordPayment(
  invoiceId: string,
  paymentAmount: number,
  currentPaid: number,
  totalPkr: number,
) {
  const newPaid = Math.min(currentPaid + paymentAmount, totalPkr);
  const newBalance = Math.max(0, totalPkr - newPaid);
  const newStatus: InvoiceStatusCode =
    newPaid >= totalPkr ? "paid" : newPaid > 0 ? "partially_paid" : "issued";

  const response = await requestAdminGraphql<{ update_invoices_by_pk: { id: string; order_id: string | null } | null }>(
    `mutation RecordPayment($id: uuid!, $set: invoices_set_input!) {
      update_invoices_by_pk(pk_columns: { id: $id }, _set: $set) { id order_id }
    }`,
    {
      id: invoiceId,
      set: {
        paid_pkr: newPaid,
        balance_pkr: newBalance,
        status: newStatus,
      },
    },
  );
  unwrap(response, "Failed to record payment.");

  // If invoice is fully paid and linked to an order, update order payment_status
  const invoiceData = response.body.data?.update_invoices_by_pk;
  const orderId = invoiceData?.order_id;
  if (newStatus === "paid" && orderId) {
    await requestAdminGraphql(
      `mutation UpdateOrderPaymentStatus($id: uuid!, $set: orders_set_input!) {
        update_orders_by_pk(pk_columns: { id: $id }, _set: $set) { id }
      }`,
      { id: orderId, set: { payment_status: "paid" } },
    ).catch(() => { /* non-critical */ });
  }

  // Re-sync journal to reflect new payment state
  try {
    // Fetch full invoice to get all fields needed for journal sync
    const invRes = await requestAdminGraphql<{
      invoices_by_pk: {
        invoice_no: string; order_id: string | null; customer_name: string;
        customer_email: string | null; issue_date: string; due_date: string | null;
        subtotal_pkr: number; discount_pkr: number; shipping_pkr: number; tax_pkr: number;
        total_pkr: number; paid_pkr: number; balance_pkr: number;
        status: string; notes: string | null;
      } | null;
    }>(
      `query GetInvoiceForSync($id: uuid!) {
        invoices_by_pk(id: $id) {
          invoice_no order_id customer_name customer_email issue_date due_date
          subtotal_pkr discount_pkr shipping_pkr tax_pkr total_pkr paid_pkr balance_pkr status notes
        }
      }`,
      { id: invoiceId },
    );
    const inv = invRes.body.data?.invoices_by_pk;
    if (inv) {
      const syncPayload: InvoicePayload = {
        invoice_no: inv.invoice_no, order_id: inv.order_id, customer_profile_id: null,
        customer_name: inv.customer_name, customer_email: inv.customer_email,
        issue_date: inv.issue_date, due_date: inv.due_date,
        subtotal_pkr: Number(inv.subtotal_pkr), discount_pkr: Number(inv.discount_pkr),
        shipping_pkr: Number(inv.shipping_pkr ?? 0), tax_pkr: Number(inv.tax_pkr),
        total_pkr: Number(inv.total_pkr), paid_pkr: Number(inv.paid_pkr),
        balance_pkr: Number(inv.balance_pkr), status: inv.status as InvoiceStatusCode,
        notes: inv.notes,
      };
      await syncInvoiceJournal(invoiceId, syncPayload);
    }
  } catch { /* journal sync is non-critical for payment flow */ }

  return { newPaid, newBalance, newStatus };
}

/**
 * Approve full payment — marks invoice as fully paid.
 */
export async function approveFullPayment(invoiceId: string, totalPkr: number) {
  return recordPayment(invoiceId, totalPkr, 0, totalPkr);
}
