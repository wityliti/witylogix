-- Witylogix Onboarding & Workspace Configuration Migration
-- Handles tenant onboarding flow, workspace provisioning, and invitations

-- ─── ONBOARDING PROGRESS TABLE ──────────────────────────────────────────────
-- Tracks user journey through onboarding flow
CREATE TABLE IF NOT EXISTS onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  org_id UUID,
  current_step VARCHAR(100) NOT NULL,
  current_sub_step VARCHAR(100),
  completed_steps TEXT[] DEFAULT ARRAY[]::TEXT[],
  data JSONB DEFAULT '{}',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  abandoned_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_onboarding_progress_user_id
    FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_onboarding_progress_org_id
    FOREIGN KEY (org_id)
    REFERENCES organizations(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_onboarding_progress_user_id ON onboarding_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_org_id ON onboarding_progress(org_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_is_active_created_at
  ON onboarding_progress(is_active DESC, created_at DESC);

-- ─── WORKSPACES TABLE ───────────────────────────────────────────────────────
-- Deployment units owned by organizations
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  deployment_type VARCHAR(50) DEFAULT 'CLOUD' CHECK (deployment_type IN ('CLOUD', 'SELF_MANAGED')),
  industry VARCHAR(100),
  goals TEXT[] DEFAULT ARRAY[]::TEXT[],
  selected_integrations TEXT[] DEFAULT ARRAY[]::TEXT[],
  dashboard_layout JSONB,
  settings JSONB DEFAULT '{}',
  provisioned_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_workspaces_org_id
    FOREIGN KEY (org_id)
    REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT unique_workspace_org_slug
    UNIQUE (org_id, slug)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces(slug);
CREATE INDEX IF NOT EXISTS idx_workspaces_org_id ON workspaces(org_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_is_active_created_at
  ON workspaces(is_active DESC, created_at DESC);

-- ─── WORKSPACE SETTINGS TABLE ───────────────────────────────────────────────
-- Localization and regional settings per workspace
CREATE TABLE IF NOT EXISTS workspace_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL UNIQUE,
  timezone VARCHAR(100) DEFAULT 'UTC',
  currency VARCHAR(3) DEFAULT 'USD',
  distance_unit VARCHAR(10) DEFAULT 'KM' CHECK (distance_unit IN ('KM', 'MILES')),
  weight_unit VARCHAR(10) DEFAULT 'KG' CHECK (weight_unit IN ('KG', 'LBS')),
  date_format VARCHAR(20) DEFAULT 'YYYY-MM-DD',
  locale VARCHAR(10) DEFAULT 'en-US',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_workspace_settings_workspace_id
    FOREIGN KEY (workspace_id)
    REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workspace_settings_workspace_id ON workspace_settings(workspace_id);

-- ─── WORKSPACE API KEYS TABLE ───────────────────────────────────────────────
-- API credentials for workspace-level access
CREATE TABLE IF NOT EXISTS workspace_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  key_prefix VARCHAR(20) UNIQUE NOT NULL,
  key_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_by UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_workspace_api_keys_workspace_id
    FOREIGN KEY (workspace_id)
    REFERENCES workspaces(id) ON DELETE CASCADE,
  CONSTRAINT fk_workspace_api_keys_created_by
    FOREIGN KEY (created_by)
    REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_workspace_api_keys_workspace_id ON workspace_api_keys(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_api_keys_key_prefix ON workspace_api_keys(key_prefix);

-- ─── INTEGRATION CONNECTIONS TABLE ──────────────────────────────────────────
-- Provisioned integration connections per workspace
CREATE TABLE IF NOT EXISTS integration_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  integration_app_slug VARCHAR(255) NOT NULL,
  credentials JSONB DEFAULT '{}',
  config JSONB DEFAULT '{}',
  is_enabled BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP,
  health_status VARCHAR(50) DEFAULT 'UNKNOWN',
  connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_integration_connections_workspace_id
    FOREIGN KEY (workspace_id)
    REFERENCES workspaces(id) ON DELETE CASCADE,
  CONSTRAINT unique_integration_connection_workspace_slug
    UNIQUE (workspace_id, integration_app_slug)
);

CREATE INDEX IF NOT EXISTS idx_integration_connections_workspace_id ON integration_connections(workspace_id);
CREATE INDEX IF NOT EXISTS idx_integration_connections_app_slug ON integration_connections(integration_app_slug);

-- ─── INVITATIONS TABLE ──────────────────────────────────────────────────────
-- Team member invitations
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'MEMBER' CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER', 'DRIVER')),
  invited_by UUID NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP,
  accepted_by UUID,
  status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED')),
  revoked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_invitations_org_id
    FOREIGN KEY (org_id)
    REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_invitations_invited_by
    FOREIGN KEY (invited_by)
    REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_invitations_accepted_by
    FOREIGN KEY (accepted_by)
    REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT unique_invitations_org_email
    UNIQUE (org_id, email)
);

CREATE INDEX IF NOT EXISTS idx_invitations_org_id ON invitations(org_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_status_expires_at ON invitations(status, expires_at);

-- ─── RLS POLICIES ───────────────────────────────────────────────────────────

ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY onboarding_progress_user_isolation ON onboarding_progress
  FOR ALL
  USING (user_id = COALESCE(current_setting('app.current_user_id', true)::uuid, user_id));

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspaces_org_isolation ON workspaces
  FOR ALL
  USING (org_id = COALESCE(current_setting('app.current_org_id', true)::uuid, org_id));

ALTER TABLE workspace_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_settings_org_isolation ON workspace_settings
  FOR ALL
  USING (
    workspace_id IN (
      SELECT id FROM workspaces
      WHERE org_id = COALESCE(current_setting('app.current_org_id', true)::uuid, org_id)
    )
  );

ALTER TABLE workspace_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_api_keys_org_isolation ON workspace_api_keys
  FOR ALL
  USING (
    workspace_id IN (
      SELECT id FROM workspaces
      WHERE org_id = COALESCE(current_setting('app.current_org_id', true)::uuid, org_id)
    )
  );

ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY integration_connections_org_isolation ON integration_connections
  FOR ALL
  USING (
    workspace_id IN (
      SELECT id FROM workspaces
      WHERE org_id = COALESCE(current_setting('app.current_org_id', true)::uuid, org_id)
    )
  );

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY invitations_org_isolation ON invitations
  FOR ALL
  USING (org_id = COALESCE(current_setting('app.current_org_id', true)::uuid, org_id));
