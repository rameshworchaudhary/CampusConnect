-- Review draft for staging only. The prior correction removed client INSERT
-- but the inherited table ACL still allowed TRUNCATE, which bypasses RLS.
BEGIN;
DO $$
BEGIN
  IF to_regclass('public.audit_logs') IS NULL
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.audit_logs'::regclass) THEN
    RAISE EXCEPTION 'Audit ACL correction preflight failed: audit_logs is missing or RLS is disabled';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audit_logs' AND cmd='INSERT'
      AND ('authenticated'=ANY(roles) OR 'anon'=ANY(roles) OR 'public'=ANY(roles))) THEN
    RAISE EXCEPTION 'Audit ACL correction preflight failed: client INSERT policy still exists; review it before changing grants';
  END IF;
END $$;
REVOKE ALL PRIVILEGES ON TABLE public.audit_logs FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.audit_logs TO authenticated;
COMMIT;
