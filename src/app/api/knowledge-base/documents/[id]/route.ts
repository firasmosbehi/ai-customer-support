import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Deletes a document in the current organization (chunks cascade by FK).
 */
export const DELETE = async (
  _request: Request,
  context: { params: { id: string } }
) => {
  try {
    const parsedParams = paramsSchema.safeParse(context.params);

    if (!parsedParams.success) {
      return NextResponse.json({ error: "Invalid document id", code: "VALIDATION_ERROR" }, { status: 400 });
    }

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

    const orgId = membershipResult.data.org_id;

    const { data: targetDocument, error: lookupError } = await supabase
      .from("documents")
      .select("id")
      .eq("id", parsedParams.data.id)
      .eq("org_id", orgId)
      .maybeSingle();

    if (lookupError) {
      console.error("Failed to lookup document for delete", lookupError);
      return NextResponse.json({ error: "Failed to delete document", code: "DOCUMENT_DELETE_FAILED" }, { status: 500 });
    }

    if (!targetDocument) {
      return NextResponse.json({ error: "Document not found", code: "DOCUMENT_NOT_FOUND" }, { status: 404 });
    }

    const { error: deleteError } = await supabase
      .from("documents")
      .delete()
      .eq("id", parsedParams.data.id)
      .eq("org_id", orgId);

    if (deleteError) {
      console.error("Failed to delete document", deleteError);
      return NextResponse.json({ error: "Failed to delete document", code: "DOCUMENT_DELETE_FAILED" }, { status: 500 });
    }

    return NextResponse.json({ data: { id: parsedParams.data.id } }, { status: 200 });
  } catch (error) {
    console.error("Unhandled document delete route error", error);
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
};
