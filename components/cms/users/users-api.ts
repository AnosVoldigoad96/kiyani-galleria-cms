"use client";

import { requestAdminGraphql } from "@/lib/admin-graphql-client";

export type UserRole = "admin" | "manager" | "customer";

export type UserPayload = {
  full_name?: string | null;
  email?: string | null;
  role?: UserRole;
  status?: string;
};

type Envelope<T> = {
  body: {
    data?: T;
    errors?: Array<{ message: string }>;
  };
};

function unwrap<T>(response: Envelope<T>, message: string) {
  if (response.body.errors?.length) {
    throw new Error(response.body.errors.map((item) => item.message).join(", "));
  }
  if (!response.body.data) {
    throw new Error(message);
  }
  return response.body.data;
}

export async function updateUserProfile(profileId: string, payload: UserPayload) {
  const response = await requestAdminGraphql<{
    update_profiles_by_pk: { id: string } | null;
  }>(
    `
      mutation UpdateProfile($id: uuid!, $set: profiles_set_input!) {
        update_profiles_by_pk(pk_columns: { id: $id }, _set: $set) {
          id
        }
      }
    `,
    { id: profileId, set: payload },
  );

  unwrap(response, "User profile was not updated.");
}
