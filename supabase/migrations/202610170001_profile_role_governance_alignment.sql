-- CampusConnect profile compatibility and role governance.
-- Stored role values remain lowercase app_role labels: student/admin/club_admin.
-- The frontend continues to send STUDENT/CLUB_ADMIN/SUPER_ADMIN; this RPC maps
-- those names to the stored enum. Existing `admin` rows remain unchanged and
-- public.is_super_admin() is deliberately not replaced.
--
-- ORDERED APPLICATION:
--   1. Apply 202610170000_add_club_admin_role_enum.sql and let it commit.
--   2. Review/run the read-only preflight queries below.
--   3. Apply this migration.
-- This file does not change any live database by itself.
--
-- PRE-FLIGHT QUERIES (read-only):
-- SELECT column_name, data_type, udt_schema, udt_name
-- FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='profiles' ORDER BY ordinal_position;
-- SELECT role::text, count(*) FROM public.profiles GROUP BY 1 ORDER BY 1;
-- SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
-- JOIN pg_namespace n ON n.oid=t.typnamespace
-- WHERE n.nspname='public' AND t.typname='app_role' ORDER BY e.enumsortorder;
-- SELECT pg_get_functiondef('public.is_super_admin()'::regprocedure);
-- SELECT schemaname, tablename, policyname, permissive, cmd, qual, with_check
-- FROM pg_policies WHERE schemaname='public' AND tablename IN ('profiles','audit_logs');
-- SELECT table_name, column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns WHERE table_schema='public'
-- AND table_name IN ('clubs','audit_logs') ORDER BY table_name, ordinal_position;

-- Preflight all other required live columns before any table changes.
BEGIN;
DO $$
DECLARE
  missing_columns text;
BEGIN
  IF to_regclass('public.profiles') IS NULL OR to_regclass('public.clubs') IS NULL
     OR to_regclass('public.audit_logs') IS NULL THEN
    RAISE EXCEPTION 'Expected public.profiles, public.clubs, and public.audit_logs';
  END IF;

  SELECT string_agg(expected.table_name || '.' || expected.column_name, ', ')
  INTO missing_columns
  FROM (VALUES
    ('profiles','id'), ('profiles','full_name'), ('profiles','email'),
    ('profiles','role'),
    ('clubs','id'), ('clubs','assigned_admin_id'),
    ('audit_logs','action_type'), ('audit_logs','actor_email'),
    ('audit_logs','actor_role'), ('audit_logs','target_identifier'),
    ('audit_logs','details'), ('audit_logs','ip_address')
  ) AS expected(table_name,column_name)
  LEFT JOIN information_schema.columns c
    ON c.table_schema='public' AND c.table_name=expected.table_name
   AND c.column_name=expected.column_name
  WHERE c.column_name IS NULL;
  IF missing_columns IS NOT NULL THEN
    RAISE EXCEPTION 'Governance prerequisite columns are absent: %; inspect and repair separately', missing_columns;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles'
      AND column_name='role' AND udt_schema='public' AND udt_name='app_role'
  ) THEN
    RAISE EXCEPTION 'profiles.role is not public.app_role; no role data changed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name IN ('profiles','clubs')
      AND column_name IN ('id','assigned_admin_id')
      AND data_type <> 'uuid'
  ) OR EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles'
      AND column_name='assigned_club_id' AND data_type <> 'uuid'
  ) THEN
    RAISE EXCEPTION 'Expected profile/club relationship columns to use uuid; inspect before continuing';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='audit_logs'
      AND is_nullable='NO' AND column_default IS NULL
      AND is_identity='NO' AND is_generated='NEVER'
      AND column_name NOT IN ('action_type','actor_email','actor_role','target_identifier','details','ip_address')
  ) THEN
    RAISE EXCEPTION 'audit_logs has another required column the audit writer cannot populate; inspect before continuing';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE role IS NULL OR role::text NOT IN ('student','admin','club_admin')) THEN
    RAISE EXCEPTION 'profiles contains role labels outside student/admin/club_admin; inspect before continuing';
  END IF;
END;
$$;

-- student_id is confirmed missing. assigned_club_id was also confirmed missing
-- by live preflight and is required for the app's club-admin relationship.
-- Other unconfirmed profile fields are not added here.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS student_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS assigned_club_id uuid;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles'
      AND column_name='student_id' AND data_type='text'
  ) THEN
    RAISE EXCEPTION 'public.profiles.student_id exists but is not text; inspect before continuing';
  END IF;
END;
$$;

-- Add/validate the relationship only if an equivalent FK is not already present.
DO $$
DECLARE
  profile_club_att smallint;
  club_id_att smallint;
  relationship_fk text;
BEGIN
  SELECT attnum INTO profile_club_att FROM pg_attribute
  WHERE attrelid='public.profiles'::regclass AND attname='assigned_club_id' AND NOT attisdropped;
  SELECT attnum INTO club_id_att FROM pg_attribute
  WHERE attrelid='public.clubs'::regclass AND attname='id' AND NOT attisdropped;
  SELECT c.conname INTO relationship_fk
  FROM pg_constraint c
    WHERE c.contype='f' AND c.conrelid='public.profiles'::regclass
      AND c.confrelid='public.clubs'::regclass
      AND c.conkey=ARRAY[profile_club_att]::smallint[]
      AND c.confkey=ARRAY[club_id_att]::smallint[]
  LIMIT 1;
  IF relationship_fk IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid='public.profiles'::regclass AND conname='fk_profiles_assigned_club'
    ) THEN
      RAISE EXCEPTION 'Constraint name fk_profiles_assigned_club is already used; inspect before continuing';
    END IF;
    ALTER TABLE public.profiles
      ADD CONSTRAINT fk_profiles_assigned_club
      FOREIGN KEY (assigned_club_id) REFERENCES public.clubs(id) ON DELETE SET NULL NOT VALID;
    relationship_fk := 'fk_profiles_assigned_club';
  END IF;
  EXECUTE format('ALTER TABLE public.profiles VALIDATE CONSTRAINT %I', relationship_fk);
END;
$$;

-- SECURITY DEFINER reads trusted profile role while preserving the deployed
-- public.is_super_admin() implementation and its existing policy dependencies.
CREATE OR REPLACE FUNCTION public.cc_is_active_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id=auth.uid() AND p.role::text='admin'
      AND COALESCE((to_jsonb(p)->>'is_active')::boolean, true)
  );
$$;
REVOKE ALL ON FUNCTION public.cc_is_active_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cc_is_active_super_admin() TO authenticated;

-- App callers pass Role values from src/types/index.ts. They are translated to
-- lowercase enum labels here; `SUPER_ADMIN` maps to the established `admin`.
CREATE OR REPLACE FUNCTION public.set_profile_role_and_club(
  p_target_user_id uuid,
  p_target_role text,
  p_target_club_id uuid DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public, pg_temp
AS $$
DECLARE
  db_role text;
BEGIN
  IF NOT public.cc_is_active_super_admin() OR NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only an active Super Admin can change roles or club assignments'
      USING ERRCODE='42501';
  END IF;
  IF p_target_user_id IS NULL OR p_target_role IS NULL
     OR p_target_role NOT IN ('STUDENT','CLUB_ADMIN','SUPER_ADMIN') THEN
    RAISE EXCEPTION 'Invalid target profile or role' USING ERRCODE='22023';
  END IF;
  IF (p_target_role='CLUB_ADMIN') <> (p_target_club_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Only CLUB_ADMIN requires a club assignment' USING ERRCODE='22023';
  END IF;
  IF p_target_user_id=auth.uid() THEN
    RAISE EXCEPTION 'Super Admins cannot change their own role or club assignment' USING ERRCODE='42501';
  END IF;

  db_role := CASE p_target_role
    WHEN 'STUDENT' THEN 'student'
    WHEN 'CLUB_ADMIN' THEN 'club_admin'
    WHEN 'SUPER_ADMIN' THEN 'admin'
  END;

  PERFORM 1 FROM public.profiles WHERE id=p_target_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Target profile does not exist' USING ERRCODE='22023'; END IF;

  IF p_target_club_id IS NOT NULL THEN
    PERFORM 1 FROM public.clubs WHERE id=p_target_club_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Target club does not exist' USING ERRCODE='22023'; END IF;

    UPDATE public.profiles
    SET assigned_club_id=NULL,
        role=CASE WHEN role::text='club_admin' THEN 'student'::public.app_role ELSE role END
    WHERE assigned_club_id=p_target_club_id AND id<>p_target_user_id;
  END IF;

  UPDATE public.clubs SET assigned_admin_id=NULL
  WHERE assigned_admin_id=p_target_user_id
    AND (p_target_club_id IS NULL OR id<>p_target_club_id);

  UPDATE public.profiles
  SET role=db_role::public.app_role,
      assigned_club_id=p_target_club_id
  WHERE id=p_target_user_id;

  IF p_target_club_id IS NOT NULL THEN
    UPDATE public.clubs SET assigned_admin_id=p_target_user_id WHERE id=p_target_club_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.set_profile_role_and_club(uuid,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_profile_role_and_club(uuid,text,uuid) TO authenticated;

-- Audit role/club privilege changes made by this RPC or other authorized DB
-- paths. It writes only the confirmed audit columns and leaves audit RLS intact.
CREATE OR REPLACE FUNCTION public.cc_audit_profile_governance_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public, pg_temp
AS $$
DECLARE
  actor_mail text;
  actor_role_text text;
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role
     OR OLD.assigned_club_id IS DISTINCT FROM NEW.assigned_club_id THEN
    IF auth.uid() IS NULL THEN
      actor_mail := 'system';
      actor_role_text := 'SYSTEM';
    ELSE
      IF NOT public.cc_is_active_super_admin() THEN
        RAISE EXCEPTION 'Only an active Super Admin can change profile roles or club assignments'
          USING ERRCODE='42501';
      END IF;
      SELECT email, role::text INTO actor_mail, actor_role_text
      FROM public.profiles WHERE id=auth.uid();
    END IF;
    INSERT INTO public.audit_logs(action_type,actor_email,actor_role,target_identifier,details,ip_address)
    VALUES (
      CASE WHEN OLD.assigned_club_id IS DISTINCT FROM NEW.assigned_club_id THEN 'ADMIN_ASSIGNMENT' ELSE 'ROLE_UPDATE' END,
      actor_mail, actor_role_text, NEW.id::text,
      format('role %s -> %s; assigned_club_id %s -> %s', OLD.role, NEW.role, OLD.assigned_club_id, NEW.assigned_club_id),
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.cc_audit_profile_governance_change() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS cc_audit_profile_governance_change ON public.profiles;
CREATE TRIGGER cc_audit_profile_governance_change
AFTER UPDATE OF role, assigned_club_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.cc_audit_profile_governance_change();

NOTIFY pgrst, 'reload schema';
COMMIT;

-- POST-MIGRATION VERIFICATION (read-only):
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='profiles' ORDER BY ordinal_position;
-- SELECT role::text, count(*) FROM public.profiles GROUP BY 1 ORDER BY 1;
-- SELECT to_regprocedure('public.set_profile_role_and_club(uuid,text,uuid)') AS rpc,
--        to_regprocedure('public.cc_is_active_super_admin()') AS admin_helper;
-- SELECT pg_get_functiondef('public.is_super_admin()'::regprocedure);
-- SELECT tgname FROM pg_trigger WHERE tgrelid='public.profiles'::regclass AND NOT tgisinternal;
-- SELECT policyname, permissive, cmd, qual, with_check FROM pg_policies
-- WHERE schemaname='public' AND tablename IN ('profiles','audit_logs');
-- SELECT action_type, actor_email, actor_role, target_identifier, details, created_at
-- FROM public.audit_logs ORDER BY created_at DESC LIMIT 20;
