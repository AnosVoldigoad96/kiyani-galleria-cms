"use client";

import { requestAdminGraphql } from "@/lib/admin-graphql-client";
import {
  createInvoice,
  deleteInvoice,
  issueRefund,
  updateInvoice,
  type InvoiceLinePayload,
  type InvoicePayload,
  type InvoiceStatusCode,
} from "@/components/cms/accounting/invoice-api";

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

function buildInvoiceStatus(paymentStatus: OrderPaymentStatus): InvoiceStatusCode {
  if (paymentStatus === "paid") return "paid";
  if (paymentStatus === "pending") return "issued";
  if (paymentStatus === "refunded") return "paid"; // paid then refunded separately
  return "void";
}

function buildInvoiceAmounts(total: number, paymentStatus: OrderPaymentStatus) {
  if (paymentStatus === "paid" || paymentStatus === "refunded") {
    return { paid: total, balance: 0 };
  }
  if (paymentStatus === "pending") {
    return { paid: 0, balance: total };
  }
  return { paid: 0, balance: 0 };
}

function buildInvoiceNo(orderNo: string) {
  return orderNo.replace(/^ORD/i, "INV");
}

function currentIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

async function replaceOrderItems(orderId: string, items: OrderItemPayload[]) {
  const objects = items.map((item) => ({
    order_id: orderId,
    product_id: item.product_id,
    product_name: item.product_name,
    sku: item.sku,
    quantity: item.quantity,
    unit_price_pkr: toMoney(item.unit_price_pkr),
    total_price_pkr: toMoney(item.total_price_pkr),
  }));

  if (objects.length) {
    // Batch delete + insert in a single request
    const response = await requestAdminGraphql<{
      delete_order_items: { affected_rows: number };
      insert_order_items: { affected_rows: number };
    }>(
      `
        mutation ReplaceOrderItems($orderId: uuid!, $objects: [order_items_insert_input!]!) {
          delete_order_items(where: { order_id: { _eq: $orderId } }) {
            affected_rows
          }
          insert_order_items(objects: $objects) {
            affected_rows
          }
        }
      `,
      { orderId, objects },
    );

    unwrap(response, "Failed to replace order items.");
  } else {
    // No items — just delete
    const response = await requestAdminGraphql<{
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

    unwrap(response, "Failed to clear order items.");
  }
}

async function findOrderInvoiceId(orderId: string): Promise<string | null> {
  const response = await requestAdminGraphql<{ invoices: Array<{ id: string; status: string; paid_pkr: number; total_pkr: number }> }>(
    `query OrderInvoice($orderId: uuid!) {
      invoices(where: { order_id: { _eq: $orderId } }, limit: 1) {
        id status paid_pkr total_pkr
      }
    }`,
    { orderId },
  );
  return unwrap(response, "Failed to look up order invoice.").invoices[0]?.id ?? null;
}

async function syncOrderAccounting(orderId: string, payload: OrderPayload, items: OrderItemPayload[]) {
  const total = toMoney(payload.total_pkr);
  const subtotal = toMoney(payload.subtotal_pkr);
  const discount = toMoney(payload.discount_pkr);
  const shipping = toMoney(payload.shipping_pkr);
  const { paid } = buildInvoiceAmounts(total, payload.payment_status);
  const invoiceNo = buildInvoiceNo(payload.order_no);
  const status = buildInvoiceStatus(payload.payment_status);

  const invoicePayload: InvoicePayload = {
    invoice_no: invoiceNo,
    order_id: orderId,
    customer_profile_id: payload.user_id ?? null,
    customer_name: payload.customer_name,
    customer_email: payload.customer_email,
    issue_date: currentIsoDate(),
    due_date: null,
    subtotal_pkr: subtotal,
    discount_pkr: discount,
    shipping_pkr: shipping,
    tax_pkr: 0,
    total_pkr: total,
    paid_pkr: toMoney(paid),
    balance_pkr: toMoney(total - paid),
    status,
    notes: payload.notes,
    payment_method_id: null,
  };

  const invoiceLines: InvoiceLinePayload[] = items.map((item) => ({
    product_id: item.product_id,
    description: item.product_name,
    quantity: toMoney(item.quantity),
    unit_price_pkr: toMoney(item.unit_price_pkr),
    line_total_pkr: toMoney(item.total_price_pkr),
    // COGS contribution unknown at this layer — set to 0. Admins can edit from Invoices tab.
    our_cost_pkr: 0,
  }));

  const existingInvoiceId = await findOrderInvoiceId(orderId);

  if (existingInvoiceId) {
    await updateInvoice(existingInvoiceId, invoicePayload, invoiceLines, true);
  } else {
    await createInvoice(invoicePayload, invoiceLines, true);
  }

  // Refunded: issue a full refund journal on top of the paid invoice.
  if (payload.payment_status === "refunded") {
    const id = existingInvoiceId ?? (await findOrderInvoiceId(orderId));
    if (id) {
      await issueRefund(id, total, { reason: "Order refunded" }).catch((e: unknown) => {
        // If a refund already exists (re-sync), the invoice's paid_pkr will be 0 and issueRefund
        // will reject with "Refund exceeds paid amount" — that's fine, skip.
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes("exceeds paid amount")) throw e;
      });
    }
  }
}


async function deleteLinkedAccounting(orderId: string) {
  // Look up any linked invoice. Posted journals must survive order deletion as audit trail,
  // so we void the invoice (which creates reversing journals) rather than hard-delete.
  const response = await requestAdminGraphql<{
    invoices: Array<{ id: string; status: string }>;
  }>(
    `query LinkedInvoices($orderId: uuid!) {
      invoices(where: { order_id: { _eq: $orderId } }) { id status }
    }`,
    { orderId },
  );
  const invoices = unwrap(response, "Failed to load linked invoices.").invoices;

  for (const inv of invoices) {
    try {
      // Try clean delete first. This succeeds only if no posted journals exist.
      await deleteInvoice(inv.id);
    } catch {
      // Posted journals exist — void the invoice instead. The order FK (on delete set null)
      // detaches it once the order is removed, but the invoice + reversing journal remain.
      await requestAdminGraphql(
        `mutation VoidInvoice($id: uuid!) {
          update_invoices_by_pk(pk_columns: { id: $id }, _set: { status: "void" }) { id }
        }`,
        { id: inv.id },
      ).then((r) => unwrap(r, "Failed to void linked invoice."));

      // Reverse the sale journal via the same flow updateInvoice uses when status becomes void.
      // Fetch the invoice payload and call updateInvoice with status=void.
      const detail = await requestAdminGraphql<{
        invoices_by_pk: null | {
          invoice_no: string; order_id: string | null; customer_profile_id: string | null;
          customer_name: string; customer_email: string | null;
          issue_date: string; due_date: string | null;
          subtotal_pkr: number; discount_pkr: number; shipping_pkr: number; tax_pkr: number;
          total_pkr: number; paid_pkr: number; balance_pkr: number;
          notes: string | null; payment_method_id: string | null;
        };
        invoice_lines: Array<{ product_id: string | null; description: string; quantity: number; unit_price_pkr: number; line_total_pkr: number; our_cost_pkr: number }>;
      }>(
        `query InvoiceForVoid($id: uuid!) {
          invoices_by_pk(id: $id) {
            invoice_no order_id customer_profile_id customer_name customer_email
            issue_date due_date subtotal_pkr discount_pkr shipping_pkr tax_pkr
            total_pkr paid_pkr balance_pkr notes payment_method_id
          }
          invoice_lines(where: { invoice_id: { _eq: $id } }, order_by: { sort_order: asc }) {
            product_id description quantity unit_price_pkr line_total_pkr our_cost_pkr
          }
        }`,
        { id: inv.id },
      );
      const d = unwrap(detail, "Failed to load invoice for void.");
      if (d.invoices_by_pk) {
        const inv2 = d.invoices_by_pk;
        await updateInvoice(
          inv.id,
          {
            invoice_no: inv2.invoice_no,
            order_id: null, // detach from order since we're deleting it
            customer_profile_id: inv2.customer_profile_id,
            customer_name: inv2.customer_name,
            customer_email: inv2.customer_email,
            issue_date: inv2.issue_date,
            due_date: inv2.due_date,
            subtotal_pkr: Number(inv2.subtotal_pkr),
            discount_pkr: Number(inv2.discount_pkr),
            shipping_pkr: Number(inv2.shipping_pkr ?? 0),
            tax_pkr: Number(inv2.tax_pkr),
            total_pkr: Number(inv2.total_pkr),
            paid_pkr: Number(inv2.paid_pkr),
            balance_pkr: Number(inv2.balance_pkr),
            status: "void",
            notes: inv2.notes,
            payment_method_id: inv2.payment_method_id,
          },
          d.invoice_lines.map((l) => ({
            product_id: l.product_id,
            description: l.description,
            quantity: Number(l.quantity),
            unit_price_pkr: Number(l.unit_price_pkr),
            line_total_pkr: Number(l.line_total_pkr),
            our_cost_pkr: Number(l.our_cost_pkr ?? 0),
          })),
          true,
        );
      }
    }
  }

  // Also clean up any standalone journal entries referencing the order directly
  // (from legacy data created before the refactor). Draft-only deletion.
  const legacy = await requestAdminGraphql<{
    journal_entries: Array<{ id: string; status: string }>;
  }>(
    `query LegacyOrderJournals($orderId: uuid!, $referenceType: String!) {
      journal_entries(where: { reference_type: { _eq: $referenceType }, reference_id: { _eq: $orderId } }) {
        id status
      }
    }`,
    { orderId, referenceType: ORDER_REFERENCE_TYPE },
  );
  const rows = unwrap(legacy, "Failed to load legacy order journals.").journal_entries;
  const draftIds = rows.filter((r) => r.status === "draft").map((r) => r.id);
  if (draftIds.length) {
    await requestAdminGraphql(
      `mutation DeleteLegacyOrderJournals($ids: [uuid!]!) {
        delete_journal_lines(where: { journal_entry_id: { _in: $ids } }) { affected_rows }
        delete_journal_entries(where: { id: { _in: $ids } }) { affected_rows }
      }`,
      { ids: draftIds },
    ).then((r) => unwrap(r, "Failed to delete legacy draft journals."));
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
