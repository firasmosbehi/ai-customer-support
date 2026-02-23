CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('pdf', 'docx', 'csv', 'url', 'text', 'faq')),
  source_url TEXT,
  content TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'error')),
  chunk_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS documents_set_updated_at ON documents;
CREATE TRIGGER documents_set_updated_at
BEFORE UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_documents_org ON documents(org_id);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY documents_org_access ON documents
FOR ALL USING (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
)
WITH CHECK (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);
