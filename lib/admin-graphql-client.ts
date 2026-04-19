"use client";

import { nhost, nhostConfigError } from "@/lib/nhost";

export type GraphqlResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

export async function getAccessToken() {
  if (!nhost) {
    throw new Error(nhostConfigError ?? "Nhost is not configured.");
  }

  // Fast path: use the current session if the token has >60s left
  const currentSession = nhost.getUserSession();
  if (currentSession?.accessToken) {
    const expiresIn = currentSession.accessTokenExpiresIn;
    if (expiresIn && expiresIn > 60) {
      return currentSession.accessToken;
    }
  }

  // Only refresh when token is expiring soon or missing
  const refreshedSession = await nhost.refreshSession(60).catch(() => null);
  const session = refreshedSession ?? currentSession;
  const accessToken = session?.accessToken;

  if (!accessToken) {
    throw new Error("You must be signed in to access the admin API.");
  }

  return accessToken;
}

/**
 * Send a GraphQL request directly to Hasura using the Nhost JWT.
 *
 * Hasura validates the JWT and enforces table permissions based on the
 * user's role in the profiles table (via _exists permission filters).
 * No proxy or admin secret needed.
 */
export async function requestAdminGraphql<T>(
  query: string,
  variables?: Record<string, unknown>,
) {
  if (!nhost) {
    throw new Error(nhostConfigError ?? "Nhost is not configured.");
  }

  // Ensure a fresh token before the request
  const currentSession = nhost.getUserSession();
  const expiresIn = currentSession?.accessTokenExpiresIn ?? 0;
  if (expiresIn <= 60) {
    await nhost.refreshSession(60).catch(() => null);
  }

  const response = await nhost.graphql.request<GraphqlResponse<T>>({
    query,
    variables,
  });

  const body = (response.body ?? response) as GraphqlResponse<T>;
  return { body, status: 200 };
}
