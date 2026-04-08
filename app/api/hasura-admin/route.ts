export const dynamic = "force-dynamic";

import { requireStaffAccess, resolveGraphqlUrl } from "@/lib/staff-auth";

type GraphqlRequest = {
  query: string;
  variables?: Record<string, unknown>;
};

export async function POST(request: Request) {
  const adminSecret = process.env.HASURA_ADMIN_SECRET;

  if (!adminSecret) {
    return Response.json(
      { errors: [{ message: "HASURA_ADMIN_SECRET is not configured." }] },
      { status: 500 },
    );
  }

  const authError = await requireStaffAccess(request, adminSecret);
  if (authError) {
    return authError;
  }

  let payload: GraphqlRequest;
  try {
    payload = (await request.json()) as GraphqlRequest;
  } catch {
    return Response.json({ errors: [{ message: "Invalid JSON body." }] }, { status: 400 });
  }

  if (!payload.query) {
    return Response.json({ errors: [{ message: "Missing GraphQL query." }] }, { status: 400 });
  }

  const graphqlUrl = resolveGraphqlUrl();

  const response = await fetch(graphqlUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hasura-admin-secret": adminSecret,
    },
    body: JSON.stringify({
      query: payload.query,
      variables: payload.variables ?? {},
    }),
  });

  const data = await response.json();
  return Response.json(data, { status: response.status });
}
