import { LoginScreen } from "@/components/auth/login-screen";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = await searchParams;
  const redirectTo =
    params.redirect && params.redirect.startsWith("/") ? params.redirect : "/cms";

  return <LoginScreen redirectTo={redirectTo} />;
}
