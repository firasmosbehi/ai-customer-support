import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthHashErrorRedirect } from "@/components/auth/AuthHashErrorRedirect";
import { isEmailConfirmationLinkError } from "@/lib/authErrors";

const getParam = (value: string | string[] | undefined): string | undefined => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

interface HomePageProps {
  searchParams?: {
    error?: string | string[];
    error_code?: string | string[];
    error_description?: string | string[];
  };
}

export default function HomePage({ searchParams }: HomePageProps) {
  const authError = getParam(searchParams?.error);
  const authErrorCode = getParam(searchParams?.error_code);
  const authErrorDescription = getParam(searchParams?.error_description);

  if (authError) {
    const effectiveErrorCode = authErrorCode ?? authError;
    const isEmailError = isEmailConfirmationLinkError(effectiveErrorCode, authErrorDescription);
    const params = new URLSearchParams();
    params.set("error", effectiveErrorCode);

    if (authErrorDescription) {
      params.set("message", authErrorDescription);
    }

    if (isEmailError) {
      redirect(`/verify-email?${params.toString()}`);
    }

    redirect(`/login?${params.toString()}`);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-start justify-center px-6 py-20">
      <AuthHashErrorRedirect />
      <p className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
        Phase 1 Foundation
      </p>
      <h1 className="mt-5 text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl">
        AI support automation for modern businesses.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-slate-600">
        Upload your docs, deploy a branded chat widget, and monitor support outcomes from one dashboard.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/signup"
          className="rounded-md bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
