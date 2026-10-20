-- Staging review follow-up: limit helper RPC exposure and separate anonymous
-- public-read predicates from authenticated management predicates.
-- Apply only after 001-003 on the isolated staging baseline.
BEGIN;

DO $$
BEGIN
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='clubs' AND cmd='SELECT' AND 'anon'=ANY(roles))<>1
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='clubs' AND policyname='View approved clubs' AND cmd='SELECT') THEN
    RAISE EXCEPTION 'ACL hardening preflight failed: club public SELECT policy inventory differs';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='events' AND cmd='SELECT' AND 'anon'=ANY(roles))<>1
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='events' AND policyname='View published events' AND cmd='SELECT') THEN
    RAISE EXCEPTION 'ACL hardening preflight failed: event public SELECT policy inventory differs';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='announcements' AND cmd='SELECT' AND 'anon'=ANY(roles))<>1
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='announcements' AND policyname='View published announcements' AND cmd='SELECT') THEN
    RAISE EXCEPTION 'ACL hardening preflight failed: announcement public SELECT policy inventory differs';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='clubs' AND cmd='SELECT' AND 'authenticated'=ANY(roles))<>1
     OR (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='events' AND cmd='SELECT' AND 'authenticated'=ANY(roles))<>1
     OR (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='announcements' AND cmd='SELECT' AND 'authenticated'=ANY(roles))<>1 THEN
    RAISE EXCEPTION 'ACL hardening preflight failed: unexpected authenticated SELECT policies could OR together with the parent policy being split';
  END IF;
  IF to_regprocedure('public.cc_profile_privileges_unchanged(uuid,text,uuid,boolean)') IS NULL
     OR to_regprocedure('public.handle_new_user()') IS NULL
     OR to_regprocedure('public.campusconnect_event_registration_count()') IS NULL
     OR to_regprocedure('public.cc_audit_profile_governance_change()') IS NULL THEN
    RAISE EXCEPTION 'ACL hardening preflight failed: expected helper or trigger functions are missing';
  END IF;
  IF to_regclass('public.audit_logs') IS NULL OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.audit_logs'::regclass)
     OR (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='audit_logs' AND cmd='INSERT' AND ('authenticated'=ANY(roles) OR 'public'=ANY(roles)))<>1
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audit_logs' AND policyname='CampusConnect users insert own audit logs' AND cmd='INSERT' AND 'authenticated'=ANY(roles)) THEN
    RAISE EXCEPTION 'ACL hardening preflight failed: audit-log INSERT policy inventory differs; inspect policies before disabling client inserts';
  END IF;
END $$;

-- These trigger-only functions are not callable as API RPCs.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.campusconnect_event_registration_count() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.cc_audit_profile_governance_change() FROM PUBLIC,anon,authenticated;

-- RLS calls the profile guard for authenticated profile updates, but it is not
-- needed by anonymous clients.
REVOKE ALL ON FUNCTION public.cc_profile_privileges_unchanged(uuid,text,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cc_profile_privileges_unchanged(uuid,text,uuid,boolean) TO authenticated;

-- These checks are needed only by authenticated policies. Anonymous policies
-- below no longer call them.
REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
REVOKE ALL ON FUNCTION public.can_manage_club(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_manage_club(uuid) TO authenticated;

-- Audit rows must be written by trusted database triggers, not clients that
-- can choose their own action, actor role, target, and details.
DROP POLICY IF EXISTS "CampusConnect users insert own audit logs" ON public.audit_logs;
REVOKE ALL PRIVILEGES ON TABLE public.audit_logs FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.audit_logs TO authenticated;

DROP POLICY "View approved clubs" ON public.clubs;
CREATE POLICY "View approved clubs" ON public.clubs FOR SELECT TO anon USING (status='approved');
CREATE POLICY "Authenticated view clubs" ON public.clubs FOR SELECT TO authenticated USING (
  status='approved' OR created_by=(SELECT auth.uid()) OR assigned_admin_id=(SELECT auth.uid()) OR public.is_super_admin()
);

DROP POLICY "View published events" ON public.events;
CREATE POLICY "View published events" ON public.events FOR SELECT TO anon USING (
  published IS TRUE AND (
    (club_id IS NULL AND is_platform_event IS TRUE) OR
    EXISTS (SELECT 1 FROM public.clubs c WHERE c.id=events.club_id AND c.status::text='approved')
  )
);
CREATE POLICY "Authenticated view events" ON public.events FOR SELECT TO authenticated USING (
  (published IS TRUE AND (
    (club_id IS NULL AND is_platform_event IS TRUE) OR
    EXISTS (SELECT 1 FROM public.clubs c WHERE c.id=events.club_id AND c.status::text='approved')
  )) OR public.can_manage_club(club_id) OR created_by=(SELECT auth.uid())
);

DROP POLICY "View published announcements" ON public.announcements;
CREATE POLICY "View published announcements" ON public.announcements FOR SELECT TO anon USING (
  published IS TRUE AND (
    club_id IS NULL OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id=announcements.club_id AND c.status::text='approved')
  )
);
CREATE POLICY "Authenticated view announcements" ON public.announcements FOR SELECT TO authenticated USING (
  (published IS TRUE AND (
    club_id IS NULL OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id=announcements.club_id AND c.status::text='approved')
  )) OR public.can_manage_club(club_id) OR created_by=(SELECT auth.uid())
);

NOTIFY pgrst,'reload schema';
COMMIT;
