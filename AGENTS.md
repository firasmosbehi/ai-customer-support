# AGENTS.md — AI Customer Support Chatbot SaaS

## Project Overview

Build a **productized AI customer support chatbot platform** that businesses can use to automate their customer support. The platform allows business owners to upload their knowledge base (FAQs, docs, website content), deploy a branded chatbot widget on their site, and monitor conversations through an analytics dashboard.

**Target Niche:** Small-to-medium businesses (dental practices, e-commerce stores, SaaS companies, property management firms).

**Core Value Proposition:** Replace $8/ticket human support with $0.10/ticket AI support. Businesses get 24/7 coverage, instant responses, and escalation to humans when needed.

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | **Next.js 14+ (App Router)** | Full-stack React framework, server components, API routes |
| Language | **TypeScript** | Strict mode enabled throughout |
| Database | **Supabase (PostgreSQL + Auth + Storage + Realtime)** | Hosted PostgreSQL with built-in auth, file storage, and realtime subscriptions |
| AI/LLM | **Anthropic Claude API (claude-sonnet-4-5-20250514)** | Primary model for chat. Use `claude-haiku-4-5-20251001` for classification/routing tasks |
| Embeddings | **OpenAI text-embedding-3-small** | For RAG vector search. 1536 dimensions |
| Vector Store | **Supabase pgvector extension** | Store and query embeddings directly in PostgreSQL |
| Styling | **Tailwind CSS + shadcn/ui** | Utility-first CSS with accessible component library |
| Deployment | **Vercel** | Edge functions, automatic preview deploys |
| Payments | **Stripe** | Subscriptions, metered billing, customer portal |
| Email | **Resend** | Transactional emails (welcome, alerts, reports) |
| File Processing | **LangChain document loaders** | PDF, DOCX, CSV, URL scraping |
| State Management | **Zustand** | Lightweight client state where needed |
| Validation | **Zod** | Runtime type validation for API inputs/outputs |
| Testing | **Vitest + Playwright** | Unit tests and E2E tests |
| Linting | **ESLint + Prettier** | Consistent code formatting |
| Package Manager | **pnpm** | Fast, disk-efficient |

---

## Project Structure

```
├── AGENTS.md
├── README.md
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── .env.local.example
├── prisma/                      # (optional) if using Prisma over raw Supabase
├── supabase/
│   ├── migrations/              # SQL migration files
│   │   ├── 001_create_organizations.sql
│   │   ├── 002_create_knowledge_base.sql
│   │   ├── 003_create_conversations.sql
│   │   ├── 004_create_messages.sql
│   │   ├── 005_create_embeddings.sql
│   │   ├── 006_create_widget_config.sql
│   │   ├── 007_create_escalations.sql
│   │   └── 008_create_analytics.sql
│   └── seed.sql
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Root layout with providers
│   │   ├── page.tsx             # Landing/marketing page
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   └── callback/route.ts
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx       # Dashboard shell (sidebar + header)
│   │   │   ├── dashboard/page.tsx           # Overview/analytics
│   │   │   ├── conversations/page.tsx       # Conversation list & viewer
│   │   │   ├── conversations/[id]/page.tsx  # Single conversation detail
│   │   │   ├── knowledge-base/page.tsx      # Upload & manage docs
│   │   │   ├── widget/page.tsx              # Widget configuration
│   │   │   ├── escalations/page.tsx         # Human handoff queue
│   │   │   ├── settings/page.tsx            # Org settings, API keys
│   │   │   └── billing/page.tsx             # Stripe billing portal
│   │   └── api/
│   │       ├── chat/route.ts                # Public chat endpoint (widget calls this)
│   │       ├── ingest/route.ts              # Knowledge base ingestion pipeline
│   │       ├── webhook/stripe/route.ts      # Stripe webhook handler
│   │       ├── widget/[orgId]/route.ts      # Widget config endpoint
│   │       └── analytics/route.ts           # Analytics data endpoint
│   ├── components/
│   │   ├── ui/                  # shadcn/ui components
│   │   ├── dashboard/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── StatsCards.tsx
│   │   │   ├── ConversationList.tsx
│   │   │   ├── ConversationViewer.tsx
│   │   │   ├── KnowledgeBaseUploader.tsx
│   │   │   ├── DocumentList.tsx
│   │   │   ├── WidgetConfigurator.tsx
│   │   │   ├── EscalationQueue.tsx
│   │   │   └── AnalyticsCharts.tsx
│   │   ├── chat/
│   │   │   ├── ChatWidget.tsx       # Embeddable chat widget (standalone build)
│   │   │   ├── ChatBubble.tsx
│   │   │   ├── ChatInput.tsx
│   │   │   └── ChatMessage.tsx
│   │   └── landing/
│   │       ├── Hero.tsx
│   │       ├── Features.tsx
│   │       ├── Pricing.tsx
│   │       ├── Testimonials.tsx
│   │       └── Footer.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts        # Browser Supabase client
│   │   │   ├── server.ts        # Server-side Supabase client
│   │   │   └── admin.ts         # Service role client (for background jobs)
│   │   ├── ai/
│   │   │   ├── anthropic.ts     # Claude API client & helpers
│   │   │   ├── embeddings.ts    # OpenAI embedding generation
│   │   │   ├── rag.ts           # RAG pipeline: query → retrieve → augment → generate
│   │   │   ├── chunker.ts       # Document chunking strategies
│   │   │   ├── classifier.ts    # Intent classification & escalation detection
│   │   │   └── prompts.ts       # System prompts & prompt templates
│   │   ├── stripe.ts            # Stripe client & helpers
│   │   ├── resend.ts            # Email client
│   │   ├── validators.ts        # Zod schemas
│   │   └── utils.ts             # Shared utilities
│   ├── hooks/
│   │   ├── useConversations.ts
│   │   ├── useKnowledgeBase.ts
│   │   ├── useAnalytics.ts
│   │   └── useRealtimeMessages.ts
│   ├── stores/
│   │   └── chatStore.ts         # Zustand store for widget state
│   └── types/
│       └── index.ts             # Global TypeScript types
├── widget/
│   ├── embed.ts                 # Lightweight embed script (<5KB)
│   └── build.config.ts          # Separate build config for widget bundle
├── tests/
│   ├── unit/
│   └── e2e/
└── public/
    └── widget.js                # Built widget embed script
```

---

## Database Schema

### Core Tables

```sql
-- Organizations (each paying customer)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization members
CREATE TABLE org_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, user_id)
);

-- Knowledge base documents
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('pdf', 'docx', 'csv', 'url', 'text', 'faq')),
    source_url TEXT,
    content TEXT,
    metadata JSONB DEFAULT '{}',
    status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'error')),
    chunk_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document chunks with embeddings (pgvector)
CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    token_count INTEGER,
    embedding VECTOR(1536),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversations
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    visitor_id TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'escalated')),
    satisfaction_rating INTEGER CHECK (satisfaction_rating BETWEEN 1 AND 5),
    metadata JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages within conversations
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'human_agent')),
    content TEXT NOT NULL,
    tokens_used INTEGER,
    model TEXT,
    sources JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Escalations (human handoff queue)
CREATE TABLE escalations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'resolved')),
    assigned_to UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- Widget configuration
CREATE TABLE widget_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
    display_name TEXT DEFAULT 'Support Assistant',
    welcome_message TEXT DEFAULT 'Hi! How can I help you today?',
    primary_color TEXT DEFAULT '#6366f1',
    position TEXT DEFAULT 'bottom-right' CHECK (position IN ('bottom-right', 'bottom-left')),
    avatar_url TEXT,
    custom_css TEXT,
    allowed_domains TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily analytics (pre-aggregated)
CREATE TABLE daily_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_conversations INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    avg_response_time_ms INTEGER,
    resolution_rate DECIMAL(5,2),
    escalation_rate DECIMAL(5,2),
    avg_satisfaction DECIMAL(3,2),
    tokens_used INTEGER DEFAULT 0,
    estimated_cost DECIMAL(10,4) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, date)
);

-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Vector similarity search index
CREATE INDEX ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Performance indexes
CREATE INDEX idx_documents_org ON documents(org_id);
CREATE INDEX idx_chunks_org ON document_chunks(org_id);
CREATE INDEX idx_conversations_org ON conversations(org_id, created_at DESC);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at ASC);
CREATE INDEX idx_escalations_org_status ON escalations(org_id, status);
CREATE INDEX idx_analytics_org_date ON daily_analytics(org_id, date DESC);

-- Row Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE widget_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only access data belonging to their organization
CREATE POLICY "org_member_access" ON organizations
    FOR ALL USING (id IN (
        SELECT org_id FROM org_members WHERE user_id = auth.uid()
    ));

-- Repeat similar RLS policies for all org-scoped tables
-- Pattern: WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
```

### Supabase RPC Functions

```sql
-- Vector similarity search function
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding VECTOR(1536),
    match_org_id UUID,
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        dc.id,
        dc.content,
        dc.metadata,
        1 - (dc.embedding <=> query_embedding) AS similarity
    FROM document_chunks dc
    WHERE dc.org_id = match_org_id
        AND 1 - (dc.embedding <=> query_embedding) > match_threshold
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
```

---

## Core Implementation Details

### 1. RAG Pipeline (`src/lib/ai/rag.ts`)

The RAG (Retrieval-Augmented Generation) pipeline is the heart of the product.

**Flow:**
1. User sends a message via the chat widget
2. Generate embedding of the user's message using OpenAI `text-embedding-3-small`
3. Query `document_chunks` using pgvector cosine similarity (top 5 chunks, threshold 0.7)
4. Build augmented prompt with retrieved context
5. Send to Claude API with system prompt + context + conversation history
6. Stream response back to the widget
7. Store message and update analytics

**Document Ingestion Flow (`src/lib/ai/chunker.ts`):**
1. Accept file upload (PDF, DOCX, CSV, plain text) or URL
2. Extract text content using LangChain document loaders
3. Clean and normalize text
4. Split into chunks using recursive character text splitter (chunk size: 1000 tokens, overlap: 200 tokens)
5. Generate embeddings for each chunk (batch process, max 100 per request)
6. Store chunks + embeddings in `document_chunks` table
7. Update document status to 'ready'

**URL Scraping:** When a business provides their website URL, crawl up to 50 pages (respect robots.txt), extract meaningful content (strip nav, footer, ads), and ingest as documents.

### 2. Chat Endpoint (`src/app/api/chat/route.ts`)

```typescript
// Pseudocode for the chat endpoint
export async function POST(req: Request) {
    // 1. Validate request (org_id, visitor_id, message)
    // 2. Rate limit check (100 messages/hour per visitor)
    // 3. Get or create conversation
    // 4. Run intent classification with Claude Haiku:
    //    - Is this a support question? → RAG pipeline
    //    - Is this a greeting/chitchat? → Simple response
    //    - Does this need human help? → Escalate
    //    - Is this abusive/spam? → Flag and decline
    // 5. If support question:
    //    a. Generate embedding of user message
    //    b. Retrieve relevant chunks from knowledge base
    //    c. Build prompt with system instructions + context + history (last 10 messages)
    //    d. Stream response from Claude Sonnet
    //    e. Include source references in response metadata
    // 6. Store user message + assistant response
    // 7. Update conversation metadata
    // 8. Return streamed response
}
```

**Rate Limiting:** Implement using Supabase + in-memory counter. Free plan: 100 messages/day per org. Starter: 1,000/day. Pro: 10,000/day. Enterprise: unlimited.

**Streaming:** Use the Vercel AI SDK's `streamText` with the Anthropic provider for real-time token streaming to the widget.

### 3. System Prompts (`src/lib/ai/prompts.ts`)

```typescript
export const CHAT_SYSTEM_PROMPT = `You are a helpful customer support assistant for {business_name}.

ROLE AND BEHAVIOR:
- You answer customer questions using ONLY the provided knowledge base context
- Be friendly, professional, and concise
- If you don't know the answer or the context doesn't contain relevant info, say so honestly and offer to connect them with a human agent
- Never make up information, prices, policies, or promises
- Keep responses under 150 words unless the question requires a detailed explanation
- Use the business's tone: {tone_setting}

KNOWLEDGE BASE CONTEXT:
{retrieved_chunks}

CONVERSATION HISTORY:
{conversation_history}

ESCALATION RULES:
- If the customer explicitly asks to speak to a human, trigger escalation
- If the customer expresses frustration more than twice, suggest human handoff
- If the question involves billing disputes, refunds, or complaints, suggest human handoff
- For urgent/safety issues, immediately escalate

FORMATTING:
- Use short paragraphs
- Use bullet points for lists of 3+ items
- Bold key information like prices, hours, or important policies
- Include a follow-up question when appropriate

When you cannot answer from the knowledge base, respond:
"I don't have specific information about that in my knowledge base. Would you like me to connect you with our support team for a more detailed answer?"`;

export const CLASSIFIER_PROMPT = `Classify the following user message into exactly one category.
Respond with ONLY the category name, nothing else.

Categories:
- SUPPORT_QUESTION: Questions about products, services, policies, how-to
- GREETING: Hello, hi, hey, etc.
- ESCALATION_REQUEST: Wants to talk to a human
- COMPLAINT: Expressing dissatisfaction or frustration
- SPAM: Irrelevant, abusive, or promotional content
- OTHER: Anything that doesn't fit above

Message: {message}`;
```

### 4. Embeddable Chat Widget (`widget/embed.ts`)

The widget must be a **standalone JavaScript bundle** that clients embed with a single script tag:

```html
<script src="https://yourdomain.com/widget.js" data-org-id="org_xxx"></script>
```

**Widget Requirements:**
- Bundle size under **50KB** gzipped (use Preact or vanilla JS, NOT full React)
- Renders a floating chat bubble in the bottom-right corner
- Opens into a chat window on click
- Streams AI responses in real-time
- Persists visitor_id in localStorage for conversation continuity
- Supports custom colors, logo, welcome message (fetched from widget_configs)
- Works on all modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile responsive
- Does NOT interfere with host site styles (use Shadow DOM or strict CSS scoping)
- Includes a "Powered by [YourBrand]" link (free plan)

**Build the widget separately** using esbuild or Vite library mode. Output a single IIFE bundle to `public/widget.js`.

### 5. Dashboard Features

**Analytics Page (`/dashboard`):**
- Total conversations (today, this week, this month)
- Messages sent/received
- Average response time
- Resolution rate (% of conversations resolved without escalation)
- Escalation rate
- Customer satisfaction score (post-chat rating)
- Token usage and estimated cost
- Charts: conversation volume over time, satisfaction trend, top topics
- Use Recharts for all visualizations

**Conversations Page (`/conversations`):**
- Searchable, filterable list of all conversations
- Filter by: status (active, resolved, escalated), date range, satisfaction rating
- Click to view full conversation thread
- Ability to jump in as a human agent (sends message with role 'human_agent')
- Export conversations as CSV

**Knowledge Base Page (`/knowledge-base`):**
- Drag-and-drop file upload (PDF, DOCX, CSV, TXT)
- URL input for website scraping
- Manual FAQ entry form (question + answer pairs)
- List of all documents with status, chunk count, date uploaded
- Delete documents (cascades to chunks)
- "Test" button: ask a question and see what the RAG pipeline retrieves

**Widget Configuration Page (`/widget`):**
- Live preview of the chat widget
- Color picker for primary color
- Upload custom avatar/logo
- Edit welcome message and display name
- Toggle widget on/off
- Allowed domains list
- Copy embed code snippet

**Escalations Page (`/escalations`):**
- Queue of conversations flagged for human review
- Priority levels with color coding
- Assign to team members
- Click to open conversation and respond
- Mark as resolved

### 6. Stripe Integration

**Plans:**
| Plan | Price | Messages/mo | Documents | Features |
|---|---|---|---|---|
| Free | $0 | 100 | 5 | Basic widget, "Powered by" branding |
| Starter | $49/mo | 1,000 | 25 | Custom branding, email notifications |
| Pro | $149/mo | 10,000 | 100 | Analytics, team members, API access |
| Enterprise | $499/mo | Unlimited | Unlimited | Priority support, SLA, custom integrations |

**Implementation:**
- Use Stripe Checkout for subscription creation
- Stripe Customer Portal for plan changes and cancellation
- Webhook handler for: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- Metered billing: track message count per org per billing period
- Overage charges: $0.01 per message over plan limit (optional, configurable)

---

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic
ANTHROPIC_API_KEY=

# OpenAI (embeddings only)
OPENAI_API_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Resend
RESEND_API_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_WIDGET_URL=http://localhost:3000/widget.js
```

---

## Implementation Order

Follow this exact sequence. Each phase should be fully functional before moving to the next.

### Phase 1: Foundation (implement first)
1. Initialize Next.js project with TypeScript, Tailwind, shadcn/ui
2. Set up Supabase project and run all migrations
3. Implement Supabase Auth (email/password + Google OAuth)
4. Build organization creation flow (post-signup)
5. Build dashboard layout shell (sidebar, header, placeholder pages)

### Phase 2: Knowledge Base & RAG
6. Build file upload UI and document list
7. Implement document ingestion pipeline (text extraction → chunking → embedding → storage)
8. Implement URL scraping and ingestion
9. Build the `match_documents` RPC function
10. Build the full RAG pipeline (query → retrieve → augment → generate)
11. Add "Test your knowledge base" feature on the KB page

### Phase 3: Chat System
12. Build the chat API endpoint with streaming
13. Implement intent classification with Claude Haiku
14. Build escalation detection and creation
15. Build the embeddable chat widget (separate bundle)
16. Implement visitor_id persistence and conversation continuity
17. Add real-time message updates using Supabase Realtime

### Phase 4: Dashboard & Analytics
18. Build conversation list and viewer pages
19. Build escalation queue page
20. Implement daily analytics aggregation (cron or Supabase edge function)
21. Build analytics dashboard with charts
22. Build widget configuration page with live preview

### Phase 5: Billing & Polish
23. Implement Stripe subscription flow
24. Build billing portal page
25. Implement usage tracking and plan limit enforcement
26. Add rate limiting
27. Build the landing/marketing page
28. Add email notifications (new escalation, daily summary)
29. Write tests (unit for RAG pipeline, E2E for critical flows)
30. Performance optimization (caching, lazy loading, bundle analysis)

---

## Code Style & Conventions

- **TypeScript strict mode** — no `any` types, no `@ts-ignore`
- **Functional components only** — no class components
- **Server components by default** — use `'use client'` only when needed
- **Named exports** — no default exports except for page/layout files
- **Zod validation** — validate all API inputs and external data
- **Error handling** — every API route wrapped in try/catch, return proper HTTP status codes and structured error JSON `{ error: string, code: string }`
- **Logging** — use `console.error` for errors, `console.info` for important events, never log sensitive data
- **Comments** — add JSDoc comments to all exported functions and complex logic
- **File naming** — PascalCase for components, camelCase for utilities, kebab-case for route folders
- **Database queries** — always use parameterized queries, never string interpolation
- **API responses** — consistent shape: `{ data: T }` for success, `{ error: string, code: string }` for errors
- **Streaming responses** — use the Vercel AI SDK `streamText` function with the Anthropic provider
- **Secrets** — never hardcode, always use environment variables
- **RLS** — every table must have Row Level Security enabled with appropriate policies

---

## Testing Requirements

- **Unit tests** for: RAG pipeline, chunking, embedding generation, intent classification, Zod validators
- **Integration tests** for: chat API endpoint, document ingestion, Stripe webhooks
- **E2E tests** for: signup → create org → upload doc → test chatbot → view conversations
- Minimum **80% code coverage** on `src/lib/` directory
- All tests must pass before any PR merge

---

## Performance Targets

- Chat widget: **< 50KB** gzipped bundle
- First response latency: **< 2 seconds** (time to first token)
- Dashboard page load: **< 1.5 seconds**
- Document ingestion: **< 30 seconds** for a 50-page PDF
- Vector search: **< 200ms** for similarity query
- Lighthouse score: **> 90** on landing page

---

## Security Requirements

- All API routes validate authentication (except `/api/chat` which validates org_id + rate limits)
- Supabase RLS on every table — no exceptions
- CORS on chat endpoint restricted to allowed_domains from widget_configs
- Stripe webhook signature verification
- Rate limiting on all public endpoints
- Input sanitization on all user-provided content
- No sensitive data in client-side code or logs
- CSP headers configured for the widget embed

---

## Key Libraries & Versions

```json
{
    "next": "^14.2",
    "react": "^18.3",
    "typescript": "^5.4",
    "@anthropic-ai/sdk": "^0.30",
    "openai": "^4.60",
    "@supabase/supabase-js": "^2.45",
    "@supabase/ssr": "^0.5",
    "ai": "^3.4",
    "@ai-sdk/anthropic": "^0.0.50",
    "stripe": "^16.12",
    "zod": "^3.23",
    "zustand": "^4.5",
    "recharts": "^2.12",
    "langchain": "^0.3",
    "@langchain/community": "^0.3",
    "resend": "^4.0",
    "tailwindcss": "^3.4",
    "shadcn-ui": "latest",
    "lucide-react": "^0.400",
    "date-fns": "^3.6",
    "esbuild": "^0.23"
}
```

---

## Notes for the Agent

- **Start with Phase 1** and get authentication and the dashboard shell working before anything else. Do not skip ahead.
- **The chat widget is a separate build target.** It must not import React — use Preact or vanilla JS to keep the bundle small. Build it with esbuild into a single IIFE file.
- **Always implement streaming** for chat responses. Never return a complete response in one chunk. Use Server-Sent Events or the Vercel AI SDK streaming primitives.
- **pgvector is critical.** Ensure the vector extension is enabled in Supabase and the IVFFlat index is created before attempting similarity searches.
- **Test the RAG pipeline thoroughly.** The quality of retrieved chunks determines the quality of the entire product. Log similarity scores during development.
- **The landing page matters.** It should be polished, fast, and include: hero with demo, features section, pricing table, testimonials placeholder, and footer. Use modern SaaS landing page design patterns.
- When implementing Stripe, **always handle the webhook events** — don't rely on client-side confirmation alone.
- For the widget embed script, **use Shadow DOM** to prevent CSS conflicts with host sites.
- **Supabase Realtime** should be used for: live conversation updates in the dashboard, new escalation notifications, and real-time message display when a human agent responds.