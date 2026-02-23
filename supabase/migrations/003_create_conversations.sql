CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'escalated')),
  satisfaction_rating INTEGER CHECK (satisfaction_rating BETWEEN 1 AND 5),
  metadata JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_org ON conversations(org_id, created_at DESC);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversations_org_access ON conversations
FOR ALL USING (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
)
WITH CHECK (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);
