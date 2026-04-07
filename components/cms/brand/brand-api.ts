"use client";

import { requestAdminGraphql } from "@/lib/admin-graphql-client";

type BrandSettingPayload = {
  key: string;
  value: Record<string, unknown>;
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

export async function upsertBrandSetting(setting: BrandSettingPayload) {
  const response = await requestAdminGraphql<{
    insert_brand_settings_one: { key: string } | null;
  }>(
    `
      mutation UpsertBrandSetting($object: brand_settings_insert_input!) {
        insert_brand_settings_one(
          object: $object
          on_conflict: {
            constraint: brand_settings_pkey
            update_columns: [value]
          }
        ) {
          key
        }
      }
    `,
    { object: setting },
  );

  unwrap(response, "Brand setting was not saved.");
}

export async function upsertBrandSettingsBatch(settings: BrandSettingPayload[]) {
  for (const setting of settings) {
    await upsertBrandSetting(setting);
  }
}
