-- CampusConnect private Storage policies for event, club, and announcement images.
-- This migration does not alter any avatars bucket or avatar Storage policy.
-- It assumes the verified lowercase roles: student, club_admin, admin.

-- PREFLIGHT (run separately and review before applying):
-- SELECT id, name, public, file_size_limit, allowed_mime_types
-- FROM storage.buckets
-- WHERE id IN ('avatars','event-posters','club-logos','announcement-images')
-- ORDER BY id;
-- SELECT policyname, cmd, roles, qual, with_check
-- FROM pg_policies
-- WHERE schemaname='storage' AND tablename='objects'
-- ORDER BY policyname;
-- Parent-table anon SELECT policy definitions must also be reviewed. They must
-- allow published events/announcements and approved published clubs only.
-- SELECT tablename, policyname, roles, qual FROM pg_policies
-- WHERE schemaname='public' AND tablename IN ('events','clubs','announcements')
--   AND cmd='SELECT' AND ('anon'=ANY(roles) OR 'public'=ANY(roles))
-- ORDER BY tablename, policyname;
-- SELECT table_name, column_name, data_type, udt_name
-- FROM information_schema.columns
-- WHERE table_schema='public'
--   AND table_name IN ('profiles','clubs','events','announcements')
-- ORDER BY table_name, ordinal_position;
-- SELECT role::text, count(*) FROM public.profiles GROUP BY role::text ORDER BY 1;
-- SELECT pg_get_functiondef('public.cc_is_active_super_admin()'::regprocedure);
-- SELECT c.relname, c.relrowsecurity
-- FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
-- WHERE (n.nspname='storage' AND c.relname='objects')
--    OR (n.nspname='public' AND c.relname IN ('profiles','clubs','events','announcements'));

BEGIN;

DO $$
DECLARE
  event_published_col text;
  announcement_published_col text;
  club_approved_expr text;
BEGIN
  IF to_regclass('storage.objects') IS NULL
     OR to_regclass('public.profiles') IS NULL
     OR to_regclass('public.clubs') IS NULL
     OR to_regclass('public.events') IS NULL
     OR to_regclass('public.announcements') IS NULL THEN
    RAISE EXCEPTION 'Storage migration prerequisite missing: expected storage.objects and public CampusConnect image tables';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='storage.objects'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.profiles'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.clubs'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.events'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.announcements'::regclass) THEN
    RAISE EXCEPTION 'Expected RLS enabled on storage.objects and public image-linked tables; migration will not change RLS state';
  END IF;

  IF to_regprocedure('public.cc_is_active_super_admin()') IS NULL THEN
    RAISE EXCEPTION 'public.cc_is_active_super_admin() is missing; apply the verified governance migration first';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='assigned_club_id' AND data_type='uuid'
  ) THEN
    RAISE EXCEPTION 'Expected profiles.assigned_club_id uuid; inspect the live profile schema';
  END IF;

  -- Parent tables must have anon SELECT policies so correlated Storage
  -- lookups can see published records. Review their USING clauses in preflight;
  -- this migration does not alter parent-table RLS policies.
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='public'
    AND tablename='events' AND cmd='SELECT' AND ('anon'=ANY(roles) OR 'public'=ANY(roles)))
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='public'
    AND tablename='clubs' AND cmd='SELECT' AND ('anon'=ANY(roles) OR 'public'=ANY(roles)))
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='public'
    AND tablename='announcements' AND cmd='SELECT' AND ('anon'=ANY(roles) OR 'public'=ANY(roles))) THEN
    RAISE EXCEPTION 'Anonymous SELECT policies are missing on image parent tables; inspect/repair separately.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clubs' AND column_name='logo_path')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='events' AND column_name='poster_path') THEN
    RAISE EXCEPTION 'Expected clubs.logo_path and events.poster_path; inspect the live schema';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='events' AND column_name='club_id')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clubs' AND column_name='id')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='announcements' AND column_name='club_id') THEN
    RAISE EXCEPTION 'Expected club relationship columns for public image visibility; inspect the live schema';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='events' AND column_name='published') THEN
    event_published_col := 'published';
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='events' AND column_name='is_published') THEN
    event_published_col := 'is_published';
  ELSE
    RAISE EXCEPTION 'Expected events.published or events.is_published; inspect the live schema';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clubs' AND column_name='status') THEN
    club_approved_expr := 'lower(c.status::text) = ''approved''';
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clubs' AND column_name='approval_status') THEN
    club_approved_expr := 'lower(c.approval_status::text) = ''approved''';
  ELSE
    RAISE EXCEPTION 'Expected clubs.status or clubs.approval_status; inspect the live schema';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clubs' AND column_name='is_published') THEN
    club_approved_expr := club_approved_expr || ' AND c.is_published IS TRUE';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='announcements' AND column_name='published') THEN
    announcement_published_col := 'published';
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='announcements' AND column_name='is_active') THEN
    announcement_published_col := 'is_active';
  ELSE
    RAISE EXCEPTION 'Expected announcements.published or announcements.is_active; inspect the live schema';
  END IF;

  -- Confirmed absent in the live database. This adds only the nullable image reference.
  ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS image_path text;

  -- This helper recognizes the existing lowercase role model. Club admins can
  -- manage only their assigned club UUID folder; the active admin can manage
  -- any folder. Student ownership is handled only
  -- for club-logo uploads in bucket-specific policy predicates below.
  CREATE OR REPLACE FUNCTION public.cc_can_manage_storage_folder(folder text)
  RETURNS boolean
  LANGUAGE plpgsql STABLE SECURITY DEFINER
  SET search_path=''
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
      SELECT 1
      FROM public.profiles p
      WHERE p.id=auth.uid()
        AND COALESCE((pg_catalog.to_jsonb(p)->>'is_active')::boolean, true)
        AND p.role::text='club_admin'
        AND p.assigned_club_id=folder_uuid
    );
  END;
  $function$;
  REVOKE ALL ON FUNCTION public.cc_can_manage_storage_folder(text) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.cc_can_manage_storage_folder(text) TO authenticated;

  -- Drop/recreate only this migration's named policies. No avatar or unrelated
  -- Storage policies are changed. The verified live preflight says other
  -- non-avatar Storage policies do not currently exist.
  DROP POLICY IF EXISTS "CC 170003 public published image reads" ON storage.objects;
  DROP POLICY IF EXISTS "CC 170003 authenticated image reads" ON storage.objects;
  DROP POLICY IF EXISTS "CC 170003 image uploads" ON storage.objects;
  DROP POLICY IF EXISTS "CC 170003 image updates" ON storage.objects;
  DROP POLICY IF EXISTS "CC 170003 image deletes" ON storage.objects;

  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES
    ('event-posters','event-posters',false,5242880,ARRAY['image/jpeg','image/png','image/webp']),
    ('club-logos','club-logos',false,5242880,ARRAY['image/jpeg','image/png','image/webp']),
    ('announcement-images','announcement-images',false,5242880,ARRAY['image/jpeg','image/png','image/webp'])
  ON CONFLICT (id) DO UPDATE SET
    -- Only these explicitly requested settings are normalized on conflict;
    -- bucket name, owner, and all other bucket metadata remain unchanged.
    public=false,
    file_size_limit=EXCLUDED.file_size_limit,
    allowed_mime_types=EXCLUDED.allowed_mime_types;

  -- Anonymous visibility is limited to an image path referenced by a published
  -- event/announcement or an approved club. Existing table RLS still applies.
  EXECUTE format($policy$
    CREATE POLICY "CC 170003 public published image reads"
    ON storage.objects FOR SELECT TO anon
    USING (
      (bucket_id='event-posters' AND EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.poster_path=storage.objects.name AND e.%I IS TRUE
          AND (e.club_id IS NULL OR EXISTS (
            SELECT 1 FROM public.clubs c WHERE c.id=e.club_id AND %s
          ))
      ))
      OR (bucket_id='club-logos' AND EXISTS (
        SELECT 1 FROM public.clubs c WHERE c.logo_path=storage.objects.name AND %s
      ))
      OR (bucket_id='announcement-images' AND EXISTS (
        SELECT 1 FROM public.announcements a
        WHERE a.image_path=storage.objects.name AND a.%I IS TRUE
          AND (a.club_id IS NULL OR EXISTS (
            SELECT 1 FROM public.clubs c WHERE c.id=a.club_id AND %s
          ))
      ))
    )
  $policy$,
    event_published_col, club_approved_expr, club_approved_expr,
    announcement_published_col, club_approved_expr
  );

  EXECUTE format($policy$
    CREATE POLICY "CC 170003 authenticated image reads"
    ON storage.objects FOR SELECT TO authenticated
    USING (
    bucket_id IN ('event-posters','club-logos','announcement-images')
    AND (
      public.cc_can_manage_storage_folder((storage.foldername(name))[1])
      OR (bucket_id='event-posters' AND EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.poster_path=storage.objects.name AND e.%I IS TRUE
          AND (e.club_id IS NULL OR EXISTS (
            SELECT 1 FROM public.clubs c WHERE c.id=e.club_id AND %s
          ))
      ))
      OR (bucket_id='club-logos' AND EXISTS (
        SELECT 1 FROM public.clubs c WHERE c.logo_path=storage.objects.name AND %s
      ))
      OR (bucket_id='announcement-images' AND EXISTS (
        SELECT 1 FROM public.announcements a
        WHERE a.image_path=storage.objects.name AND a.%I IS TRUE
          AND (a.club_id IS NULL OR EXISTS (
            SELECT 1 FROM public.clubs c WHERE c.id=a.club_id AND %s
          ))
      ))
    )
    )
  $policy$,
    event_published_col, club_approved_expr, club_approved_expr,
    announcement_published_col, club_approved_expr
  );

  CREATE POLICY "CC 170003 image uploads"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('event-posters','club-logos','announcement-images')
    AND (
      public.cc_can_manage_storage_folder((storage.foldername(name))[1])
      OR (bucket_id='club-logos' AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id=auth.uid() AND p.role::text='student'
          AND (storage.foldername(name))[1]=p.id::text
      ))
    )
  );

  CREATE POLICY "CC 170003 image updates"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('event-posters','club-logos','announcement-images')
    AND (
      public.cc_can_manage_storage_folder((storage.foldername(name))[1])
      OR (bucket_id='club-logos' AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id=auth.uid() AND p.role::text='student'
          AND (storage.foldername(name))[1]=p.id::text
      ))
    )
  )
  WITH CHECK (
    bucket_id IN ('event-posters','club-logos','announcement-images')
    AND (
      public.cc_can_manage_storage_folder((storage.foldername(name))[1])
      OR (bucket_id='club-logos' AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id=auth.uid() AND p.role::text='student'
          AND (storage.foldername(name))[1]=p.id::text
      ))
    )
  );

  CREATE POLICY "CC 170003 image deletes"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id IN ('event-posters','club-logos','announcement-images')
    AND (
      public.cc_can_manage_storage_folder((storage.foldername(name))[1])
      OR (bucket_id='club-logos' AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id=auth.uid() AND p.role::text='student'
          AND (storage.foldername(name))[1]=p.id::text
      ))
    )
  );
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;

-- POST-MIGRATION VERIFICATION (run separately):
-- SELECT id, name, public, file_size_limit, allowed_mime_types
-- FROM storage.buckets
-- WHERE id IN ('avatars','event-posters','club-logos','announcement-images')
-- ORDER BY id;
-- SELECT policyname, cmd, roles, qual, with_check
-- FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
-- ORDER BY policyname;
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='announcements' AND column_name='image_path';
-- SELECT c.relname, c.relrowsecurity FROM pg_class c
-- JOIN pg_namespace n ON n.oid=c.relnamespace
-- WHERE (n.nspname='storage' AND c.relname='objects')
--    OR (n.nspname='public' AND c.relname IN ('profiles','clubs','events','announcements'));
-- SELECT role::text, count(*) FROM public.profiles GROUP BY role::text ORDER BY 1;
