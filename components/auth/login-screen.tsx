"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";
import { LockKeyhole, Mail } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";

export function LoginScreen({ redirectTo = "/cms" }: { redirectTo?: string }) {
  const router = useRouter();
  const { configError, error, isAuthenticated, isLoading, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(redirectTo);
    }
  }, [isAuthenticated, isLoading, redirectTo, router]);

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-[var(--foreground)] sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[2rem] border border-[var(--border)] bg-white p-8 shadow-[0_10px_30px_rgba(34,34,34,0.05)] sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--muted-foreground)]">
            Kiyani Studio
          </p>
          <h1 className="mt-5 font-serif text-5xl leading-none sm:text-6xl">
            Sign in to the CMS.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-[var(--muted-foreground)]">
            Manage products, orders, requests, reviews, and brand settings from a
            dedicated admin space built for the studio team.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              "Catalog and merchandising",
              "Order and request tracking",
              "Reviews and brand controls",
            ].map((item) => (
              <div
                key={item}
                className="rounded-[1.35rem] border border-[var(--border)] bg-[var(--muted)] px-4 py-4 text-sm font-medium text-[var(--foreground)]"
              >
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-[var(--border)] bg-white p-8 shadow-[0_10px_30px_rgba(34,34,34,0.05)] sm:p-10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">Admin login</p>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Use your internal account to continue.
              </p>
            </div>
            <span className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-[var(--primary)]">
              Studio only
            </span>
          </div>

          <form
            className="mt-8 space-y-5"
            onSubmit={async (event) => {
              event.preventDefault();
              setFormError(null);

              const result = await login(email, password);

              if (result.error) {
                setFormError(result.error);
                return;
              }

              router.replace(redirectTo);
            }}
          >
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">
                Email
              </span>
              <span className="flex h-12 items-center gap-3 rounded-[1rem] border border-[var(--border)] bg-[var(--muted)] px-4">
                <Mail className="size-4 text-[var(--muted-foreground)]" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@kiyani.studio"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--muted-foreground)]"
                  required
                />
              </span>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">
                Password
              </span>
              <span className="flex h-12 items-center gap-3 rounded-[1rem] border border-[var(--border)] bg-[var(--muted)] px-4">
                <LockKeyhole className="size-4 text-[var(--muted-foreground)]" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--muted-foreground)]"
                  required
                />
              </span>
            </label>

            <Button
              type="submit"
              disabled={isLoading}
              className="h-12 w-full rounded-full bg-[var(--foreground)] text-white hover:bg-black"
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>

            {configError ? (
              <p className="text-sm leading-6 text-rose-600">{configError}</p>
            ) : null}

            {formError || error ? (
              <p className="text-sm leading-6 text-rose-600">
                {formError ?? error}
              </p>
            ) : null}
          </form>

          <p className="mt-6 text-sm text-[var(--muted-foreground)]">
            Access is limited to approved internal accounts.
          </p>
        </section>
      </div>
    </main>
  );
}
