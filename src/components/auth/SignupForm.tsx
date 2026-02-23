"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Chrome } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Handles account registration with email/password or Google OAuth.
 */
export const SignupForm = () => {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (formData: FormData) => {
    setIsSubmitting(true);
    setError(null);

    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const fullName = String(formData.get("full_name") ?? "").trim();
    const supabase = createSupabaseBrowserClient();

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/callback?next=/create-org`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setIsSubmitting(false);
      return;
    }

    if (data.session) {
      router.push("/create-org");
      router.refresh();
      return;
    }

    router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    router.refresh();
  };

  const onGoogleSignIn = async () => {
    setIsSubmitting(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/callback?next=/create-org`,
      },
    });

    if (oauthError) {
      setError(oauthError.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">Create your account</h1>
      <p className="mt-1 text-sm text-slate-600">Launch your AI support workspace.</p>

      <form action={onSubmit} className="mt-6 space-y-4">
        <label className="block text-sm font-medium text-slate-700" htmlFor="full_name">
          Full name
        </label>
        <input
          required
          id="full_name"
          name="full_name"
          type="text"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-offset-2 focus:border-slate-400 focus:ring-2"
        />

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
          minLength={8}
          type="password"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-offset-2 focus:border-slate-400 focus:ring-2"
        />

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        <Button disabled={isSubmitting} type="submit" className="w-full">
          {isSubmitting ? "Creating account..." : "Sign up"}
        </Button>
      </form>

      <div className="my-4 h-px w-full bg-slate-200" />

      <Button disabled={isSubmitting} onClick={onGoogleSignIn} variant="outline" className="w-full gap-2" type="button">
        <Chrome className="h-4 w-4" />
        Continue with Google
      </Button>

      <p className="mt-4 text-sm text-slate-600">
        Already have an account? <a className="text-slate-900 underline" href="/login">Sign in</a>
      </p>
    </div>
  );
};
