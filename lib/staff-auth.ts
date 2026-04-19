/**
 * Auth utilities for server-side API routes that need the admin secret
 * (image upload, storage operations).
 *
 * CMS data mutations no longer go through a proxy — they use JWT auth
 * directly with Hasura. This module is only needed for Nhost Storage
 * operations that require the admin secret.
 */

type JwtPayload = {
  sub?: string;
  exp?: number;
  "https://hasura.io/jwt/claims"?: {
    "x-hasura-user-id"?: string;
  };
};

type CachedRole = {
  role: string;
  expiresAt: number;
};

const ROLE_CACHE_TTL_MS = 10 * 60 * 1000;
const roleCache = new Map<string, CachedRole>();

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const json = Buffer.from(parts[1], "base64url").toString("utf-8");
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// URL resolvers
// ---------------------------------------------------------------------------

export function resolveGraphqlUrl() {
  const explicit = process.env.NEXT_PUBLIC_NHOST_GRAPHQL_URL;
  if (explicit) return explicit;
  const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
  const region = process.env.NEXT_PUBLIC_NHOST_REGION;
  if (!subdomain || !region) throw new Error("Missing Nhost GraphQL configuration.");
  return `https://${subdomain}.graphql.${region}.nhost.run/v1`;
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
// Staff access verification (for upload-image route)
// ---------------------------------------------------------------------------

type ProfileRoleResponse = {
  data?: {
    profiles_by_pk: {
      role: "admin" | "manager" | "customer" | null;
    } | null;
  };
};

/**
 * Verifies the bearer token belongs to an admin or manager.
 * Used only by routes that need the admin secret (e.g., image upload).
 */
export async function requireStaffAccess(
  request: Request,
  adminSecret: string,
): Promise<Response | null> {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return Response.json({ error: "Missing bearer token." }, { status: 401 });
  }

  const token = authorization.slice(7);
  const claims = decodeJwtPayload(token);

  if (!claims) {
    return Response.json({ error: "Invalid token format." }, { status: 401 });
  }

  if (claims.exp && claims.exp * 1000 < Date.now()) {
    return Response.json({ error: "Token has expired." }, { status: 401 });
  }

  const userId =
    claims["https://hasura.io/jwt/claims"]?.["x-hasura-user-id"] ??
    claims.sub ??
    null;

  if (!userId) {
    return Response.json({ error: "Token does not contain a user ID." }, { status: 401 });
  }

  // Check role cache
  const now = Date.now();
  const cached = roleCache.get(userId);
  if (cached && cached.expiresAt > now) {
    if (cached.role !== "admin" && cached.role !== "manager") {
      return Response.json({ error: "Admin access is required." }, { status: 403 });
    }
    return null;
  }

  // Cache miss — fetch role
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
    return Response.json({ error: "Admin access is required." }, { status: 403 });
  }

  roleCache.set(userId, { role, expiresAt: now + ROLE_CACHE_TTL_MS });
  return null;
}
