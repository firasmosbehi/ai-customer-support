import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  buildCorsHeaders,
  buildPublicWidgetConfig,
  isRemoteSupabaseConfigured,
  isOriginAllowed,
  resolveOrganizationByIdentifier,
  resolveWidgetConfigForOrganization,
} from "@/lib/widget";

/**
 * Returns public widget configuration for a given organization id/slug.
 */
export const GET = async (
  request: NextRequest,
  context: { params: { orgId: string } }
) => {
  const origin = request.headers.get("origin");

  try {
    if (!isRemoteSupabaseConfigured()) {
      return NextResponse.json(
        { error: "Supabase is not configured for production", code: "BACKEND_NOT_CONFIGURED" },
        { status: 503, headers: buildCorsHeaders(origin, false) }
      );
    }

    const supabase = createSupabaseAdminClient();
    const organization = await resolveOrganizationByIdentifier(supabase, context.params.orgId);

    if (!organization) {
      return NextResponse.json({ error: "Organization not found", code: "ORG_NOT_FOUND" }, { status: 404 });
    }

    const widgetConfigRecord = await resolveWidgetConfigForOrganization(supabase, organization.id);
    const widgetConfig = buildPublicWidgetConfig(organization, widgetConfigRecord);

    if (!widgetConfig.isActive) {
      return NextResponse.json({ error: "Widget is inactive", code: "WIDGET_INACTIVE" }, { status: 403 });
    }

    const originAllowed = isOriginAllowed(origin, widgetConfig.allowedDomains);

    if (origin && !originAllowed) {
      return NextResponse.json(
        { error: "Origin is not allowed", code: "DOMAIN_NOT_ALLOWED" },
        { status: 403, headers: buildCorsHeaders(origin, false) }
      );
    }

    return NextResponse.json(
      {
        data: {
          org_id: widgetConfig.orgId,
          display_name: widgetConfig.displayName,
          welcome_message: widgetConfig.welcomeMessage,
          primary_color: widgetConfig.primaryColor,
          position: widgetConfig.position,
          avatar_url: widgetConfig.avatarUrl,
          powered_by: widgetConfig.poweredBy,
        },
      },
      {
        status: 200,
        headers: {
          ...buildCorsHeaders(origin, true),
          "Cache-Control": "public, max-age=60",
        },
      }
    );
  } catch (error) {
    console.error("Widget config route failed", error);
    return NextResponse.json(
      { error: "Backend service unavailable", code: "BACKEND_UNAVAILABLE" },
      { status: 503, headers: buildCorsHeaders(origin, false) }
    );
  }
};

/**
 * Handles browser preflight requests for widget config fetches.
 */
export const OPTIONS = async (request: NextRequest) => {
  const origin = request.headers.get("origin");

  if (!origin) {
    return new NextResponse(null, { status: 204 });
  }

  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(origin, true),
  });
};
