"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Chrome } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface LoginFormProps {
  nextPath: string;
}

/**
 * Handles email/password and Google OAuth sign-in flows.
 */
export const LoginForm = ({ nextPath }: LoginFormProps) => {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (formData: FormData) => {
    setIsSubmitting(true);
    setError(null);

    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const supabase = createSupabaseBrowserClient();

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setIsSubmitting(false);
      return;
    }

    router.push(nextPath);
    router.refresh();
  };

  const onGoogleSignIn = async () => {
    setIsSubmitting(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/callback?next=${encodeURIComponent(nextPath)}`;
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (oauthError) {
      setError(oauthError.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">Sign in</h1>
      <p className="mt-1 text-sm text-slate-600">Access your support dashboard.</p>

      <form action={onSubmit} className="mt-6 space-y-4">
        <label className="block text-sm font-medium text-slate-700" htmlFor="email">
          Email
        </label>
        <input
          required
          id="email"
          name="email"
          type="email"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-offset-2 focus:border-slate-400 focus:ring-2"
        />

        <label className="block text-sm font-medium text-slate-700" htmlFor="password">
          Password
        </label>
        <input
          required
          id="password"
          name="password"
          type="password"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-offset-2 focus:border-slate-400 focus:ring-2"
        />

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        <Button disabled={isSubmitting} type="submit" className="w-full">
          {isSubmitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <div className="my-4 h-px w-full bg-slate-200" />

      <Button disabled={isSubmitting} onClick={onGoogleSignIn} variant="outline" className="w-full gap-2" type="button">
        <Chrome className="h-4 w-4" />
        Continue with Google
      </Button>

      <p className="mt-4 text-sm text-slate-600">
        Need an account? <a className="text-slate-900 underline" href="/signup">Sign up</a>
      </p>
    </div>
  );
};
