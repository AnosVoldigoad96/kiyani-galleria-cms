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
  tax_pkr: number;
  total_pkr: number;
  paid_pkr: number;
  balance_pkr: number;
  status: InvoiceStatusCode;
  notes: string | null;
};

export type InvoiceLinePayload = {
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price_pkr: number;
  line_total_pkr: number;
};

type GraphqlWrap<T> = {
  body: {
    data?: T;
    errors?: Array<{ message: string }>;
  };
};

const CASH_CODE = "1000";
const AR_CODE = "1100";
const SALES_CODE = "4000";
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

function buildInvoiceJournalLines(
  total: number,
  paid: number,
  status: InvoiceStatusCode,
  cashAccountId: string,
  arAccountId: string,
  salesAccountId: string,
) {
  if (status === "void" || total <= 0) {
    return [] as JournalLineDraft[];
  }

  const safeTotal = money(total);
  const safePaid = Math.max(0, Math.min(money(paid), safeTotal));
  const outstanding = money(safeTotal - safePaid);
  const lines: JournalLineDraft[] = [];
  let lineOrder = 0;

  if (safePaid > 0) {
    lines.push({
      account_id: cashAccountId,
      description: "Cash received against invoice",
      debit_pkr: safePaid,
      credit_pkr: 0,
      line_order: lineOrder++,
    });
  }

  if (outstanding > 0) {
    lines.push({
      account_id: arAccountId,
      description: "Accounts receivable recognized",
      debit_pkr: outstanding,
      credit_pkr: 0,
      line_order: lineOrder++,
    });
  }

  lines.push({
    account_id: salesAccountId,
    description: "Sales revenue recognized",
    debit_pkr: 0,
    credit_pkr: safeTotal,
    line_order: lineOrder,
  });

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
        sort_order: index,
      })),
    },
  );
  unwrap(insertResponse, "Failed to save invoice lines.");
}

async function syncInvoiceJournal(invoiceId: string, payload: InvoicePayload) {
  const contextResponse = await requestAdminGraphql<{
    accounting_accounts: Array<{ id: string; code: string }>;
    journal_entries: Array<{ id: string }>;
  }>(
    `
      query InvoiceJournalContext($invoiceId: uuid!, $referenceType: String!) {
        accounting_accounts(
          where: { code: { _in: ["1000", "1100", "4000"] }, is_active: { _eq: true } }
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
    { invoiceId, referenceType: REF_TYPE },
  );

  const context = unwrap(contextResponse, "Failed to load accounting accounts.");
  const byCode = new Map(context.accounting_accounts.map((account) => [account.code, account.id]));
  const cashId = byCode.get(CASH_CODE);
  const arId = byCode.get(AR_CODE);
  const salesId = byCode.get(SALES_CODE);

  if (!cashId || !arId || !salesId) {
    throw new Error("Missing accounting accounts (1000, 1100, 4000).");
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

  const lines = buildInvoiceJournalLines(
    payload.total_pkr,
    payload.paid_pkr,
    payload.status,
    cashId,
    arId,
    salesId,
  );

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
