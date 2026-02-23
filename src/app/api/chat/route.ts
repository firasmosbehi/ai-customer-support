import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { type NextRequest, NextResponse } from "next/server";
import { classifyMessageIntent, type ClassifierCategory } from "@/lib/ai/classifier";
import { CHAT_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { buildRetrievedContext, retrieveRelevantChunks } from "@/lib/ai/rag";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { chatRequestSchema } from "@/lib/validators";
import {
  buildCorsHeaders,
  buildPublicWidgetConfig,
  isOriginAllowed,
  resolveOrganizationByIdentifier,
  resolveToneSetting,
  resolveWidgetConfigForOrganization,
  type OrganizationPlan,
} from "@/lib/widget";

const VISITOR_HOURLY_LIMIT = 100;

const PLAN_DAILY_MESSAGE_LIMITS: Record<OrganizationPlan, number | null> = {
  free: 100,
  starter: 1_000,
  pro: 10_000,
  enterprise: null,
};

interface VisitorRateBucket {
  count: number;
  resetAt: number;
}

interface ConversationRow {
  id: string;
}

interface StoredMessage {
  role: "user" | "assistant" | "system" | "human_agent";
  content: string;
}

const getVisitorRateMap = (): Map<string, VisitorRateBucket> => {
  const globalState = globalThis as typeof globalThis & {
    __supportPilotVisitorRateMap?: Map<string, VisitorRateBucket>;
  };

  if (!globalState.__supportPilotVisitorRateMap) {
    globalState.__supportPilotVisitorRateMap = new Map<string, VisitorRateBucket>();
  }

  return globalState.__supportPilotVisitorRateMap;
};

const consumeVisitorQuota = (
  orgId: string,
  visitorId: string
): { allowed: boolean; retryAfterSeconds: number } => {
  const map = getVisitorRateMap();
  const now = Date.now();
  const key = `${orgId}:${visitorId}`;
  const existing = map.get(key);

  if (!existing || now >= existing.resetAt) {
    map.set(key, {
      count: 1,
      resetAt: now + 60 * 60 * 1000,
    });

    return {
      allowed: true,
      retryAfterSeconds: 3600,
    };
  }

  if (existing.count >= VISITOR_HOURLY_LIMIT) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  map.set(key, existing);

  return {
    allowed: true,
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
};

const buildConversationHistoryText = (messages: StoredMessage[]): string => {
  if (messages.length === 0) {
    return "No prior messages.";
  }

  return messages
    .map((message) => {
      if (message.role === "user") {
        return `Customer: ${message.content}`;
      }

      if (message.role === "human_agent") {
        return `Human agent: ${message.content}`;
      }

      return `Assistant: ${message.content}`;
    })
    .join("\n");
};

const toModelMessages = (messages: StoredMessage[]): Array<{ role: "user" | "assistant"; content: string }> => {
  return messages.map((message) => {
    if (message.role === "user") {
      return {
        role: "user",
        content: message.content,
      };
    }

    if (message.role === "human_agent") {
      return {
        role: "assistant",
        content: `Human agent message: ${message.content}`,
      };
    }

    return {
      role: "assistant",
      content: message.content,
    };
  });
};

const staticTextStreamResponse = (text: string, headers: HeadersInit): Response => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      ...headers,
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
};

const resolveConversation = async (params: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  orgId: string;
  visitorId: string;
  requestedConversationId?: string;
  requestOrigin: string | null;
  userAgent: string | null;
}): Promise<ConversationRow> => {
  if (params.requestedConversationId) {
    const { data: conversation, error } = await params.supabase
      .from("conversations")
      .select("id")
      .eq("id", params.requestedConversationId)
      .eq("org_id", params.orgId)
      .eq("visitor_id", params.visitorId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load conversation: ${error.message}`);
    }

    if (conversation) {
      return conversation as ConversationRow;
    }
  }

  const { data: activeConversation, error: activeError } = await params.supabase
    .from("conversations")
    .select("id")
    .eq("org_id", params.orgId)
    .eq("visitor_id", params.visitorId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeError) {
    throw new Error(`Failed to load active conversation: ${activeError.message}`);
  }

  if (activeConversation) {
    return activeConversation as ConversationRow;
  }

  const { data: createdConversation, error: createError } = await params.supabase
    .from("conversations")
    .insert({
      org_id: params.orgId,
      visitor_id: params.visitorId,
      status: "active",
      metadata: {
        origin: params.requestOrigin,
        userAgent: params.userAgent,
      },
    })
    .select("id")
    .single();

  if (createError || !createdConversation) {
    throw new Error(`Failed to create conversation: ${createError?.message ?? "unknown_error"}`);
  }

  return createdConversation as ConversationRow;
};

const ensurePlanDailyLimit = async (
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  orgId: string,
  plan: OrganizationPlan
): Promise<boolean> => {
  const dailyLimit = PLAN_DAILY_MESSAGE_LIMITS[plan];

  if (dailyLimit === null) {
    return true;
  }

  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("role", "user")
    .gte("created_at", dayStart.toISOString());

  if (error) {
    throw new Error(`Failed to evaluate message quota: ${error.message}`);
  }

  return (count ?? 0) < dailyLimit;
};

const createEscalation = async (params: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  orgId: string;
  conversationId: string;
  reason: string;
  priority: "low" | "medium" | "high" | "urgent";
}) => {
  const { data: existingEscalation, error: lookupError } = await params.supabase
    .from("escalations")
    .select("id")
    .eq("org_id", params.orgId)
    .eq("conversation_id", params.conversationId)
    .in("status", ["pending", "assigned"])
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Failed to check escalation state: ${lookupError.message}`);
  }

  if (!existingEscalation) {
    const { error: createError } = await params.supabase.from("escalations").insert({
      org_id: params.orgId,
      conversation_id: params.conversationId,
      reason: params.reason,
      priority: params.priority,
      status: "pending",
    });

    if (createError) {
      throw new Error(`Failed to create escalation: ${createError.message}`);
    }
  }

  const { error: updateConversationError } = await params.supabase
    .from("conversations")
    .update({ status: "escalated" })
    .eq("id", params.conversationId)
    .eq("org_id", params.orgId);

  if (updateConversationError) {
    throw new Error(`Failed to update conversation status: ${updateConversationError.message}`);
  }
};

const getRuleBasedReply = (
  intent: ClassifierCategory,
  displayName: string
): { text: string; escalates: boolean; reason: string | null; priority: "low" | "medium" | "high" | "urgent" } => {
  if (intent === "GREETING") {
    return {
      text: `Hi! I'm ${displayName}. How can I help you today?`,
      escalates: false,
      reason: null,
      priority: "low",
    };
  }

  if (intent === "SPAM") {
    return {
      text: "I can help with support questions related to this business. Please share a specific support issue.",
      escalates: false,
      reason: null,
      priority: "low",
    };
  }

  if (intent === "ESCALATION_REQUEST") {
    return {
      text: "Understood. I'll connect you with a human support agent now. Please share any details they should review first.",
      escalates: true,
      reason: "Visitor requested human assistance",
      priority: "high",
    };
  }

  if (intent === "COMPLAINT") {
    return {
      text: "I’m sorry this has been frustrating. I’m escalating this conversation to a human support agent so they can help quickly.",
      escalates: true,
      reason: "Complaint detected",
      priority: "high",
    };
  }

  return {
    text: "Could you share a bit more detail so I can help you accurately?",
    escalates: false,
    reason: null,
    priority: "low",
  };
};

/**
 * Handles preflight checks for the public widget chat endpoint.
 */
export const OPTIONS = async (request: NextRequest) => {
  const origin = request.headers.get("origin");
  const orgIdentifier = request.nextUrl.searchParams.get("org_id");

  if (!origin) {
    return new NextResponse(null, { status: 204 });
  }

  if (!orgIdentifier) {
    return NextResponse.json(
      { error: "Missing org_id query parameter", code: "VALIDATION_ERROR" },
      { status: 400, headers: buildCorsHeaders(origin, false) }
    );
  }

  try {
    const supabase = createSupabaseAdminClient();
    const organization = await resolveOrganizationByIdentifier(supabase, orgIdentifier);

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found", code: "ORG_NOT_FOUND" },
        { status: 404, headers: buildCorsHeaders(origin, false) }
      );
    }

    const widgetConfig = buildPublicWidgetConfig(
      organization,
      await resolveWidgetConfigForOrganization(supabase, organization.id)
    );

    const allowed = isOriginAllowed(origin, widgetConfig.allowedDomains);

    if (!allowed) {
      return NextResponse.json(
        { error: "Origin is not allowed", code: "DOMAIN_NOT_ALLOWED" },
        { status: 403, headers: buildCorsHeaders(origin, false) }
      );
    }

    return new NextResponse(null, {
      status: 204,
      headers: buildCorsHeaders(origin, true),
    });
  } catch (error) {
    console.error("Chat preflight failed", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500, headers: buildCorsHeaders(origin, false) }
    );
  }
};

/**
 * Public widget chat endpoint with classification, escalation, and streaming responses.
 */
export const POST = async (request: NextRequest) => {
  const origin = request.headers.get("origin");
  const userAgent = request.headers.get("user-agent");

  try {
    const rawBody = await request.json().catch(() => null);
    const parsedBody = chatRequestSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.issues[0]?.message ?? "Invalid request", code: "VALIDATION_ERROR" },
        { status: 400, headers: buildCorsHeaders(origin, false) }
      );
    }

    const payload = parsedBody.data;
    const queryOrgId = request.nextUrl.searchParams.get("org_id");

    if (queryOrgId && queryOrgId !== payload.org_id) {
      return NextResponse.json(
        { error: "Mismatched org_id", code: "VALIDATION_ERROR" },
        { status: 400, headers: buildCorsHeaders(origin, false) }
      );
    }

    const supabase = createSupabaseAdminClient();
    const organization = await resolveOrganizationByIdentifier(supabase, payload.org_id);

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found", code: "ORG_NOT_FOUND" },
        { status: 404, headers: buildCorsHeaders(origin, false) }
      );
    }

    const widgetConfig = buildPublicWidgetConfig(
      organization,
      await resolveWidgetConfigForOrganization(supabase, organization.id)
    );

    if (!widgetConfig.isActive) {
      return NextResponse.json(
        { error: "Widget is inactive", code: "WIDGET_INACTIVE" },
        { status: 403, headers: buildCorsHeaders(origin, false) }
      );
    }

    const originAllowed = isOriginAllowed(origin, widgetConfig.allowedDomains);

    if (origin && !originAllowed) {
      return NextResponse.json(
        { error: "Origin is not allowed", code: "DOMAIN_NOT_ALLOWED" },
        { status: 403, headers: buildCorsHeaders(origin, false) }
      );
    }

    const corsHeaders = buildCorsHeaders(origin, true);
    const visitorQuota = consumeVisitorQuota(organization.id, payload.visitor_id);

    if (!visitorQuota.allowed) {
      return NextResponse.json(
        { error: "Visitor hourly limit reached", code: "VISITOR_RATE_LIMITED" },
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Retry-After": String(visitorQuota.retryAfterSeconds),
          },
        }
      );
    }

    const dailyQuotaAllowed = await ensurePlanDailyLimit(supabase, organization.id, organization.plan);

    if (!dailyQuotaAllowed) {
      return NextResponse.json(
        { error: "Plan daily message limit reached", code: "PLAN_LIMIT_REACHED" },
        { status: 429, headers: corsHeaders }
      );
    }

    const conversation = await resolveConversation({
      supabase,
      orgId: organization.id,
      visitorId: payload.visitor_id,
      requestedConversationId: payload.conversation_id,
      requestOrigin: origin,
      userAgent,
    });

    const { error: insertUserMessageError } = await supabase.from("messages").insert({
      conversation_id: conversation.id,
      org_id: organization.id,
      role: "user",
      content: payload.message,
      model: "visitor",
    });

    if (insertUserMessageError) {
      console.error("Failed to persist user message", insertUserMessageError);
      return NextResponse.json(
        { error: "Failed to persist message", code: "MESSAGE_STORE_FAILED" },
        { status: 500, headers: corsHeaders }
      );
    }

    const { data: historyRows, error: historyError } = await supabase
      .from("messages")
      .select("role,content")
      .eq("conversation_id", conversation.id)
      .eq("org_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (historyError) {
      console.error("Failed to load conversation history", historyError);
      return NextResponse.json(
        { error: "Failed to load conversation history", code: "HISTORY_LOOKUP_FAILED" },
        { status: 500, headers: corsHeaders }
      );
    }

    const history = ((historyRows ?? []) as StoredMessage[]).reverse();

    let intent: ClassifierCategory = "OTHER";

    try {
      intent = await classifyMessageIntent(payload.message);
    } catch (classifierError) {
      console.error("Intent classification failed; falling back to OTHER", classifierError);
    }

    if (intent !== "SUPPORT_QUESTION") {
      const ruleReply = getRuleBasedReply(intent, widgetConfig.displayName);

      if (ruleReply.escalates && ruleReply.reason) {
        await createEscalation({
          supabase,
          orgId: organization.id,
          conversationId: conversation.id,
          reason: ruleReply.reason,
          priority: ruleReply.priority,
        });
      }

      const { error: assistantStoreError } = await supabase.from("messages").insert({
        conversation_id: conversation.id,
        org_id: organization.id,
        role: "assistant",
        content: ruleReply.text,
        model: "rule-based",
      });

      if (assistantStoreError) {
        console.error("Failed to persist assistant message", assistantStoreError);
      }

      return staticTextStreamResponse(ruleReply.text, {
        ...corsHeaders,
        "X-Conversation-Id": conversation.id,
        "X-Intent": intent,
      });
    }

    let retrievedChunks: Array<{ id: string; similarity: number }> = [];
    let retrievedContext = "No matching knowledge-base chunks were found.";

    try {
      const chunks = await retrieveRelevantChunks(supabase, {
        orgId: organization.id,
        query: payload.message,
      });

      retrievedChunks = chunks.map((chunk) => ({ id: chunk.id, similarity: chunk.similarity }));
      retrievedContext = chunks.length > 0 ? buildRetrievedContext(chunks) : retrievedContext;
    } catch (retrievalError) {
      console.error("Chunk retrieval failed; continuing with empty context", retrievalError);
    }

    const toneSetting = resolveToneSetting(organization.settings);
    const conversationHistory = buildConversationHistoryText(history);
    const systemPrompt = CHAT_SYSTEM_PROMPT.replace("{business_name}", organization.name)
      .replace("{tone_setting}", toneSetting)
      .replace("{retrieved_chunks}", retrievedContext)
      .replace("{conversation_history}", conversationHistory);

    if (!process.env.ANTHROPIC_API_KEY) {
      const fallbackText =
        "The AI assistant is not fully configured yet. Please contact support and we will connect you with a human agent.";

      const { error: assistantStoreError } = await supabase.from("messages").insert({
        conversation_id: conversation.id,
        org_id: organization.id,
        role: "assistant",
        content: fallbackText,
        model: "fallback-no-anthropic-key",
        sources: retrievedChunks,
      });

      if (assistantStoreError) {
        console.error("Failed to persist fallback assistant message", assistantStoreError);
      }

      return staticTextStreamResponse(fallbackText, {
        ...corsHeaders,
        "X-Conversation-Id": conversation.id,
        "X-Intent": intent,
      });
    }

    const streamResult = await streamText({
      model: anthropic("claude-sonnet-4-5-20250514"),
      system: systemPrompt,
      messages: toModelMessages(history),
      onFinish: async ({ text, usage }) => {
        const assistantText = text.trim().length > 0
          ? text
          : "I don't have specific information about that in my knowledge base. Would you like me to connect you with our support team for a more detailed answer?";

        const { error: assistantStoreError } = await supabase.from("messages").insert({
          conversation_id: conversation.id,
          org_id: organization.id,
          role: "assistant",
          content: assistantText,
          model: "claude-sonnet-4-5-20250514",
          tokens_used: usage.totalTokens,
          sources: retrievedChunks,
        });

        if (assistantStoreError) {
          console.error("Failed to persist streamed assistant message", assistantStoreError);
        }
      },
    });

    return streamResult.toTextStreamResponse({
      status: 200,
      headers: {
        ...corsHeaders,
        "X-Conversation-Id": conversation.id,
        "X-Intent": intent,
        "X-Source-Count": String(retrievedChunks.length),
      },
    });
  } catch (error) {
    console.error("Chat route failed", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500, headers: buildCorsHeaders(origin, false) }
    );
  }
};
