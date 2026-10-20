-- Restore safe self-service profile edits when the live UPDATE policy is
-- missing or incomplete. This does not disable RLS or permit self-promotion.
-- Run in Supabase SQL Editor after reviewing the public.profiles policies.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'public.profiles does not exist';
  END IF;
  IF NOT (SELECT c.relrowsecurity FROM pg_class c
          WHERE c.oid='public.profiles'::regclass) THEN
    RAISE EXCEPTION 'RLS is not enabled on public.profiles; inspect the live security setup before applying this repair';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='assigned_club_id'
  ) THEN
    RAISE EXCEPTION 'profiles.assigned_club_id is missing; apply the profile governance migration first';
  END IF;
END;
$$;

-- Compare proposed privilege fields with the persisted row without recursively
-- evaluating profiles RLS. Missing is_active is treated as active for installs
-- whose confirmed profile schema has no account-state column.
CREATE OR REPLACE FUNCTION public.cc_profile_privileges_unchanged(
  target_profile_id uuid,
  proposed_role text,
  proposed_club_id uuid,
  proposed_is_active boolean
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=public, pg_temp
AS $$
  SELECT (target_profile_id <> auth.uid() AND public.cc_is_active_super_admin())
    OR EXISTS (
      SELECT 1 FROM public.profiles existing
      WHERE existing.id=target_profile_id
        AND existing.id=auth.uid()
        AND COALESCE((to_jsonb(existing)->>'is_active')::boolean, true)=true
        AND existing.role::text IS NOT DISTINCT FROM proposed_role
        AND existing.assigned_club_id IS NOT DISTINCT FROM proposed_club_id
        AND COALESCE((to_jsonb(existing)->>'is_active')::boolean, true)
            IS NOT DISTINCT FROM proposed_is_active
    );
$$;
REVOKE ALL ON FUNCTION public.cc_profile_privileges_unchanged(uuid,text,uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cc_profile_privileges_unchanged(uuid,text,uuid,boolean) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles'
      AND policyname='cc_profiles_self_or_super_admin_update'
  ) THEN
    CREATE POLICY cc_profiles_self_or_super_admin_update
    ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated
    USING (id=auth.uid() OR public.cc_is_active_super_admin())
    WITH CHECK (id=auth.uid() OR public.cc_is_active_super_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles'
      AND policyname='cc_profiles_privilege_change_guard'
  ) THEN
    CREATE POLICY cc_profiles_privilege_change_guard
    ON public.profiles AS RESTRICTIVE FOR UPDATE TO authenticated
    USING (id=auth.uid() OR public.cc_is_active_super_admin())
    WITH CHECK (
      public.cc_profile_privileges_unchanged(
        id,
        role::text,
        assigned_club_id,
        COALESCE((to_jsonb(profiles)->>'is_active')::boolean, true)
      )
    );
  END IF;
END;
$$;

COMMIT;

-- Verify (read-only):
-- SELECT policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies WHERE schemaname='public' AND tablename='profiles';
