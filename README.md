# AI Customer Support Chatbot SaaS

Phase 1 foundation is implemented:
- Next.js 14 + TypeScript + Tailwind scaffold
- Supabase auth integration (email/password + Google OAuth)
- Post-signup organization creation flow
- Dashboard shell with protected routes and placeholder pages
- Supabase SQL migrations (001-008) and seed scaffold

Phase 2 core is now started:
- Knowledge base page with source ingestion UI (PDF, DOCX, CSV, URL, Text, FAQ)
- Ingestion API (`/api/ingest`) with extraction, chunking, embedding, and vector storage
- Retrieval test API (`/api/knowledge-base/test`) and dashboard retrieval tester UI
- AI helpers for chunking, embeddings, RAG retrieval, and classification scaffolding

Phase 3 core is now started:
- Public chat API (`/api/chat`) with streaming responses via Vercel AI SDK + Anthropic
- Intent classification (Claude Haiku) and escalation creation for complaint/human-handoff intents
- Conversation continuity via `visitor_id` + conversation lookup/creation
- Public widget config API (`/api/widget/[orgId]`) with domain allowlist checks
- Standalone embeddable widget bundle built to `public/widget.js` with Shadow DOM and streaming UI

## 1. Install dependencies

```bash
npx pnpm install
```

## 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in your Supabase, Stripe, Anthropic, OpenAI, and Resend credentials.

### Google OAuth setup (Supabase)

If you want "Continue with Google" to work:
- Create OAuth credentials in Google Cloud Console.
- Add this redirect URI in Google OAuth config:
  - `https://<your-supabase-project-ref>.supabase.co/auth/v1/callback`
- Set the local variables used by `supabase/config.toml`:
  - `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`
  - `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`
- Push auth config to hosted Supabase:

```bash
npx supabase login
npx supabase config push --project-ref <your-supabase-project-ref>
```

## 3. Run local Supabase and migrations

```bash
npx supabase start
npx supabase db reset
```

This applies all migrations in `supabase/migrations/` and seeds `supabase/seed.sql`.

## 4. Start development server

```bash
npx pnpm dev
```

Then open `http://localhost:3000`.

## Render deployment

This repository includes a Render Blueprint at `render.yaml`.

### 1. Push this project to a Git provider

Render Blueprint deployments require a GitHub/GitLab/Bitbucket repository.

### 2. Create a new Blueprint service in Render

In the Render Dashboard:
- New `+` -> `Blueprint`
- Select your repository
- Confirm `render.yaml`

### 3. Fill required environment variables

Set all `sync: false` keys from `render.yaml` in Render:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `RESEND_API_KEY`
- `NEXT_PUBLIC_APP_URL` (your Render public URL)
- `NEXT_PUBLIC_WIDGET_URL` (your Render public URL + `/widget.js`)

### 4. Validate blueprint locally (optional)

```bash
render blueprints validate render.yaml
```

## Widget build

```bash
npx pnpm build:widget
```

Embed snippet:

```html
<script src="https://yourdomain.com/widget.js" data-org-id="your-org-id"></script>
```

Optional API host override:

```html
<script src="https://your-cdn/widget.js" data-org-id="your-org-id" data-api-base="https://your-app-domain"></script>
```

## Phase status

- Phase 1: Completed
- Phase 2: In progress (ingestion + retrieval test implemented)
- Phase 3: In progress (chat endpoint + widget foundation implemented)
