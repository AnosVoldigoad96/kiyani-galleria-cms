"use client";

import { requestAdminGraphql } from "@/lib/admin-graphql-client";

export type OrderPaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type OrderFulfillmentStatus =
  | "processing"
  | "packed"
  | "dispatched"
  | "delivered"
  | "cancelled";

export type OrderPayload = {
  order_no: string;
  user_id?: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  city: string | null;
  address: string | null;
  payment_status: OrderPaymentStatus;
  fulfillment_status: OrderFulfillmentStatus;
  subtotal_pkr: number;
  discount_pkr: number;
  shipping_pkr: number;
  total_pkr: number;
  notes: string | null;
};

export type OrderItemPayload = {
  product_id: string | null;
  product_name: string;
  sku: string | null;
  quantity: number;
  unit_price_pkr: number;
  total_price_pkr: number;
};

type UnwrapResponse<T> = {
  body: {
    data?: T;
    errors?: Array<{ message: string }>;
  };
};

const ORDER_REFERENCE_TYPE = "order";
const CASH_ACCOUNT_CODE = "1000";
const RECEIVABLE_ACCOUNT_CODE = "1100";
const REVENUE_ACCOUNT_CODE = "4000";

function unwrap<T>(response: UnwrapResponse<T>, message: string) {
  if (response.body.errors?.length) {
    throw new Error(response.body.errors.map((item) => item.message).join(", "));
  }

  if (!response.body.data) {
    throw new Error(message);
  }

  return response.body.data;
}

function toMoney(value: number) {
  return Number((Number.isFinite(value) ? value : 0).toFixed(2));
}

function buildInvoiceStatus(paymentStatus: OrderPaymentStatus) {
  if (paymentStatus === "paid") {
    return "paid";
  }

  if (paymentStatus === "pending") {
    return "issued";
  }

  return "void";
}

function buildInvoiceAmounts(total: number, paymentStatus: OrderPaymentStatus) {
  if (paymentStatus === "paid") {
    return { paid: total, balance: 0 };
  }

  if (paymentStatus === "pending") {
    return { paid: 0, balance: total };
  }

  return { paid: 0, balance: 0 };
}

function buildJournalLines(
  total: number,
  paymentStatus: OrderPaymentStatus,
  cashAccountId: string,
  receivableAccountId: string,
  revenueAccountId: string,
) {
  if (paymentStatus === "failed" || total <= 0) {
    return [] as Array<{
      account_id: string;
      debit_pkr: number;
      credit_pkr: number;
      line_order: number;
      description: string;
    }>;
  }

  if (paymentStatus === "refunded") {
    return [
      {
        account_id: revenueAccountId,
        debit_pkr: total,
        credit_pkr: 0,
        line_order: 0,
        description: "Refund reversal for order revenue",
      },
      {
        account_id: cashAccountId,
        debit_pkr: 0,
        credit_pkr: total,
        line_order: 1,
        description: "Cash refunded to customer",
      },
    ];
  }

  return [
    {
      account_id: paymentStatus === "paid" ? cashAccountId : receivableAccountId,
      debit_pkr: total,
      credit_pkr: 0,
      line_order: 0,
      description:
        paymentStatus === "paid"
          ? "Cash received from order"
          : "Accounts receivable recognized",
    },
    {
      account_id: revenueAccountId,
      debit_pkr: 0,
      credit_pkr: total,
      line_order: 1,
      description: "Sales revenue recognized",
    },
  ];
}

function buildInvoiceNo(orderNo: string) {
  return orderNo.replace(/^ORD/i, "INV");
}

function buildJournalNo(orderNo: string) {
  return orderNo.replace(/^ORD/i, "JRN");
}

function currentIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

async function replaceOrderItems(orderId: string, items: OrderItemPayload[]) {
  const deleteResponse = await requestAdminGraphql<{
    delete_order_items: { affected_rows: number };
  }>(
    `
      mutation DeleteOrderItems($orderId: uuid!) {
        delete_order_items(where: { order_id: { _eq: $orderId } }) {
          affected_rows
        }
      }
    `,
    { orderId },
  );

  unwrap(deleteResponse, "Failed to clear order items.");

  if (!items.length) {
    return;
  }

  const insertResponse = await requestAdminGraphql<{
    insert_order_items: { affected_rows: number };
  }>(
    `
      mutation InsertOrderItems($objects: [order_items_insert_input!]!) {
        insert_order_items(objects: $objects) {
          affected_rows
        }
      }
    `,
    {
      objects: items.map((item) => ({
        order_id: orderId,
        product_id: item.product_id,
        product_name: item.product_name,
        sku: item.sku,
        quantity: item.quantity,
        unit_price_pkr: toMoney(item.unit_price_pkr),
        total_price_pkr: toMoney(item.total_price_pkr),
      })),
    },
  );

  unwrap(insertResponse, "Failed to save order items.");
}

async function syncOrderAccounting(orderId: string, payload: OrderPayload, items: OrderItemPayload[]) {
  const contextResponse = await requestAdminGraphql<{
    accounting_accounts: Array<{ id: string; code: string }>;
    invoices: Array<{ id: string }>;
    journal_entries: Array<{ id: string }>;
  }>(
    `
      query OrderAccountingContext($orderId: uuid!, $referenceType: String!) {
        accounting_accounts(where: { code: { _in: ["1000", "1100", "4000"] }, is_active: { _eq: true } }) {
          id
          code
        }
        invoices(where: { order_id: { _eq: $orderId } }, limit: 1) {
          id
        }
        journal_entries(
          where: {
            reference_type: { _eq: $referenceType }
            reference_id: { _eq: $orderId }
          }
          limit: 1
        ) {
          id
        }
      }
    `,
    { orderId, referenceType: ORDER_REFERENCE_TYPE },
  );

  const context = unwrap(contextResponse, "Unable to load accounting context.");
  const accountsByCode = new Map(context.accounting_accounts.map((account) => [account.code, account.id]));
  const cashAccountId = accountsByCode.get(CASH_ACCOUNT_CODE);
  const receivableAccountId = accountsByCode.get(RECEIVABLE_ACCOUNT_CODE);
  const revenueAccountId = accountsByCode.get(REVENUE_ACCOUNT_CODE);

  if (!cashAccountId || !receivableAccountId || !revenueAccountId) {
    throw new Error(
      "Missing accounting accounts (1000, 1100, 4000). Seed accounting_schema.sql first.",
    );
  }

  const total = toMoney(payload.total_pkr);
  const subtotal = toMoney(payload.subtotal_pkr);
  const discount = toMoney(payload.discount_pkr);
  const { paid, balance } = buildInvoiceAmounts(total, payload.payment_status);
  const invoiceNo = buildInvoiceNo(payload.order_no);
  const existingInvoiceId = context.invoices[0]?.id;
  const invoiceSet = {
    invoice_no: invoiceNo,
    customer_name: payload.customer_name,
    customer_email: payload.customer_email,
    issue_date: currentIsoDate(),
    due_date: null,
    subtotal_pkr: subtotal,
    discount_pkr: discount,
    tax_pkr: 0,
    total_pkr: total,
    paid_pkr: toMoney(paid),
    balance_pkr: toMoney(balance),
    status: buildInvoiceStatus(payload.payment_status),
    notes: payload.notes,
  };

  let invoiceId: string | null = existingInvoiceId ?? null;

  if (existingInvoiceId) {
    const updateInvoiceResponse = await requestAdminGraphql<{
      update_invoices_by_pk: { id: string } | null;
    }>(
      `
        mutation UpdateOrderInvoice($id: uuid!, $set: invoices_set_input!) {
          update_invoices_by_pk(pk_columns: { id: $id }, _set: $set) {
            id
          }
        }
      `,
      { id: existingInvoiceId, set: invoiceSet },
    );

    unwrap(updateInvoiceResponse, "Failed to update linked invoice.");
  } else {
    const insertInvoiceResponse = await requestAdminGraphql<{
      insert_invoices_one: { id: string } | null;
    }>(
      `
        mutation InsertOrderInvoice($object: invoices_insert_input!) {
          insert_invoices_one(object: $object) {
            id
          }
        }
      `,
      {
        object: {
          ...invoiceSet,
          order_id: orderId,
          customer_profile_id: payload.user_id ?? null,
        },
      },
    );

    const data = unwrap(insertInvoiceResponse, "Failed to create linked invoice.");
    invoiceId = data.insert_invoices_one?.id ?? null;
  }

  if (!invoiceId) {
    throw new Error("Invoice id was not returned.");
  }
  const ensuredInvoiceId = invoiceId;

  const deleteInvoiceLinesResponse = await requestAdminGraphql<{
    delete_invoice_lines: { affected_rows: number };
  }>(
    `
      mutation DeleteInvoiceLines($invoiceId: uuid!) {
        delete_invoice_lines(where: { invoice_id: { _eq: $invoiceId } }) {
          affected_rows
        }
      }
    `,
    { invoiceId: ensuredInvoiceId },
  );

  unwrap(deleteInvoiceLinesResponse, "Failed to clear invoice lines.");

  if (items.length) {
    const insertInvoiceLinesResponse = await requestAdminGraphql<{
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
        objects: items.map((item, index) => ({
          invoice_id: ensuredInvoiceId,
          product_id: item.product_id,
          description: item.product_name,
          quantity: toMoney(item.quantity),
          unit_price_pkr: toMoney(item.unit_price_pkr),
          line_total_pkr: toMoney(item.total_price_pkr),
          sort_order: index,
        })),
      },
    );

    unwrap(insertInvoiceLinesResponse, "Failed to save invoice lines.");
  }

  const existingJournalId = context.journal_entries[0]?.id;
  const journalNo = buildJournalNo(payload.order_no);
  const journalStatus = payload.payment_status === "failed" ? "void" : "posted";
  const journalSet = {
    journal_no: journalNo,
    entry_date: currentIsoDate(),
    reference_type: ORDER_REFERENCE_TYPE,
    reference_id: orderId,
    memo: `Order ${payload.order_no} accounting entry`,
    status: journalStatus,
  };

  let journalId: string | null = existingJournalId ?? null;
  if (existingJournalId) {
    const updateJournalResponse = await requestAdminGraphql<{
      update_journal_entries_by_pk: { id: string } | null;
    }>(
      `
        mutation UpdateOrderJournal($id: uuid!, $set: journal_entries_set_input!) {
          update_journal_entries_by_pk(pk_columns: { id: $id }, _set: $set) {
            id
          }
        }
      `,
      { id: existingJournalId, set: journalSet },
    );

    unwrap(updateJournalResponse, "Failed to update linked journal.");
  } else {
    const insertJournalResponse = await requestAdminGraphql<{
      insert_journal_entries_one: { id: string } | null;
    }>(
      `
        mutation InsertOrderJournal($object: journal_entries_insert_input!) {
          insert_journal_entries_one(object: $object) {
            id
          }
        }
      `,
      { object: journalSet },
    );

    const data = unwrap(insertJournalResponse, "Failed to create linked journal.");
    journalId = data.insert_journal_entries_one?.id ?? null;
  }

  if (!journalId) {
    throw new Error("Journal id was not returned.");
  }
  const ensuredJournalId = journalId;

  const deleteJournalLinesResponse = await requestAdminGraphql<{
    delete_journal_lines: { affected_rows: number };
  }>(
    `
      mutation DeleteJournalLines($journalId: uuid!) {
        delete_journal_lines(where: { journal_entry_id: { _eq: $journalId } }) {
          affected_rows
        }
      }
    `,
    { journalId: ensuredJournalId },
  );

  unwrap(deleteJournalLinesResponse, "Failed to clear journal lines.");

  const journalLines = buildJournalLines(
    total,
    payload.payment_status,
    cashAccountId,
    receivableAccountId,
    revenueAccountId,
  );

  if (!journalLines.length) {
    return;
  }

  const insertJournalLinesResponse = await requestAdminGraphql<{
    insert_journal_lines: { affected_rows: number };
  }>(
    `
      mutation InsertJournalLines($objects: [journal_lines_insert_input!]!) {
        insert_journal_lines(objects: $objects) {
          affected_rows
        }
      }
    `,
    {
      objects: journalLines.map((line) => ({
        journal_entry_id: ensuredJournalId,
        account_id: line.account_id,
        description: line.description,
        debit_pkr: toMoney(line.debit_pkr),
        credit_pkr: toMoney(line.credit_pkr),
        line_order: line.line_order,
      })),
    },
  );

  unwrap(insertJournalLinesResponse, "Failed to save journal lines.");
}

async function deleteLinkedAccounting(orderId: string) {
  const contextResponse = await requestAdminGraphql<{
    invoices: Array<{ id: string }>;
    journal_entries: Array<{ id: string }>;
  }>(
    `
      query LinkedAccountingRecords($orderId: uuid!, $referenceType: String!) {
        invoices(where: { order_id: { _eq: $orderId } }) {
          id
        }
        journal_entries(
          where: {
            reference_type: { _eq: $referenceType }
            reference_id: { _eq: $orderId }
          }
        ) {
          id
        }
      }
    `,
    { orderId, referenceType: ORDER_REFERENCE_TYPE },
  );

  const context = unwrap(contextResponse, "Failed to load linked accounting records.");
  const invoiceIds = context.invoices.map((invoice) => invoice.id);
  const journalIds = context.journal_entries.map((journal) => journal.id);

  if (invoiceIds.length) {
    const deleteInvoiceLinesResponse = await requestAdminGraphql<{
      delete_invoice_lines: { affected_rows: number };
    }>(
      `
        mutation DeleteInvoiceLinesBatch($invoiceIds: [uuid!]!) {
          delete_invoice_lines(where: { invoice_id: { _in: $invoiceIds } }) {
            affected_rows
          }
        }
      `,
      { invoiceIds },
    );
    unwrap(deleteInvoiceLinesResponse, "Failed to delete linked invoice lines.");

    const deleteInvoicesResponse = await requestAdminGraphql<{
      delete_invoices: { affected_rows: number };
    }>(
      `
        mutation DeleteInvoicesBatch($invoiceIds: [uuid!]!) {
          delete_invoices(where: { id: { _in: $invoiceIds } }) {
            affected_rows
          }
        }
      `,
      { invoiceIds },
    );
    unwrap(deleteInvoicesResponse, "Failed to delete linked invoices.");
  }

  if (journalIds.length) {
    const deleteJournalLinesResponse = await requestAdminGraphql<{
      delete_journal_lines: { affected_rows: number };
    }>(
      `
        mutation DeleteJournalLinesBatch($journalIds: [uuid!]!) {
          delete_journal_lines(where: { journal_entry_id: { _in: $journalIds } }) {
            affected_rows
          }
        }
      `,
      { journalIds },
    );
    unwrap(deleteJournalLinesResponse, "Failed to delete linked journal lines.");

    const deleteJournalsResponse = await requestAdminGraphql<{
      delete_journal_entries: { affected_rows: number };
    }>(
      `
        mutation DeleteJournalsBatch($journalIds: [uuid!]!) {
          delete_journal_entries(where: { id: { _in: $journalIds } }) {
            affected_rows
          }
        }
      `,
      { journalIds },
    );
    unwrap(deleteJournalsResponse, "Failed to delete linked journals.");
  }
}

export async function createOrder(
  payload: OrderPayload,
  items: OrderItemPayload[],
  syncAccounting = true,
) {
  const response = await requestAdminGraphql<{ insert_orders_one: { id: string } | null }>(
    `
      mutation CreateOrder($object: orders_insert_input!) {
        insert_orders_one(object: $object) {
          id
        }
      }
    `,
    { object: payload },
  );

  const data = unwrap(response, "Order was not created.");
  const orderId = data.insert_orders_one?.id;

  if (!orderId) {
    throw new Error("Order ID was not returned.");
  }

  await replaceOrderItems(orderId, items);

  if (syncAccounting) {
    await syncOrderAccounting(orderId, payload, items);
  }
}

export async function updateOrder(
  orderId: string,
  payload: Partial<OrderPayload>,
  items: OrderItemPayload[],
  syncAccounting = true,
) {
  const response = await requestAdminGraphql<{ update_orders_by_pk: { id: string } | null }>(
    `
      mutation UpdateOrder($id: uuid!, $set: orders_set_input!) {
        update_orders_by_pk(pk_columns: { id: $id }, _set: $set) {
          id
        }
      }
    `,
    { id: orderId, set: payload },
  );

  unwrap(response, "Order was not updated.");
  await replaceOrderItems(orderId, items);

  if (syncAccounting) {
    const orderNo = payload.order_no;
    if (!orderNo) {
      throw new Error("Order number is required to sync accounting.");
    }

    const mergedPayload: OrderPayload = {
      order_no: orderNo,
      user_id: payload.user_id ?? null,
      customer_name: payload.customer_name ?? "Unknown customer",
      customer_email: payload.customer_email ?? null,
      customer_phone: payload.customer_phone ?? null,
      city: payload.city ?? null,
      address: payload.address ?? null,
      payment_status: payload.payment_status ?? "pending",
      fulfillment_status: payload.fulfillment_status ?? "processing",
      subtotal_pkr: toMoney(payload.subtotal_pkr ?? 0),
      discount_pkr: toMoney(payload.discount_pkr ?? 0),
      shipping_pkr: toMoney(payload.shipping_pkr ?? 0),
      total_pkr: toMoney(payload.total_pkr ?? 0),
      notes: payload.notes ?? null,
    };
    await syncOrderAccounting(orderId, mergedPayload, items);
  }
}

export async function deleteOrder(orderId: string) {
  await deleteLinkedAccounting(orderId);

  const response = await requestAdminGraphql<{ delete_orders_by_pk: { id: string } | null }>(
    `
      mutation DeleteOrder($id: uuid!) {
        delete_orders_by_pk(id: $id) {
          id
        }
      }
    `,
    { id: orderId },
  );

  unwrap(response, "Order was not deleted.");
}
