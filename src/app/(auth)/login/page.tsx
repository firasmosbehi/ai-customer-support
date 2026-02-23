import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const nextPath = searchParams.next?.startsWith("/") ? searchParams.next : "/dashboard";

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <LoginForm nextPath={nextPath} />
    </main>
  );
}
