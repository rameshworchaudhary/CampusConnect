-- Ordered prerequisite for profile_role_governance_alignment.sql.
-- Extend the existing lowercase enum without rewriting existing role values.
BEGIN;
DO $$
BEGIN
  IF to_regtype('public.app_role') IS NULL THEN
    RAISE EXCEPTION 'Expected public.app_role; inspect the live schema before continuing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid=e.enumtypid
    JOIN pg_namespace n ON n.oid=t.typnamespace
    WHERE n.nspname='public' AND t.typname='app_role' AND e.enumlabel='student'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid=e.enumtypid
    JOIN pg_namespace n ON n.oid=t.typnamespace
    WHERE n.nspname='public' AND t.typname='app_role' AND e.enumlabel='admin'
  ) THEN
    RAISE EXCEPTION 'Expected lowercase student and admin labels in public.app_role; no role values were changed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid=e.enumtypid
    JOIN pg_namespace n ON n.oid=t.typnamespace
    WHERE n.nspname='public' AND t.typname='app_role' AND e.enumlabel='club_admin'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'club_admin';
  END IF;
END;
$$;
COMMIT;
