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

export async function requestAdminGraphql<T>(
  query: string,
  variables?: Record<string, unknown>,
) {
  const accessToken = await getAccessToken();

  const response = await fetch("/api/hasura-admin", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  const body = (await response.json()) as GraphqlResponse<T>;
  return { body, status: response.status };
}
