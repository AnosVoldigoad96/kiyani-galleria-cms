"use client";

import { useEffect } from "react";

import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";

export function AuthGuard({
  children,
  requireCmsAccess = false,
}: {
  children: React.ReactNode;
  requireCmsAccess?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { appRole, configError, hasCmsAccess, isAuthenticated, isLoading, logout, roleError } =
    useAuth();
  const shouldRequireCmsAccess = requireCmsAccess && pathname !== "/cms/debug";

  useEffect(() => {
    if (isLoading || configError) {
      return;
    }

    if (!isAuthenticated) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [configError, isAuthenticated, isLoading, pathname, router]);

  if (configError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-xl rounded-[1.75rem] border border-[var(--border)] bg-white p-8 text-[var(--foreground)] shadow-[0_10px_30px_rgba(34,34,34,0.05)]">
          <p className="text-sm font-semibold">Nhost configuration required</p>
          <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
            {configError}
          </p>
        </div>
      </main>
    );
  }

  if (isLoading || !isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
      </main>
    );
  }

  if (shouldRequireCmsAccess && !hasCmsAccess) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-xl rounded-[1.75rem] border border-[var(--border)] bg-white p-8 text-[var(--foreground)] shadow-[0_10px_30px_rgba(34,34,34,0.05)]">
          <p className="text-sm font-semibold">CMS access denied</p>
          <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
            Your profile role is {appRole ?? "not set"}. The CMS requires `admin` or `manager`.
          </p>
          {roleError ? (
            <pre className="mt-4 overflow-x-auto rounded-2xl bg-black/[0.03] p-4 text-xs leading-6 text-[var(--foreground)]">
              {roleError}
            </pre>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              className="rounded-full bg-[var(--foreground)] px-5 text-white hover:bg-black"
              onClick={async () => {
                await logout();
                router.replace("/login");
              }}
            >
              Log out
            </Button>
            <Button
              variant="outline"
              className="rounded-full px-5"
              onClick={() => {
                router.push("/cms/debug");
              }}
            >
              Open debug
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
