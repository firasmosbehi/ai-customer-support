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

## 1. Install dependencies

```bash
npx pnpm install
```

## 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in your Supabase, Stripe, Anthropic, OpenAI, and Resend credentials.

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

## Phase status

- Phase 1: Completed
- Phase 2: In progress (ingestion + retrieval test implemented)
- Phase 3+: Pending
