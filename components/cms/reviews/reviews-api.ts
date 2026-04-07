"use client";

import { requestAdminGraphql } from "@/lib/admin-graphql-client";

export type ReviewStatus = "pending" | "published" | "flagged";

export type ReviewPayload = {
  customer_name?: string;
  rating?: number;
  comment?: string;
  status?: ReviewStatus;
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

export async function updateReview(reviewId: string, payload: ReviewPayload) {
  const response = await requestAdminGraphql<{
    update_reviews_by_pk: { id: string } | null;
  }>(
    `
      mutation UpdateReview($id: uuid!, $set: reviews_set_input!) {
        update_reviews_by_pk(pk_columns: { id: $id }, _set: $set) {
          id
        }
      }
    `,
    { id: reviewId, set: payload },
  );

  unwrap(response, "Review was not updated.");
}

export async function saveReviewReply(reviewId: string, reply: string) {
  const response = await requestAdminGraphql<{
    insert_review_replies_one: { id: string } | null;
  }>(
    `
      mutation UpsertReviewReply($object: review_replies_insert_input!) {
        insert_review_replies_one(
          object: $object
          on_conflict: {
            constraint: review_replies_review_id_key
            update_columns: [reply]
          }
        ) {
          id
        }
      }
    `,
    {
      object: {
        review_id: reviewId,
        reply,
      },
    },
  );

  unwrap(response, "Review reply was not saved.");
}

export async function deleteReviewReply(reviewId: string) {
  const response = await requestAdminGraphql<{
    delete_review_replies: { affected_rows: number };
  }>(
    `
      mutation DeleteReviewReply($reviewId: uuid!) {
        delete_review_replies(where: { review_id: { _eq: $reviewId } }) {
          affected_rows
        }
      }
    `,
    { reviewId },
  );

  unwrap(response, "Review reply was not deleted.");
}

export async function deleteReview(reviewId: string) {
  await deleteReviewReply(reviewId);

  const response = await requestAdminGraphql<{
    delete_reviews_by_pk: { id: string } | null;
  }>(
    `
      mutation DeleteReview($id: uuid!) {
        delete_reviews_by_pk(id: $id) {
          id
        }
      }
    `,
    { id: reviewId },
  );

  unwrap(response, "Review was not deleted.");
}
