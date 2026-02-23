"use client";

import { FormEvent, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface ResendConfirmationFormProps {
  initialEmail?: string | null;
}

const getAuthRedirectUrl = (): string => {
  if (typeof window === "undefined") {
    return "/callback?next=/create-org";
  }

  return `${window.location.origin}/callback?next=/create-org`;
};

/**
 * Lets users request a new confirmation email when their original link expires.
 */
export const ResendConfirmationForm = ({ initialEmail }: ResendConfirmationFormProps) => {
  const [email, setEmail] = useState(initialEmail ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const trimmedEmail = useMemo(() => email.trim(), [email]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!trimmedEmail) {
      setError("Please enter your email address.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: trimmedEmail,
        options: {
          emailRedirectTo: getAuthRedirectUrl(),
        },
      });

      if (resendError) {
        setError(resendError.message);
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage("A new confirmation email has been sent. Please check your inbox.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-3">
      <label className="block text-sm font-medium text-slate-700" htmlFor="resend_email">
        Email address
      </label>
      <input
        id="resend_email"
        name="resend_email"
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-offset-2 focus:border-slate-400 focus:ring-2"
      />

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Sending..." : "Resend confirmation email"}
      </Button>
    </form>
  );
};
