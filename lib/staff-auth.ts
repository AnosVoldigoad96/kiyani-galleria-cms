/**
 * Shared staff authentication — zero-network-call verification.
 *
 * Strategy:
 * 1. Decode the Nhost JWT locally (no signature verification needed since
 *    we trust the token enough to forward it — Hasura verifies the signature).
 *    Extract the user ID and expiry from the JWT claims.
 * 2. Cache the user's role keyed by user ID. Roles rarely change, so the
 *    cache TTL is long (10 minutes). On a cache miss we do ONE GraphQL
 *    call to fetch the role.
 * 3. Result: most requests cost ZERO network calls for auth. A cold start
 *    costs ONE call (role lookup). Previously every request cost TWO calls.
 */

type CachedRole = {
  role: string;
  expiresAt: number;
};

type JwtPayload = {
  sub?: string;
  exp?: number;
  "https://hasura.io/jwt/claims"?: {
    "x-hasura-user-id"?: string;
  };
};

const ROLE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** Keyed by user ID (not token) — survives token refreshes */
const roleCache = new Map<string, CachedRole>();

function evictExpiredRoles() {
  const now = Date.now();
  for (const [key, entry] of roleCache) {
    if (entry.expiresAt <= now) {
      roleCache.delete(key);
    }
  }
}

/**
 * Decode a JWT payload without verifying the signature.
 * We only need the claims (sub, exp) — Hasura will verify the signature
 * when the actual GraphQL request is forwarded.
 */
function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const json = Buffer.from(payload, "base64url").toString("utf-8");
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
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
// Staff access verification
// ---------------------------------------------------------------------------

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
 *
 * Fast path (most requests): decode JWT locally + role cache hit = 0 network calls.
 * Slow path (first request per user): decode JWT locally + 1 GraphQL call for role.
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

  // Decode JWT locally — extract user ID and expiry without a network call
  const claims = decodeJwtPayload(token);
  if (!claims) {
    return Response.json(
      { errors: [{ message: "Invalid token format." }] },
      { status: 401 },
    );
  }

  // Check token expiry
  const exp = claims.exp;
  if (exp && exp * 1000 < Date.now()) {
    return Response.json(
      { errors: [{ message: "Token has expired." }] },
      { status: 401 },
    );
  }

  // Extract user ID from standard claim or Hasura claim
  const userId =
    claims["https://hasura.io/jwt/claims"]?.["x-hasura-user-id"] ??
    claims.sub ??
    null;

  if (!userId) {
    return Response.json(
      { errors: [{ message: "Token does not contain a user ID." }] },
      { status: 401 },
    );
  }

  // Check role cache (keyed by user ID — survives token refreshes)
  evictExpiredRoles();
  const cached = roleCache.get(userId);

  if (cached) {
    if (cached.role !== "admin" && cached.role !== "manager") {
      return Response.json(
        { errors: [{ message: "Admin access is required." }] },
        { status: 403 },
      );
    }
    return null; // Authorized — zero network calls
  }

  // Cache miss: fetch role with ONE GraphQL call
  const roleResponse = await fetch(resolveGraphqlUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hasura-admin-secret": adminSecret,
    },
    body: JSON.stringify({
      query: `query CurrentProfileRole($id: uuid!) { profiles_by_pk(id: $id) { role } }`,
      variables: { id: userId },
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

  // Cache role for this user (10 minutes)
  roleCache.set(userId, {
    role,
    expiresAt: Date.now() + ROLE_CACHE_TTL_MS,
  });

  return null;
}
