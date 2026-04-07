import { AuthGuard } from "@/components/auth/auth-guard";

export default function CmsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGuard requireCmsAccess>{children}</AuthGuard>;
}
