CREATE TABLE IF NOT EXISTS daily_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_conversations INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  avg_response_time_ms INTEGER,
  resolution_rate DECIMAL(5, 2),
  escalation_rate DECIMAL(5, 2),
  avg_satisfaction DECIMAL(3, 2),
  tokens_used INTEGER DEFAULT 0,
  estimated_cost DECIMAL(10, 4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, date)
);

CREATE INDEX IF NOT EXISTS idx_analytics_org_date ON daily_analytics(org_id, date DESC);

ALTER TABLE daily_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY analytics_org_access ON daily_analytics
FOR ALL USING (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
)
WITH CHECK (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);
