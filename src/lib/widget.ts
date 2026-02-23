import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

const uuidSchema = z.string().uuid();

export type OrganizationPlan = "free" | "starter" | "pro" | "enterprise";
export type WidgetPosition = "bottom-right" | "bottom-left";

export interface OrganizationProfile {
  id: string;
  slug: string;
  name: string;
  plan: OrganizationPlan;
  settings: Record<string, unknown>;
}

export interface WidgetConfigRecord {
  org_id: string;
  display_name: string | null;
  welcome_message: string | null;
  primary_color: string | null;
  position: WidgetPosition | null;
  avatar_url: string | null;
  is_active: boolean | null;
  allowed_domains: string[] | null;
}

export interface PublicWidgetConfig {
  orgId: string;
  displayName: string;
  welcomeMessage: string;
  primaryColor: string;
  position: WidgetPosition;
  avatarUrl: string | null;
  isActive: boolean;
  allowedDomains: string[];
  poweredBy: boolean;
}

const cleanAllowedDomains = (allowedDomains: string[] | null | undefined): string[] => {
  if (!Array.isArray(allowedDomains)) {
    return [];
  }

  return allowedDomains
    .filter((domain): domain is string => typeof domain === "string")
    .map((domain) => domain.trim())
    .filter((domain) => domain.length > 0);
};

const parseHostFromAllowedDomain = (input: string): string | null => {
  const candidate = input.trim().toLowerCase();

  if (!candidate) {
    return null;
  }

  if (candidate.startsWith("http://") || candidate.startsWith("https://")) {
    try {
      return new URL(candidate).hostname.toLowerCase();
    } catch {
      return null;
    }
  }

  const withoutPath = candidate.split("/")[0] ?? "";
  const withoutPort = withoutPath.split(":")[0] ?? "";

  return withoutPort.length > 0 ? withoutPort : null;
};

/**
 * Looks up an organization by UUID id or slug.
 */
export const resolveOrganizationByIdentifier = async (
  supabase: SupabaseClient,
  orgIdentifier: string
): Promise<OrganizationProfile | null> => {
  const identifier = orgIdentifier.trim();

  if (!identifier) {
    return null;
  }

  const parsedUuid = uuidSchema.safeParse(identifier);

  const baseQuery = supabase.from("organizations").select("id,slug,name,plan,settings").limit(1);
  const scopedQuery = parsedUuid.success ? baseQuery.eq("id", identifier) : baseQuery.eq("slug", identifier);

  const { data, error } = await scopedQuery.maybeSingle();

  if (error) {
    throw new Error(`Failed to load organization: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    plan: data.plan as OrganizationPlan,
    settings: (data.settings as Record<string, unknown> | null) ?? {},
  };
};

/**
 * Loads the widget configuration row for an organization.
 */
export const resolveWidgetConfigForOrganization = async (
  supabase: SupabaseClient,
  orgId: string
): Promise<WidgetConfigRecord | null> => {
  const { data, error } = await supabase
    .from("widget_configs")
    .select("org_id,display_name,welcome_message,primary_color,position,avatar_url,is_active,allowed_domains")
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load widget config: ${error.message}`);
  }

  return data as WidgetConfigRecord | null;
};

/**
 * Resolves the tone setting used by the AI assistant prompt.
 */
export const resolveToneSetting = (settings: Record<string, unknown>): string => {
  const fromSnakeCase = settings.tone_setting;
  const fromCamelCase = settings.toneSetting;

  if (typeof fromSnakeCase === "string" && fromSnakeCase.trim().length > 0) {
    return fromSnakeCase.trim();
  }

  if (typeof fromCamelCase === "string" && fromCamelCase.trim().length > 0) {
    return fromCamelCase.trim();
  }

  return "friendly, concise, and professional";
};

/**
 * Merges organization plan + widget settings into a safe public widget config.
 */
export const buildPublicWidgetConfig = (
  organization: OrganizationProfile,
  record: WidgetConfigRecord | null
): PublicWidgetConfig => {
  return {
    orgId: organization.id,
    displayName: record?.display_name?.trim() || "Support Assistant",
    welcomeMessage: record?.welcome_message?.trim() || "Hi! How can I help you today?",
    primaryColor: record?.primary_color?.trim() || "#2563eb",
    position: record?.position === "bottom-left" ? "bottom-left" : "bottom-right",
    avatarUrl: record?.avatar_url?.trim() || null,
    isActive: record?.is_active ?? true,
    allowedDomains: cleanAllowedDomains(record?.allowed_domains),
    poweredBy: organization.plan === "free",
  };
};

/**
 * Validates whether an Origin header is allowed by the widget domain allowlist.
 */
export const isOriginAllowed = (origin: string | null, allowedDomains: string[]): boolean => {
  if (allowedDomains.length === 0) {
    return true;
  }

  if (!origin) {
    return false;
  }

  let originHost = "";

  try {
    originHost = new URL(origin).hostname.toLowerCase();
  } catch {
    return false;
  }

  return allowedDomains.some((allowedDomainRaw) => {
    const allowedDomain = parseHostFromAllowedDomain(allowedDomainRaw);

    if (!allowedDomain) {
      return false;
    }

    if (allowedDomain.startsWith("*.")) {
      const suffix = allowedDomain.slice(2);
      return originHost === suffix || originHost.endsWith(`.${suffix}`);
    }

    return originHost === allowedDomain;
  });
};

/**
 * Builds CORS headers for public widget/chat endpoints.
 */
export const buildCorsHeaders = (origin: string | null, allowOrigin: boolean): HeadersInit => {
  if (!origin || !allowOrigin) {
    return {
      Vary: "Origin",
    };
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
};

/**
 * Checks whether Supabase is configured for a non-local runtime environment.
 */
export const isRemoteSupabaseConfigured = (): boolean => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return false;
  }

  try {
    const hostname = new URL(supabaseUrl).hostname.toLowerCase();
    return hostname !== "localhost" && hostname !== "127.0.0.1";
  } catch {
    return false;
  }
};
