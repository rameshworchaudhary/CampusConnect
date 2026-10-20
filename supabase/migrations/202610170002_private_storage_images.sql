-- CampusConnect private image storage.
-- Review the preflight queries before running. This migration is additive for
-- announcements and replaces only the legacy CampusConnect Storage policies.
-- No SQL is executed by the frontend and no bucket is made public.

-- PREFLIGHT (run separately and inspect every returned row):
-- SELECT id, name, public, file_size_limit, allowed_mime_types
-- FROM storage.buckets
-- WHERE id IN ('avatars','event-posters','club-logos','announcement-images');
-- SELECT policyname, cmd, roles, qual, with_check
-- FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
-- ORDER BY policyname;
-- SELECT c.relname, c.relrowsecurity FROM pg_class c
-- JOIN pg_namespace n ON n.oid=c.relnamespace
-- WHERE (n.nspname='storage' AND c.relname='objects')
--    OR (n.nspname='public' AND c.relname IN ('profiles','clubs','events','announcements'));
-- SELECT role::text, count(*) FROM public.profiles GROUP BY role::text ORDER BY 1;
-- SELECT pg_get_functiondef('public.is_super_admin()'::regprocedure),
--        pg_get_functiondef('public.cc_is_active_super_admin()'::regprocedure);
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name IN ('clubs','events','announcements')
-- ORDER BY table_name, ordinal_position;

BEGIN;

DO $$
DECLARE
  event_published_col text;
  club_approved_expr text;
  announcement_published_col text;
BEGIN
  IF to_regclass('storage.objects') IS NULL
     OR to_regclass('public.profiles') IS NULL
     OR to_regclass('public.events') IS NULL
     OR to_regclass('public.clubs') IS NULL
     OR to_regclass('public.announcements') IS NULL THEN
    RAISE EXCEPTION 'Storage migration prerequisite missing: public.events, public.clubs, and public.announcements must exist';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'storage.objects'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.profiles'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.clubs'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.events'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.announcements'::regclass) THEN
    RAISE EXCEPTION 'RLS prerequisite failed: expected RLS enabled on storage.objects and CampusConnect image-linked tables';
  END IF;
  IF to_regprocedure('public.cc_is_active_super_admin()') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='assigned_club_id') THEN
    RAISE EXCEPTION 'Lowercase-role governance prerequisites are missing; apply and verify the profile role governance migration first';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='events' AND column_name='poster_path') THEN
    RAISE EXCEPTION 'Storage migration prerequisite missing: events.poster_path; inspect the live event schema first';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clubs' AND column_name='logo_path') THEN
    RAISE EXCEPTION 'Storage migration prerequisite missing: clubs.logo_path; inspect the live club schema first';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='events' AND column_name='published') THEN
    event_published_col := 'published';
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='events' AND column_name='is_published') THEN
    event_published_col := 'is_published';
  ELSE
    RAISE EXCEPTION 'Storage migration prerequisite missing: events.published or events.is_published';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clubs' AND column_name='status') THEN
    club_approved_expr := 'lower(c.status::text) = ''approved''';
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clubs' AND column_name='approval_status') THEN
    club_approved_expr := 'lower(c.approval_status::text) = ''approved''';
  ELSE
    RAISE EXCEPTION 'Storage migration prerequisite missing: clubs.status or clubs.approval_status';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clubs' AND column_name='is_published') THEN
    club_approved_expr := club_approved_expr || ' AND c.is_published';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='announcements' AND column_name='published') THEN
    announcement_published_col := 'published';
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='announcements' AND column_name='is_active') THEN
    announcement_published_col := 'is_active';
  ELSE
    RAISE EXCEPTION 'Storage migration prerequisite missing: announcements.published or announcements.is_active';
  END IF;

  ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS image_path text;

  -- Older app builds persisted public Storage URLs rather than object paths.
  -- Normalize those references in place before the buckets become private.
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='avatar_url') THEN
    UPDATE public.profiles
    SET avatar_url = split_part(regexp_replace(avatar_url, '^https?://[^/]+/storage/v1/object/(public|sign|authenticated)/avatars/', ''), '?', 1)
    WHERE avatar_url ~* '^https?://[^/]+/storage/v1/object/(public|sign|authenticated)/avatars/';
  END IF;
  UPDATE public.clubs
  SET logo_path = split_part(regexp_replace(logo_path, '^https?://[^/]+/storage/v1/object/(public|sign|authenticated)/club-logos/', ''), '?', 1)
  WHERE logo_path ~* '^https?://[^/]+/storage/v1/object/(public|sign|authenticated)/club-logos/';
  UPDATE public.events
  SET poster_path = split_part(regexp_replace(poster_path, '^https?://[^/]+/storage/v1/object/(public|sign|authenticated)/event-posters/', ''), '?', 1)
  WHERE poster_path ~* '^https?://[^/]+/storage/v1/object/(public|sign|authenticated)/event-posters/';

  -- Use the checked-in lowercase app_role model and the verified active-admin
  -- helper. Do not depend on legacy role comparisons in is_club_admin_for().
  CREATE OR REPLACE FUNCTION public.cc_can_manage_storage_folder(folder text)
  RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER
  SET search_path=public, pg_temp
  AS $function$
  DECLARE folder_uuid uuid;
  BEGIN
    IF auth.uid() IS NULL THEN RETURN false; END IF;
    IF public.cc_is_active_super_admin() THEN RETURN true; END IF;
    BEGIN
      folder_uuid := folder::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN false;
    END;
    RETURN EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id=auth.uid() AND p.role::text='club_admin'
        AND p.assigned_club_id=folder_uuid
        AND COALESCE((to_jsonb(p)->>'is_active')::boolean, true)
    );
  END;
  $function$;
  REVOKE ALL ON FUNCTION public.cc_can_manage_storage_folder(text) FROM PUBLIC, anon;
  -- The SELECT policy is also evaluated for anon. The helper returns false
  -- whenever auth.uid() is null, so granting execution does not expose data.
  GRANT EXECUTE ON FUNCTION public.cc_can_manage_storage_folder(text) TO anon, authenticated;

  -- Remove the public read policies checked into schema.sql and known broad
  -- upload policies superseded by security_stabilization.sql.
  DROP POLICY IF EXISTS "Public Access for club-logos" ON storage.objects;
  DROP POLICY IF EXISTS "Public Access for event-posters" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload club logos" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload event posters" ON storage.objects;
  DROP POLICY IF EXISTS "Authorized users can update club logos" ON storage.objects;
  DROP POLICY IF EXISTS "Authorized users can delete club logos" ON storage.objects;
  DROP POLICY IF EXISTS "Authorized users can update event posters" ON storage.objects;
  DROP POLICY IF EXISTS "Authorized users can delete event posters" ON storage.objects;
  DROP POLICY IF EXISTS "Users upload authorized campus images" ON storage.objects;
  DROP POLICY IF EXISTS "Users update authorized campus images" ON storage.objects;
  DROP POLICY IF EXISTS "Users delete authorized campus images" ON storage.objects;
  DROP POLICY IF EXISTS "Users read their own avatars" ON storage.objects;
  DROP POLICY IF EXISTS "CampusConnect read authorized private images" ON storage.objects;
  DROP POLICY IF EXISTS "CampusConnect upload authorized private images" ON storage.objects;
  DROP POLICY IF EXISTS "CampusConnect update authorized private images" ON storage.objects;
  DROP POLICY IF EXISTS "CampusConnect delete authorized private images" ON storage.objects;

  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES
    ('avatars', 'avatars', false, 5242880, ARRAY['image/jpeg','image/png','image/webp']),
    ('event-posters', 'event-posters', false, 5242880, ARRAY['image/jpeg','image/png','image/webp']),
    ('club-logos', 'club-logos', false, 5242880, ARRAY['image/jpeg','image/png','image/webp']),
    ('announcement-images', 'announcement-images', false, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

  EXECUTE format($policy$
    CREATE POLICY "CampusConnect read authorized private images"
    ON storage.objects FOR SELECT TO anon, authenticated
    USING (
      (bucket_id = 'avatars' AND auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = auth.uid()::text)
      OR (bucket_id IN ('event-posters','club-logos','announcement-images') AND auth.uid() IS NOT NULL
        AND ((storage.foldername(name))[1] = auth.uid()::text
          OR public.cc_can_manage_storage_folder((storage.foldername(name))[1])))
      OR (bucket_id = 'event-posters' AND EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.poster_path = storage.objects.name AND e.%I IS TRUE
          AND (e.club_id IS NULL OR EXISTS (
            SELECT 1 FROM public.clubs c WHERE c.id = e.club_id AND %s
          ))
      ))
      OR (bucket_id = 'club-logos' AND EXISTS (
        SELECT 1 FROM public.clubs c
        WHERE c.logo_path = storage.objects.name AND %s
      ))
      OR (bucket_id = 'announcement-images' AND EXISTS (
        SELECT 1 FROM public.announcements a
        WHERE a.image_path = storage.objects.name AND a.%I IS TRUE
          AND (a.club_id IS NULL OR EXISTS (
            SELECT 1 FROM public.clubs c WHERE c.id = a.club_id AND %s
          ))
      ))
    )
  $policy$,
    event_published_col, club_approved_expr, club_approved_expr,
    announcement_published_col, club_approved_expr
  );

  CREATE POLICY "CampusConnect upload authorized private images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('avatars','event-posters','club-logos','announcement-images')
    AND (
      (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
      OR (bucket_id <> 'avatars' AND (
        (storage.foldername(name))[1] = (SELECT auth.uid())::text
        OR public.cc_can_manage_storage_folder((storage.foldername(name))[1])
      ))
    )
  );

  CREATE POLICY "CampusConnect update authorized private images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('avatars','event-posters','club-logos','announcement-images')
    AND (
      (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
      OR (bucket_id <> 'avatars' AND (
        (storage.foldername(name))[1] = (SELECT auth.uid())::text
        OR public.cc_can_manage_storage_folder((storage.foldername(name))[1])
      ))
    )
  )
  WITH CHECK (
    bucket_id IN ('avatars','event-posters','club-logos','announcement-images')
    AND (
      (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
      OR (bucket_id <> 'avatars' AND (
        (storage.foldername(name))[1] = (SELECT auth.uid())::text
        OR public.cc_can_manage_storage_folder((storage.foldername(name))[1])
      ))
    )
  );

  CREATE POLICY "CampusConnect delete authorized private images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id IN ('avatars','event-posters','club-logos','announcement-images')
    AND (
      (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
      OR (bucket_id <> 'avatars' AND (
        (storage.foldername(name))[1] = (SELECT auth.uid())::text
        OR public.cc_can_manage_storage_folder((storage.foldername(name))[1])
      ))
    )
  );
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;

-- POST-MIGRATION VERIFICATION (run separately):
-- SELECT id, name, public, file_size_limit, allowed_mime_types
-- FROM storage.buckets
-- WHERE id IN ('avatars','event-posters','club-logos','announcement-images') ORDER BY id;
-- SELECT policyname, cmd, roles, qual, with_check FROM pg_policies
-- WHERE schemaname='storage' AND tablename='objects' ORDER BY policyname;
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='announcements' AND column_name='image_path';
-- SELECT id, role FROM public.profiles ORDER BY created_at;
