-- Review proposal only. Not applied to staging or production.
-- Requires the corrected schema/ACL proposals 001-004 and a verified audit
-- table with client INSERT/UPDATE/DELETE/TRUNCATE privileges revoked.
-- Records database row changes without accepting caller-authored audit data.
BEGIN;

DO $$
DECLARE
  t text;
  fn_owner text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','clubs','events','announcements','club_memberships','event_registrations'] LOOP
    IF to_regclass(format('public.%I',t)) IS NULL OR NOT (
      SELECT c.relrowsecurity FROM pg_class c WHERE c.oid=to_regclass(format('public.%I',t))
    ) THEN
      RAISE EXCEPTION 'Audit coverage preflight failed: public.% is missing or RLS is disabled',t;
    END IF;
  END LOOP;

  IF to_regclass('public.audit_logs') IS NULL
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.audit_logs'::regclass)
     OR to_regprocedure('public.cc_is_active_super_admin()') IS NULL
     OR to_regprocedure('public.is_super_admin()') IS NULL
     OR to_regprocedure('public.cc_audit_profile_governance_change()') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM pg_trigger
       WHERE tgrelid='public.profiles'::regclass
         AND tgname='cc_audit_profile_governance_change'
         AND NOT tgisinternal
         AND tgfoid='public.cc_audit_profile_governance_change()'::regprocedure
     ) THEN
    RAISE EXCEPTION 'Audit coverage preflight failed: audit table, active-admin helpers, or expected profile governance trigger is missing';
  END IF;

  IF has_table_privilege('anon','public.audit_logs','INSERT')
     OR has_table_privilege('authenticated','public.audit_logs','INSERT')
     OR has_table_privilege('anon','public.audit_logs','UPDATE')
     OR has_table_privilege('authenticated','public.audit_logs','UPDATE')
     OR has_table_privilege('anon','public.audit_logs','DELETE')
     OR has_table_privilege('authenticated','public.audit_logs','DELETE')
     OR has_table_privilege('anon','public.audit_logs','TRUNCATE')
     OR has_table_privilege('authenticated','public.audit_logs','TRUNCATE')
     OR EXISTS (
       SELECT 1 FROM pg_policies
       WHERE schemaname='public' AND tablename='audit_logs'
         AND cmd IN ('INSERT','UPDATE','DELETE','ALL')
         AND ('anon'=ANY(roles) OR 'authenticated'=ANY(roles) OR 'public'=ANY(roles))
     ) THEN
    RAISE EXCEPTION 'Audit coverage preflight failed: client audit mutation privileges or policies remain';
  END IF;

  SELECT pg_get_userbyid(p.proowner) INTO fn_owner
  FROM pg_proc p WHERE p.oid='public.cc_audit_profile_governance_change()'::regprocedure;
  IF fn_owner IS NULL OR NOT has_table_privilege(fn_owner,'public.audit_logs','INSERT') THEN
    RAISE EXCEPTION 'Audit coverage preflight failed: existing trigger function owner cannot insert audit rows';
  END IF;
  IF NOT has_table_privilege(current_user,'public.audit_logs','INSERT') THEN
    RAISE EXCEPTION 'Audit coverage preflight failed: migration executor cannot own a trigger function that inserts audit rows';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname='cc_audit_application_change'
      AND tgrelid IN (
        'public.profiles'::regclass,'public.clubs'::regclass,'public.events'::regclass,
        'public.announcements'::regclass,'public.club_memberships'::regclass,
        'public.event_registrations'::regclass
      ) AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Audit coverage preflight failed: a cc_audit_application_change trigger already exists; inspect it before replacement';
  END IF;
END $$;

-- The actor and action are derived inside the database. No client-supplied
-- email, role, target, details, or action string is accepted by this function.
CREATE FUNCTION public.cc_audit_application_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  changed_row jsonb;
  actor_id uuid;
  actor_mail text;
  actor_role text;
  target_id text;
  action_label text;
BEGIN
  changed_row:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  target_id:=changed_row->>'id';
  actor_id:=auth.uid();

  -- Profile rows are inserted only by the trusted auth-user trigger. During
  -- signup auth.uid() may be NULL, so attribute that single event to NEW.id.
  IF actor_id IS NULL AND TG_TABLE_NAME='profiles' AND TG_OP='INSERT' THEN
    actor_id:=(changed_row->>'id')::uuid;
  END IF;

  IF actor_id IS NULL THEN
    actor_mail:='system';
    actor_role:='SYSTEM';
  ELSE
    SELECT COALESCE(u.email,'unknown'),COALESCE(p.role::text,'unknown')
      INTO actor_mail,actor_role
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id=u.id
    WHERE u.id=actor_id;
    actor_mail:=COALESCE(actor_mail,'unknown');
    actor_role:=COALESCE(actor_role,'unknown');
  END IF;

  action_label:=CASE TG_TABLE_NAME
    WHEN 'profiles' THEN 'USER_REGISTERED'
    WHEN 'clubs' THEN 'CLUB_'||TG_OP
    WHEN 'events' THEN 'EVENT_'||TG_OP
    WHEN 'announcements' THEN 'ANNOUNCEMENT_'||TG_OP
    WHEN 'club_memberships' THEN 'MEMBERSHIP_'||TG_OP
    WHEN 'event_registrations' THEN 'EVENT_REGISTRATION_'||TG_OP
    ELSE NULL
  END;
  IF action_label IS NULL THEN
    RAISE EXCEPTION 'Audit trigger is not configured for table %',TG_TABLE_NAME;
  END IF;

  INSERT INTO public.audit_logs(action_type,actor_email,actor_role,target_identifier,details)
  VALUES (action_label,actor_mail,actor_role,target_id,
          'Database-recorded '||lower(TG_OP)||' on public.'||TG_TABLE_NAME);

  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.cc_audit_application_change() FROM PUBLIC,anon,authenticated;

CREATE TRIGGER cc_audit_profile_create
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.cc_audit_application_change();
CREATE TRIGGER cc_audit_application_change
AFTER INSERT OR UPDATE OR DELETE ON public.clubs
FOR EACH ROW EXECUTE FUNCTION public.cc_audit_application_change();
CREATE TRIGGER cc_audit_application_change
AFTER INSERT OR UPDATE OR DELETE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.cc_audit_application_change();
CREATE TRIGGER cc_audit_application_change
AFTER INSERT OR UPDATE OR DELETE ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.cc_audit_application_change();
CREATE TRIGGER cc_audit_application_change
AFTER INSERT OR UPDATE OR DELETE ON public.club_memberships
FOR EACH ROW EXECUTE FUNCTION public.cc_audit_application_change();
CREATE TRIGGER cc_audit_application_change
AFTER INSERT OR UPDATE OR DELETE ON public.event_registrations
FOR EACH ROW EXECUTE FUNCTION public.cc_audit_application_change();

-- Expand governance auditing to include activation changes while preserving
-- the existing database-side Super Admin authorization check.
CREATE OR REPLACE FUNCTION public.cc_audit_profile_governance_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE actor_mail text; actor_role_text text; action_label text;
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role
     OR OLD.assigned_club_id IS DISTINCT FROM NEW.assigned_club_id
     OR OLD.is_active IS DISTINCT FROM NEW.is_active THEN
    IF auth.uid() IS NULL THEN
      actor_mail:='system';
      actor_role_text:='SYSTEM';
    ELSE
      IF NOT public.cc_is_active_super_admin() OR NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Only an active Super Admin can change profile roles, club assignments, or account status' USING ERRCODE='42501';
      END IF;
      SELECT email,role::text INTO actor_mail,actor_role_text
      FROM public.profiles WHERE id=auth.uid();
      actor_mail:=COALESCE(actor_mail,'unknown');
      actor_role_text:=COALESCE(actor_role_text,'unknown');
    END IF;

    action_label:=CASE
      WHEN OLD.role IS DISTINCT FROM NEW.role THEN 'ROLE_UPDATE'
      WHEN OLD.assigned_club_id IS DISTINCT FROM NEW.assigned_club_id THEN 'ADMIN_ASSIGNMENT'
      ELSE 'ACCOUNT_STATUS'
    END;
    INSERT INTO public.audit_logs(action_type,actor_email,actor_role,target_identifier,details,ip_address)
    VALUES (action_label,actor_mail,actor_role_text,NEW.id::text,
      'Database-recorded profile governance change; role_changed='||(OLD.role IS DISTINCT FROM NEW.role)::text||
      '; club_assignment_changed='||(OLD.assigned_club_id IS DISTINCT FROM NEW.assigned_club_id)::text||
      '; active_changed='||(OLD.is_active IS DISTINCT FROM NEW.is_active)::text,NULL);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER cc_audit_profile_governance_change ON public.profiles;
CREATE TRIGGER cc_audit_profile_governance_change
AFTER UPDATE OF role,assigned_club_id,is_active ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.cc_audit_profile_governance_change();

NOTIFY pgrst,'reload schema';
COMMIT;
