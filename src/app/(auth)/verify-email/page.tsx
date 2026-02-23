import { ResendConfirmationForm } from "@/components/auth/ResendConfirmationForm";

interface VerifyEmailPageProps {
  searchParams?: {
    email?: string;
    error?: string;
    message?: string;
  };
}

const formatEmail = (value: string | undefined): string | null => {
  if (!value) {
    return null;
  }

  const email = value.trim();
  return email.length > 0 ? email : null;
};

const resolveErrorCopy = (errorCode: string | undefined, rawMessage: string | undefined): string | null => {
  if (errorCode === "otp_expired") {
    return "Your confirmation link has expired. Request a new one below.";
  }

  if (errorCode === "access_denied") {
    return "That confirmation link is invalid. Request a new one below.";
  }

  if (rawMessage) {
    return rawMessage.replace(/\+/g, " ");
  }

  return null;
};

/**
 * Displays post-signup instructions to verify the user's email address.
 */
export default function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const email = formatEmail(searchParams?.email);
  const errorCopy = resolveErrorCopy(searchParams?.error, searchParams?.message);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Validate your email</h1>
        {errorCopy ? <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{errorCopy}</p> : null}
        <p className="mt-2 text-sm text-slate-600">
          We sent a confirmation link{email ? ` to ${email}` : ""}. Open your inbox and click the link to continue.
        </p>
        <p className="mt-3 text-sm text-slate-600">
          The subject line is <span className="font-medium text-slate-900">Confirm your signup</span>. If you do not see it, check spam or promotions.
        </p>

        <ResendConfirmationForm initialEmail={email} />

        <div className="mt-6 flex gap-3">
          <a
            className="inline-flex h-10 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
            href="/login"
          >
            Go to sign in
          </a>
          <a
            className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            href="/signup"
          >
            Back to sign up
          </a>
        </div>
      </section>
    </main>
  );
}
