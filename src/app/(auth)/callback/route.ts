import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Exchanges Supabase OAuth/email confirmation code for a session cookie.
 */
export const GET = async (request: NextRequest) => {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";

  try {
    const supabase = await createSupabaseServerClient();

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error("Callback exchange failed", error);
        return NextResponse.redirect(new URL("/login?error=callback_failed", request.url));
      }
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL("/login?error=auth_required", request.url));
    }

    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const safeNext = next.startsWith("/") ? next : "/dashboard";

    if (!membership) {
      return NextResponse.redirect(new URL("/create-org", request.url));
    }

    return NextResponse.redirect(new URL(safeNext, request.url));
  } catch (error) {
    console.error("Auth callback error", error);
    return NextResponse.redirect(new URL("/login?error=unexpected_callback_error", request.url));
  }
};
