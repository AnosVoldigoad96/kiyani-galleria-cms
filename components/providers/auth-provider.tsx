"use client";

import { createContext, useContext, useEffect, useState } from "react";

import type { NhostClient } from "@nhost/nhost-js";

import { nhost, nhostConfigError } from "@/lib/nhost";

type NhostSession = NonNullable<ReturnType<NhostClient["getUserSession"]>>;
type AuthUser = NhostSession["user"];
type AppRole = "admin" | "manager" | "customer";

type AuthContextValue = {
  user: AuthUser | null;
  session: NhostSession | null;
  appRole: AppRole | null;
  roleError: string | null;
  hasCmsAccess: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  configError: string | null;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type RoleQueryResponse = {
  data?: {
    profiles_by_pk: { role: AppRole | null } | null;
  };
  errors?: Array<{ message: string }>;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<NhostSession | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [appRole, setAppRole] = useState<AppRole | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRoleLoading, setIsRoleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Session initialization
  useEffect(() => {
    if (!nhost) {
      setIsLoading(false);
      return;
    }

    const currentSession = nhost.getUserSession();
    setSession(currentSession);
    setUser(currentSession?.user ?? null);

    const unsubscribe = nhost.sessionStorage.onChange((nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setIsLoading(false);
    });

    void nhost
      .refreshSession(60)
      .then((nextSession) => {
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
      })
      .finally(() => {
        setIsLoading(false);
      });

    return unsubscribe;
  }, []);

  // Role lookup — query directly via Nhost SDK (JWT auth, no proxy)
  useEffect(() => {
    if (!nhost) return;

    if (!session?.user?.id) {
      setAppRole(null);
      setRoleError(null);
      return;
    }

    const userId = session.user.id;
    let active = true;

    setIsRoleLoading(true);

    void (async () => {
      try {
        // Ensure fresh token
        await nhost.refreshSession(60).catch(() => null);

        // Query the user's own profile role directly via Hasura JWT auth
        const response = await nhost.graphql.request<RoleQueryResponse>({
          query: `query MyRole($id: uuid!) { profiles_by_pk(id: $id) { role } }`,
          variables: { id: userId },
        });

        if (!active) return;

        const body = (response.body ?? response) as RoleQueryResponse;

        if (body.errors?.length) {
          setAppRole(null);
          setRoleError(body.errors.map((e) => e.message).join(", "));
          return;
        }

        const role = body.data?.profiles_by_pk?.role ?? null;
        setAppRole(role);
        setRoleError(null);
      } catch (caughtError) {
        if (!active) return;
        setAppRole(null);
        setRoleError(
          caughtError instanceof Error ? caughtError.message : "Failed to load profile role.",
        );
      } finally {
        if (active) setIsRoleLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  const login = async (email: string, password: string) => {
    if (!nhost) {
      const message = nhostConfigError ?? "Nhost is not configured.";
      setError(message);
      return { error: message };
    }

    setError(null);

    try {
      const response = await nhost.auth.signInEmailPassword({ email, password });

      if (!response.body.session) {
        const message =
          "Sign-in requires additional verification or did not return a session.";
        setError(message);
        return { error: message };
      }

      const nextSession = nhost.getUserSession();
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setRoleError(null);
      return { error: null };
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Sign in failed.";
      setError(message);
      return { error: message };
    }
  };

  const logout = async () => {
    if (!nhost) {
      return;
    }

    const currentSession = nhost.getUserSession();

    try {
      if (currentSession?.refreshTokenId) {
        await nhost.auth.signOut({ refreshToken: currentSession.refreshTokenId });
      }
    } finally {
      nhost.clearSession();
      setSession(null);
      setUser(null);
      setAppRole(null);
      setRoleError(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        appRole,
        roleError,
        hasCmsAccess: appRole === "admin" || appRole === "manager",
        isAuthenticated: Boolean(session?.accessToken),
        isLoading: isLoading || isRoleLoading,
        error,
        configError: nhostConfigError,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}
