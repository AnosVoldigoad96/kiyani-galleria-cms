"use client";

import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { requestAdminGraphql } from "@/lib/admin-graphql-client";

type DebugResult = {
  status: "idle" | "loading" | "success" | "error";
  payload: unknown;
};

function decodeJwtPayload(token: string | null | undefined) {
  if (!token) {
    return null;
  }

  try {
    const [, payload] = token.split(".");

    if (!payload) {
      return null;
    }

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(window.atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function CmsDebug() {
  const { appRole, isAuthenticated, roleError, session, user } = useAuth();
  const [schemaCheck, setSchemaCheck] = useState<DebugResult>({
    status: "idle",
    payload: null,
  });
  const [categoriesCheck, setCategoriesCheck] = useState<DebugResult>({
    status: "idle",
    payload: null,
  });

  const jwtPayload = useMemo(
    () => decodeJwtPayload(session?.accessToken),
    [session?.accessToken],
  );

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let active = true;

    const runChecks = async () => {
      setSchemaCheck({ status: "loading", payload: null });
      setCategoriesCheck({ status: "loading", payload: null });

      try {
        const schemaResponse = await requestAdminGraphql("query { __typename }");

        if (!active) {
          return;
        }

        setSchemaCheck({ status: "success", payload: schemaResponse.body });
      } catch (error) {
        if (!active) {
          return;
        }

        setSchemaCheck({
          status: "error",
          payload: error instanceof Error ? error.message : String(error),
        });
      }

      try {
        const categoriesResponse = await requestAdminGraphql(
          "query { categories(limit: 1) { id name } }",
        );

        if (!active) {
          return;
        }

        setCategoriesCheck({ status: "success", payload: categoriesResponse.body });
      } catch (error) {
        if (!active) {
          return;
        }

        setCategoriesCheck({
          status: "error",
          payload: error instanceof Error ? error.message : String(error),
        });
      }
    };

    void runChecks();

    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  return (
    <main className="min-h-screen bg-background p-6 text-[var(--foreground)]">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-[1.75rem] border border-[var(--border)] bg-white p-8 shadow-[0_10px_30px_rgba(34,34,34,0.05)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
            CMS Debug
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Nhost role inspection</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted-foreground)]">
            This page shows the live authenticated session, decoded JWT claims, and direct GraphQL
            probe results for the current role.
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-[1.75rem] border border-[var(--border)] bg-white p-8 shadow-[0_10px_30px_rgba(34,34,34,0.05)]">
            <p className="text-sm font-semibold">Session user</p>
            <pre className="mt-4 overflow-x-auto rounded-2xl bg-black/[0.03] p-4 text-xs leading-6">
              {JSON.stringify(
                {
                  isAuthenticated,
                  id: user?.id ?? null,
                  email: user?.email ?? null,
                  displayName: user?.displayName ?? null,
                  defaultRole: user?.defaultRole ?? null,
                  roles: user?.roles ?? null,
                  appRole,
                  roleError,
                },
                null,
                2,
              )}
            </pre>
          </article>

          <article className="rounded-[1.75rem] border border-[var(--border)] bg-white p-8 shadow-[0_10px_30px_rgba(34,34,34,0.05)]">
            <p className="text-sm font-semibold">Decoded JWT payload</p>
            <pre className="mt-4 overflow-x-auto rounded-2xl bg-black/[0.03] p-4 text-xs leading-6">
              {JSON.stringify(jwtPayload, null, 2)}
            </pre>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-[1.75rem] border border-[var(--border)] bg-white p-8 shadow-[0_10px_30px_rgba(34,34,34,0.05)]">
            <p className="text-sm font-semibold">GraphQL probe: `__typename`</p>
            <p className="mt-2 text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
              {schemaCheck.status}
            </p>
            <pre className="mt-4 overflow-x-auto rounded-2xl bg-black/[0.03] p-4 text-xs leading-6">
              {JSON.stringify(schemaCheck.payload, null, 2)}
            </pre>
          </article>

          <article className="rounded-[1.75rem] border border-[var(--border)] bg-white p-8 shadow-[0_10px_30px_rgba(34,34,34,0.05)]">
            <p className="text-sm font-semibold">GraphQL probe: `categories(limit: 1)`</p>
            <p className="mt-2 text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
              {categoriesCheck.status}
            </p>
            <pre className="mt-4 overflow-x-auto rounded-2xl bg-black/[0.03] p-4 text-xs leading-6">
              {JSON.stringify(categoriesCheck.payload, null, 2)}
            </pre>
          </article>
        </section>
      </div>
    </main>
  );
}
