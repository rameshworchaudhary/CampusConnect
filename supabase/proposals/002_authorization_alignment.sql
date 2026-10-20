-- Review proposal only. Role/account checks and parent-table RLS alignment.
-- Apply only after 001_schema_compatibility.sql in a disposable staging database.
BEGIN;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','clubs','events','announcements','club_memberships','event_registrations','user_announcement_reads','audit_logs'] LOOP
    IF to_regclass('public.'||t) IS NULL OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.'||t)) THEN
      RAISE EXCEPTION 'Authorization preflight failed: public.% is missing or RLS is disabled',t;
    END IF;
  END LOOP;
  IF to_regprocedure('public.cc_profile_privileges_unchanged(uuid,text,uuid,boolean)') IS NULL THEN
    RAISE EXCEPTION 'Authorization preflight failed: existing profile privilege guard is missing';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='events' AND cmd='SELECT' AND ('anon'=ANY(roles) OR 'public'=ANY(roles)))<>1
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='events' AND policyname='View published events' AND cmd='SELECT' AND qual ILIKE '%published%' AND qual ILIKE '%approved%') THEN
    RAISE EXCEPTION 'Authorization preflight failed: public event SELECT policy inventory differs; inspect all permissive policy predicates before replacing';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='announcements' AND cmd='INSERT' AND 'authenticated'=ANY(roles))<>1
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='announcements' AND policyname='Club admins create announcements' AND cmd='INSERT' AND with_check ILIKE '%club_id IS NULL%') THEN
    RAISE EXCEPTION 'Authorization preflight failed: announcement INSERT policy inventory differs; inspect all permissive policy predicates before replacing';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='event_registrations' AND cmd='INSERT' AND 'authenticated'=ANY(roles))<>1
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='event_registrations' AND policyname='CampusConnect student event registration' AND cmd='INSERT' AND with_check ILIKE '%published%') THEN
    RAISE EXCEPTION 'Authorization preflight failed: event-registration INSERT policy inventory differs';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='events' AND cmd='INSERT' AND 'authenticated'=ANY(roles))<>1
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='events' AND policyname='Club admins create events' AND cmd='INSERT')
     OR (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='events' AND cmd='UPDATE' AND 'authenticated'=ANY(roles))<>1
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='events' AND policyname='Club admins update events' AND cmd='UPDATE')
     OR (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='events' AND cmd='DELETE' AND 'authenticated'=ANY(roles))<>1
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='events' AND policyname='Club admins delete events' AND cmd='DELETE') THEN
    RAISE EXCEPTION 'Authorization preflight failed: event write-policy inventory differs; inspect all permissive policies before continuing';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='club_memberships' AND cmd='INSERT' AND 'authenticated'=ANY(roles))<>1
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='club_memberships' AND policyname='Students request membership' AND cmd='INSERT') THEN
    RAISE EXCEPTION 'Authorization preflight failed: membership INSERT policy inventory differs';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='club_memberships' AND cmd='UPDATE' AND 'authenticated'=ANY(roles))<>1
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='club_memberships' AND policyname='Club admins review memberships' AND cmd='UPDATE')
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='club_memberships' AND cmd='DELETE' AND 'authenticated'=ANY(roles)) THEN
    RAISE EXCEPTION 'Authorization preflight failed: club-membership policy inventory differs';
  END IF;
  IF to_regprocedure('public.campusconnect_event_registration_count()') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid='public.event_registrations'::regclass AND t.tgname='campusconnect_event_registration_count' AND NOT t.tgisinternal) THEN
    RAISE EXCEPTION 'Authorization preflight failed: existing registered_count trigger is missing';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.cc_is_active_user()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_active IS TRUE) $$;
REVOKE ALL ON FUNCTION public.cc_is_active_user() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cc_is_active_user() TO authenticated;

CREATE OR REPLACE FUNCTION public.cc_is_active_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.role::text='admin' AND p.is_active IS TRUE) $$;
REVOKE ALL ON FUNCTION public.cc_is_active_super_admin() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cc_is_active_super_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$ SELECT public.cc_is_active_super_admin() $$;

CREATE OR REPLACE FUNCTION public.can_manage_club(target_club_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
  SELECT public.cc_is_active_super_admin() OR EXISTS (
    SELECT 1 FROM public.profiles p JOIN public.clubs c ON c.id=target_club_id
    WHERE p.id=(SELECT auth.uid()) AND p.role::text='club_admin' AND p.is_active IS TRUE
      AND (p.assigned_club_id=target_club_id OR c.assigned_admin_id=p.id)
  )
$$;

-- Serialize registrations on an event row and enforce its actual capacity.
-- The SECURITY DEFINER body is tightly scoped, checks the active student and
-- publication/approval state, and is callable only as a table trigger.
CREATE OR REPLACE FUNCTION public.cc_enforce_event_capacity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  event_capacity integer;
  event_is_published boolean;
  event_is_platform boolean;
  event_club_id uuid;
  registered_count bigint;
BEGIN
  IF NEW.status <> 'REGISTERED' THEN RETURN NEW; END IF;
  IF NOT public.cc_is_active_user() OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id=(SELECT auth.uid()) AND p.role::text='student' AND p.is_active IS TRUE
  ) THEN
    RAISE EXCEPTION 'Only an active student can register for an event.' USING ERRCODE='42501';
  END IF;
  SELECT e.capacity,e.published,e.is_platform_event,e.club_id
    INTO event_capacity,event_is_published,event_is_platform,event_club_id
    FROM public.events e WHERE e.id=NEW.event_id FOR UPDATE;
  IF NOT FOUND OR event_is_published IS NOT TRUE THEN
    RAISE EXCEPTION 'The event is missing or unpublished.' USING ERRCODE='42501';
  END IF;
  IF event_club_id IS NULL THEN
    IF event_is_platform IS NOT TRUE THEN
      RAISE EXCEPTION 'A clubless event must be marked as a platform event.' USING ERRCODE='23514';
    END IF;
  ELSIF NOT EXISTS (SELECT 1 FROM public.clubs c WHERE c.id=event_club_id AND c.status::text='approved') THEN
    RAISE EXCEPTION 'The event club is not approved.' USING ERRCODE='42501';
  END IF;
  SELECT count(*) INTO registered_count FROM public.event_registrations r
    WHERE r.event_id=NEW.event_id AND r.status='REGISTERED';
  IF registered_count >= event_capacity THEN
    RAISE EXCEPTION 'This event has reached its registration capacity.' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.cc_enforce_event_capacity() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS cc_enforce_event_capacity ON public.event_registrations;
CREATE TRIGGER cc_enforce_event_capacity BEFORE INSERT ON public.event_registrations
FOR EACH ROW EXECUTE FUNCTION public.cc_enforce_event_capacity();

-- The live update policy checks club management but does not protect the
-- membership identity columns from reassignment by a club admin.
CREATE OR REPLACE FUNCTION public.cc_guard_membership_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path=''
AS $$
BEGIN
  IF OLD.id IS DISTINCT FROM NEW.id OR OLD.club_id IS DISTINCT FROM NEW.club_id OR
     OLD.student_id IS DISTINCT FROM NEW.student_id OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'Membership identity and club assignment cannot be changed.' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.cc_guard_membership_identity() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS cc_guard_membership_identity ON public.club_memberships;
CREATE TRIGGER cc_guard_membership_identity BEFORE UPDATE ON public.club_memberships
FOR EACH ROW EXECUTE FUNCTION public.cc_guard_membership_identity();

-- A restrictive policy ANDs with the existing per-feature policies for each
-- authenticated role. It leaves anonymous public reads governed by parent RLS.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','clubs','events','announcements','club_memberships','event_registrations','user_announcement_reads','audit_logs'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I','CC active account guard',t);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.cc_is_active_user()) WITH CHECK (public.cc_is_active_user())','CC active account guard',t);
  END LOOP;
END $$;

-- Club admins may edit assigned-club profile fields; this trigger protects
-- status and assignment fields even if another permissive UPDATE policy exists.
CREATE OR REPLACE FUNCTION public.cc_guard_club_profile_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  IF public.cc_is_active_super_admin() THEN RETURN NEW; END IF;
  IF public.can_manage_club(OLD.id) AND (
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.assigned_admin_id IS DISTINCT FROM NEW.assigned_admin_id OR
    OLD.created_by IS DISTINCT FROM NEW.created_by
  ) THEN
    RAISE EXCEPTION 'Club admins may edit assigned-club details but cannot change approval or assignment fields.' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.cc_guard_club_profile_update() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS cc_guard_club_profile_update ON public.clubs;
CREATE TRIGGER cc_guard_club_profile_update BEFORE UPDATE ON public.clubs
FOR EACH ROW EXECUTE FUNCTION public.cc_guard_club_profile_update();

DROP POLICY IF EXISTS "Club admins update assigned club profile" ON public.clubs;
CREATE POLICY "Club admins update assigned club profile" ON public.clubs
FOR UPDATE TO authenticated USING (public.can_manage_club(id)) WITH CHECK (public.can_manage_club(id));

-- The live permissive INSERT policy allowed any signed-in user to create a
-- global announcement because it accepted club_id IS NULL.
DROP POLICY "Club admins create announcements" ON public.announcements;
CREATE POLICY "Club admins create announcements" ON public.announcements
FOR INSERT TO authenticated WITH CHECK (
  created_by=(SELECT auth.uid()) AND (
    (club_id IS NULL AND public.cc_is_active_super_admin()) OR
    (club_id IS NOT NULL AND public.can_manage_club(club_id))
  )
);

-- Allow a published platform event only when explicitly marked as such; keep
-- published club-event visibility tied to approved clubs.
DROP POLICY "View published events" ON public.events;
CREATE POLICY "View published events" ON public.events FOR SELECT TO anon,authenticated USING (
  (published IS TRUE AND (
    (club_id IS NULL AND is_platform_event IS TRUE) OR
    EXISTS (SELECT 1 FROM public.clubs c WHERE c.id=events.club_id AND c.status::text='approved')
  )) OR public.can_manage_club(club_id) OR created_by=(SELECT auth.uid())
);

-- Keep registration rows tied to a real published platform event or a
-- published event for an approved club.
DROP POLICY "CampusConnect student event registration" ON public.event_registrations;
CREATE POLICY "CampusConnect student event registration" ON public.event_registrations
FOR INSERT TO authenticated WITH CHECK (
  user_id=(SELECT auth.uid()) AND status='REGISTERED' AND public.cc_is_active_user() AND
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.role::text='student' AND p.is_active IS TRUE) AND
  EXISTS (SELECT 1 FROM public.events e WHERE e.id=event_registrations.event_id AND e.published IS TRUE AND (
    (e.club_id IS NULL AND e.is_platform_event IS TRUE) OR
    (e.club_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.clubs c WHERE c.id=e.club_id AND c.status::text='approved'))
  ))
);

-- Only the student who owns a pending request may withdraw it.
DROP POLICY IF EXISTS "CC students cancel own pending memberships" ON public.club_memberships;
CREATE POLICY "CC students cancel own pending memberships" ON public.club_memberships
FOR DELETE TO authenticated USING (
  student_id=(SELECT auth.uid()) AND status='pending' AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id=(SELECT auth.uid()) AND p.role::text='student' AND p.is_active IS TRUE
  )
);

NOTIFY pgrst,'reload schema';
COMMIT;
