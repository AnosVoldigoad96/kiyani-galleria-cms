/**
 * Shared staff authentication with short-lived in-memory cache.
 *
 * Every admin API route previously verified the bearer token with 2 sequential
 * fetches to Nhost (auth + role check) on every single request.  This module
 * caches successful verifications for up to 4 minutes so subsequent mutations
 * in the same session skip the round-trips.
 */

type CachedAuth = {
  userId: string;
  role: string;
  expiresAt: number;
};

const AUTH_CACHE_TTL_MS = 4 * 60 * 1000; // 4 minutes

const authCache = new Map<string, CachedAuth>();

function evictExpired() {
  const now = Date.now();
  for (const [key, entry] of authCache) {
    if (entry.expiresAt <= now) {
      authCache.delete(key);
    }
  }
}

// ---------------------------------------------------------------------------
// URL resolvers (shared between hasura-admin & upload-image routes)
// ---------------------------------------------------------------------------

export function resolveGraphqlUrl() {
  const explicit = process.env.NEXT_PUBLIC_NHOST_GRAPHQL_URL;
  if (explicit) return explicit;
  const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
  const region = process.env.NEXT_PUBLIC_NHOST_REGION;
  if (!subdomain || !region) throw new Error("Missing Nhost GraphQL configuration.");
  return `https://${subdomain}.graphql.${region}.nhost.run/v1`;
}

export function resolveAuthUrl() {
  const explicit = process.env.NEXT_PUBLIC_NHOST_AUTH_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
  const region = process.env.NEXT_PUBLIC_NHOST_REGION;
  if (!subdomain || !region) throw new Error("Missing Nhost Auth configuration.");
  return `https://${subdomain}.auth.${region}.nhost.run/v1`;
}

export function resolveStorageUrl() {
  const explicit = process.env.NEXT_PUBLIC_NHOST_STORAGE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
  const region = process.env.NEXT_PUBLIC_NHOST_REGION;
  if (!subdomain || !region) throw new Error("Missing Nhost Storage configuration.");
  return `https://${subdomain}.storage.${region}.nhost.run/v1`;
}

// ---------------------------------------------------------------------------
// Staff access verification (with cache)
// ---------------------------------------------------------------------------

type AuthUserResponse = { id: string };

type ProfileRoleResponse = {
  data?: {
    profiles_by_pk: {
      role: "admin" | "manager" | "customer" | null;
    } | null;
  };
  errors?: Array<{ message: string }>;
};

/**
 * Verifies the request bearer token belongs to an admin or manager.
 * Returns `null` on success, or a `Response` error object on failure.
 */
export async function requireStaffAccess(
  request: Request,
  adminSecret: string,
): Promise<Response | null> {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return Response.json(
      { errors: [{ message: "Missing bearer token." }] },
      { status: 401 },
    );
  }

  const token = authorization.slice(7);

  // Check cache first
  evictExpired();
  const cached = authCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return null; // Verified recently — skip network calls
  }

  // Verify token with Nhost Auth
  const authResponse = await fetch(`${resolveAuthUrl()}/user`, {
    headers: { Authorization: authorization },
  });

  if (!authResponse.ok) {
    return Response.json(
      { errors: [{ message: "Authentication failed." }] },
      { status: 401 },
    );
  }

  const user = (await authResponse.json()) as AuthUserResponse;

  if (!user.id) {
    return Response.json(
      { errors: [{ message: "Authenticated user id was not returned." }] },
      { status: 401 },
    );
  }

  // Check role via Hasura
  const roleResponse = await fetch(resolveGraphqlUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hasura-admin-secret": adminSecret,
    },
    body: JSON.stringify({
      query: `query CurrentProfileRole($id: uuid!) { profiles_by_pk(id: $id) { role } }`,
      variables: { id: user.id },
    }),
  });

  const roleBody = (await roleResponse.json()) as ProfileRoleResponse;
  const role = roleBody.data?.profiles_by_pk?.role ?? null;

  if (role !== "admin" && role !== "manager") {
    return Response.json(
      { errors: [{ message: "Admin access is required." }] },
      { status: 403 },
    );
  }

  // Cache successful verification
  authCache.set(token, {
    userId: user.id,
    role,
    expiresAt: Date.now() + AUTH_CACHE_TTL_MS,
  });

  return null;
}
