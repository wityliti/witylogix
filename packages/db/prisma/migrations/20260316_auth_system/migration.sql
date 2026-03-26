-- Witylogix Auth System Migration
-- Handles session management, MFA devices, login auditing, API keys, and RBAC

-- ─── AUTH SESSIONS TABLE ────────────────────────────────────────────────────
-- Tracks active user sessions with device fingerprinting and security info
CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  org_id UUID NOT NULL,
  provider_id UUID NOT NULL,
  token TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  device_id VARCHAR(255),
  expires_at TIMESTAMP NOT NULL,
  mfa_verified BOOLEAN DEFAULT false,
  mfa_verified_at TIMESTAMP,
  is_revoked BOOLEAN DEFAULT false,
  revoked_at TIMESTAMP,
  last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_auth_sessions_user_id
    FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_auth_sessions_org_id
    FOREIGN KEY (org_id)
    REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_auth_sessions_provider_id
    FOREIGN KEY (provider_id)
    REFERENCES auth_providers(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_sessions_user_device
  ON auth_sessions(user_id, device_id)
  WHERE device_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_org_id ON auth_sessions(org_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_mfa_verified ON auth_sessions(mfa_verified);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_is_revoked ON auth_sessions(is_revoked);

-- ─── MFA DEVICES TABLE ──────────────────────────────────────────────────────
-- Stores multi-factor authentication configurations (TOTP, SMS, EMAIL)
CREATE TABLE IF NOT EXISTS mfa_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('TOTP', 'SMS', 'EMAIL')),
  secret TEXT,
  phone_number VARCHAR(20),
  email VARCHAR(255),
  is_verified BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false,
  last_used_at TIMESTAMP,
  backup_codes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_mfa_devices_user_id
    FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT unique_mfa_device_user_type_phone
    UNIQUE (user_id, type, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_mfa_devices_user_id ON mfa_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_devices_type ON mfa_devices(type);
CREATE INDEX IF NOT EXISTS idx_mfa_devices_is_verified ON mfa_devices(is_verified);

-- ─── LOGIN ATTEMPTS TABLE ──────────────────────────────────────────────────
-- Audit trail for authentication attempts (success/failure)
CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  email VARCHAR(255),
  ip_address INET NOT NULL,
  user_agent TEXT,
  success BOOLEAN NOT NULL,
  failure_reason VARCHAR(100),
  mfa_method VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_login_attempts_user_id
    FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_user_id ON login_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_address ON login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON login_attempts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_success ON login_attempts(success);

-- ─── API KEYS TABLE ─────────────────────────────────────────────────────────
-- Organization-level API keys for programmatic access
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  prefix VARCHAR(8) UNIQUE NOT NULL,
  key_hash VARCHAR(255) NOT NULL,
  scopes TEXT[] DEFAULT ARRAY[]::TEXT[],
  permissions JSONB DEFAULT '{}',
  rate_limit INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP,
  last_used_ip INET,
  expires_at TIMESTAMP,
  created_by UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_api_keys_org_id
    FOREIGN KEY (org_id)
    REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_api_keys_created_by
    FOREIGN KEY (created_by)
    REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT unique_api_key_org_prefix
    UNIQUE (org_id, prefix)
);

CREATE INDEX IF NOT EXISTS idx_api_keys_org_id ON api_keys(org_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_api_keys_expires_at ON api_keys(expires_at);
CREATE INDEX IF NOT EXISTS idx_api_keys_created_at ON api_keys(created_at DESC);

-- ─── PERMISSIONS TABLE ──────────────────────────────────────────────────────
-- Fine-grained permission definitions (resource + action)
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  description TEXT,
  is_built_in BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_permission_resource_action
    UNIQUE (resource, action)
);

CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource);
CREATE INDEX IF NOT EXISTS idx_permissions_is_built_in ON permissions(is_built_in);

-- ─── ROLE PERMISSIONS TABLE (Junction) ──────────────────────────────────────
-- Maps roles to permissions (many-to-many relationship)
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_role_id UUID,
  permission_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_role_permissions_permission_id
    FOREIGN KEY (permission_id)
    REFERENCES permissions(id) ON DELETE CASCADE,
  CONSTRAINT unique_role_permission
    UNIQUE (org_role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_org_role_id ON role_permissions(org_role_id);

-- ─── RLS POLICIES ───────────────────────────────────────────────────────────
-- Row-level security for multi-tenant isolation

ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY auth_sessions_tenant_isolation ON auth_sessions
  FOR ALL
  USING (org_id = COALESCE(current_setting('app.current_org_id', true)::uuid, org_id));

ALTER TABLE mfa_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY mfa_devices_user_isolation ON mfa_devices
  FOR ALL
  USING (user_id = COALESCE(current_setting('app.current_user_id', true)::uuid, user_id));

ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY login_attempts_org_isolation ON login_attempts
  FOR ALL
  USING (
    user_id IS NULL OR
    user_id IN (SELECT id FROM users WHERE org_id = COALESCE(current_setting('app.current_org_id', true)::uuid, org_id))
  );

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY api_keys_org_isolation ON api_keys
  FOR ALL
  USING (org_id = COALESCE(current_setting('app.current_org_id', true)::uuid, org_id));

ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY permissions_select_all ON permissions
  FOR SELECT
  USING (true);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY role_permissions_select_all ON role_permissions
  FOR SELECT
  USING (true);

-- ─── SEED BUILT-IN PERMISSIONS ──────────────────────────────────────────────
INSERT INTO permissions (resource, action, description, is_built_in) VALUES
  ('shipments', 'create', 'Create new shipments', true),
  ('shipments', 'read', 'View shipments', true),
  ('shipments', 'update', 'Update shipments', true),
  ('shipments', 'delete', 'Delete shipments', true),
  ('routes', 'create', 'Create delivery routes', true),
  ('routes', 'read', 'View routes', true),
  ('routes', 'update', 'Optimize routes', true),
  ('drivers', 'read', 'View driver information', true),
  ('drivers', 'update', 'Update driver details', true),
  ('webhooks', 'manage', 'Configure webhooks', true),
  ('api_keys', 'create', 'Create API keys', true),
  ('api_keys', 'read', 'List API keys', true),
  ('api_keys', 'delete', 'Revoke API keys', true),
  ('organization', 'read', 'View org details', true),
  ('organization', 'update', 'Update org settings', true),
  ('organization', 'manage_users', 'Manage organization members', true)
ON CONFLICT (resource, action) DO NOTHING;
