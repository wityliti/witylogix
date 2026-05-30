-- RLS for eta_logs (tenant_id) — guarded: table may not exist in all environments
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'eta_logs') THEN
    ALTER TABLE eta_logs ENABLE ROW LEVEL SECURITY;
    ALTER TABLE eta_logs FORCE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'eta_logs') THEN
    CREATE POLICY tenant_isolation ON eta_logs
        FOR ALL TO app_user
        USING (tenant_id = current_setting('app.current_shop_id', TRUE)::UUID)
        WITH CHECK (tenant_id = current_setting('app.current_shop_id', TRUE)::UUID);
  END IF;
END $$;
