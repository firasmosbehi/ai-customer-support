CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organizations_set_updated_at ON organizations;
CREATE TRIGGER organizations_set_updated_at
BEFORE UPDATE ON organizations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_select_policy ON organizations
FOR SELECT USING (
  id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);

CREATE POLICY org_insert_policy ON organizations
FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY org_update_policy ON organizations
FOR UPDATE USING (
  id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
)
WITH CHECK (
  id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
);

CREATE POLICY org_member_select_policy ON org_members
FOR SELECT USING (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);

CREATE POLICY org_member_insert_policy ON org_members
FOR INSERT WITH CHECK (
  user_id = auth.uid()
  OR org_id IN (
    SELECT id FROM organizations WHERE owner_id = auth.uid()
  )
);

CREATE INDEX IF NOT EXISTS idx_org_members_org ON org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON org_members(user_id);
