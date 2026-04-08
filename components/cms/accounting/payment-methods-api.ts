"use client";

import { requestAdminGraphql } from "@/lib/admin-graphql-client";

export type PaymentMethodPayload = {
  name: string;
  type: string;
  account_title: string | null;
  account_number: string | null;
  bank_name: string | null;
  instructions: string | null;
  is_active: boolean;
  sort_order: number;
};

function unwrap<T>(
  response: { body: { data?: T; errors?: Array<{ message: string }> } },
  message: string,
) {
  if (response.body.errors?.length) {
    throw new Error(response.body.errors.map((e) => e.message).join(", "));
  }
  if (!response.body.data) {
    throw new Error(message);
  }
}

export async function createPaymentMethod(payload: PaymentMethodPayload) {
  const response = await requestAdminGraphql<{ insert_payment_methods_one: { id: string } | null }>(
    `mutation CreatePaymentMethod($object: payment_methods_insert_input!) {
      insert_payment_methods_one(object: $object) { id }
    }`,
    { object: payload },
  );
  unwrap(response, "Payment method was not created.");
}

export async function updatePaymentMethod(id: string, payload: Partial<PaymentMethodPayload>) {
  const response = await requestAdminGraphql<{ update_payment_methods_by_pk: { id: string } | null }>(
    `mutation UpdatePaymentMethod($id: uuid!, $set: payment_methods_set_input!) {
      update_payment_methods_by_pk(pk_columns: { id: $id }, _set: $set) { id }
    }`,
    { id, set: payload },
  );
  unwrap(response, "Payment method was not updated.");
}

export async function deletePaymentMethod(id: string) {
  const response = await requestAdminGraphql<{ delete_payment_methods_by_pk: { id: string } | null }>(
    `mutation DeletePaymentMethod($id: uuid!) {
      delete_payment_methods_by_pk(id: $id) { id }
    }`,
    { id },
  );
  unwrap(response, "Payment method was not deleted.");
}
