CREATE TABLE IF NOT EXISTS widget_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  display_name TEXT DEFAULT 'Support Assistant',
  welcome_message TEXT DEFAULT 'Hi! How can I help you today?',
  primary_color TEXT DEFAULT '#6366f1',
  position TEXT DEFAULT 'bottom-right' CHECK (position IN ('bottom-right', 'bottom-left')),
  avatar_url TEXT,
  custom_css TEXT,
  allowed_domains TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS widget_configs_set_updated_at ON widget_configs;
CREATE TRIGGER widget_configs_set_updated_at
BEFORE UPDATE ON widget_configs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

ALTER TABLE widget_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY widget_configs_org_access ON widget_configs
FOR ALL USING (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
)
WITH CHECK (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);
