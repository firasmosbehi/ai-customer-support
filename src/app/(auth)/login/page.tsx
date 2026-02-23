import { LoginForm } from "@/components/auth/LoginForm";

const decodeMessage = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }

  return value.replace(/\+/g, " ");
};

const resolveLoginErrorMessage = (error: string | undefined, message: string | undefined): string | undefined => {
  if (message && message.trim().length > 0) {
    return decodeMessage(message);
  }

  if (error === "oauth_failed") {
    return "Google sign-in failed. Please try again.";
  }

  if (error === "callback_failed") {
    return "Sign-in callback failed. Please try again.";
  }

  if (error === "auth_required") {
    return "Please sign in to continue.";
  }

  if (error === "unexpected_callback_error") {
    return "Unexpected authentication error. Please try again.";
  }

  return undefined;
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string; message?: string };
}) {
  const nextPath = searchParams.next?.startsWith("/") ? searchParams.next : "/dashboard";
  const initialError = resolveLoginErrorMessage(searchParams.error, searchParams.message);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <LoginForm nextPath={nextPath} initialError={initialError} />
    </main>
  );
}
