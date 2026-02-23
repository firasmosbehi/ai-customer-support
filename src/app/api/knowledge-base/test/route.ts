import { NextResponse } from "next/server";
import { z } from "zod";
import { retrieveRelevantChunks } from "@/lib/ai/rag";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  question: z.string().min(3).max(1000),
  threshold: z.number().min(0).max(1).optional(),
  limit: z.number().min(1).max(20).optional(),
});

/**
 * Tests retrieval quality by returning top matching chunks for a question.
 */
export const POST = async (request: Request) => {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const membershipResult = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (membershipResult.error) {
      console.error("Failed to resolve org membership", membershipResult.error);
      return NextResponse.json({ error: "Failed to load organization", code: "ORG_LOOKUP_FAILED" }, { status: 500 });
    }

    if (!membershipResult.data) {
      return NextResponse.json({ error: "Organization membership required", code: "ORG_REQUIRED" }, { status: 403 });
    }

    const rawBody = await request.json().catch(() => null);
    const parsed = requestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const chunks = await retrieveRelevantChunks(supabase, {
      orgId: membershipResult.data.org_id,
      query: parsed.data.question,
      matchThreshold: parsed.data.threshold,
      matchCount: parsed.data.limit,
    });

    return NextResponse.json(
      {
        data: {
          question: parsed.data.question,
          matches: chunks,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Knowledge-base test route failed", error);
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
};
