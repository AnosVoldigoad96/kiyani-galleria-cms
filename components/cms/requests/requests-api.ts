"use client";

import { requestAdminGraphql } from "@/lib/admin-graphql-client";

export type RequestPriority = "low" | "medium" | "high";
export type RequestStatus = "new" | "quoted" | "in_progress" | "completed" | "cancelled";

export type RequestPayload = {
  request_no: string;
  user_id?: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  request_type: string;
  brief: string;
  budget_pkr: number | null;
  due_date: string | null;
  priority: RequestPriority;
  status: RequestStatus;
  assigned_to?: string | null;
};

type GraphqlEnvelope<T> = {
  body: {
    data?: T;
    errors?: Array<{ message: string }>;
  };
};

function unwrap<T>(response: GraphqlEnvelope<T>, message: string) {
  if (response.body.errors?.length) {
    throw new Error(response.body.errors.map((item) => item.message).join(", "));
  }

  if (!response.body.data) {
    throw new Error(message);
  }

  return response.body.data;
}

function money(value: number | null) {
  if (value === null || Number.isNaN(Number(value))) {
    return null;
  }

  return Number(Number(value).toFixed(2));
}

export async function createRequest(payload: RequestPayload) {
  const response = await requestAdminGraphql<{
    insert_custom_requests_one: { id: string } | null;
  }>(
    `
      mutation CreateCustomRequest($object: custom_requests_insert_input!) {
        insert_custom_requests_one(object: $object) {
          id
        }
      }
    `,
    {
      object: {
        ...payload,
        budget_pkr: money(payload.budget_pkr),
      },
    },
  );

  unwrap(response, "Request was not created.");
}

export async function updateRequest(requestId: string, payload: Partial<RequestPayload>) {
  const response = await requestAdminGraphql<{
    update_custom_requests_by_pk: { id: string } | null;
  }>(
    `
      mutation UpdateCustomRequest($id: uuid!, $set: custom_requests_set_input!) {
        update_custom_requests_by_pk(pk_columns: { id: $id }, _set: $set) {
          id
        }
      }
    `,
    {
      id: requestId,
      set: {
        ...payload,
        budget_pkr:
          payload.budget_pkr === undefined ? undefined : money(payload.budget_pkr ?? null),
      },
    },
  );

  unwrap(response, "Request was not updated.");
}

export async function deleteRequest(requestId: string) {
  const response = await requestAdminGraphql<{
    delete_custom_requests_by_pk: { id: string } | null;
  }>(
    `
      mutation DeleteCustomRequest($id: uuid!) {
        delete_custom_requests_by_pk(id: $id) {
          id
        }
      }
    `,
    { id: requestId },
  );

  unwrap(response, "Request was not deleted.");
}
