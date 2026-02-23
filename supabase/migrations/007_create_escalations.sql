CREATE TABLE IF NOT EXISTS escalations (
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

CREATE INDEX IF NOT EXISTS idx_escalations_org_status ON escalations(org_id, status);

ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;

CREATE POLICY escalations_org_access ON escalations
FOR ALL USING (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
)
WITH CHECK (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);
