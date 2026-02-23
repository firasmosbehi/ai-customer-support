import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Clears auth session and redirects the user to login.
 */
export const POST = async (request: NextRequest) => {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();

    return NextResponse.redirect(new URL("/login", request.url));
  } catch (error) {
    console.error("Sign out failed", error);
    return NextResponse.json({ error: "Failed to sign out", code: "SIGN_OUT_FAILED" }, { status: 500 });
  }
};
