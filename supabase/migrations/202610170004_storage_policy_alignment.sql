-- Review-only correction for the verified CampusConnect production baseline.
-- Do not run `supabase db push` until the empty remote migration history and
-- older schema-incompatible migrations have been reconciled separately.
-- This file intentionally fails closed if the live Storage policy inventory,
-- bucket configuration, privileges, or parent SELECT policies have drifted.

-- PREFLIGHT (run separately; inspect the returned definitions and data):
-- SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets
-- WHERE id IN ('avatars','event-posters','club-logos','announcement-images') ORDER BY id;
-- SELECT policyname, cmd, roles, qual, with_check FROM pg_policies
-- WHERE schemaname='storage' AND tablename='objects' ORDER BY policyname;
-- SELECT table_name, column_name, data_type FROM information_schema.columns
-- WHERE table_schema='public' AND table_name IN ('profiles','clubs','events','announcements')
-- ORDER BY table_name, ordinal_position;
-- SELECT pg_get_functiondef('public.cc_is_active_super_admin()'::regprocedure);
-- SELECT tablename, policyname, roles, qual FROM pg_policies
-- WHERE schemaname='public' AND tablename IN ('clubs','events','announcements')
-- AND cmd='SELECT' AND ('anon'=ANY(roles) OR 'public'=ANY(roles)) ORDER BY tablename, policyname;

BEGIN;

-- The live application uses these nullable fields. Defaults preserve old rows;
-- account status defaults active so existing accounts remain enabled.
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS image_path text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS meeting_schedule text;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS meeting_location text;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS faculty_advisor text;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS contact_phone text;
-- The existing Super Admin UI creates campus platform events without a club.
ALTER TABLE public.events ALTER COLUMN club_id DROP NOT NULL;

DO $$
BEGIN
  IF to_regclass('storage.objects') IS NULL
     OR to_regclass('public.profiles') IS NULL
     OR to_regclass('public.clubs') IS NULL
     OR to_regclass('public.events') IS NULL
     OR to_regclass('public.announcements') IS NULL
     OR to_regclass('public.club_memberships') IS NULL
     OR to_regclass('public.event_registrations') IS NULL
     OR to_regclass('public.user_announcement_reads') IS NULL
     OR to_regclass('public.audit_logs') IS NULL THEN
    RAISE EXCEPTION 'Compatibility migration requires storage.objects and every verified CampusConnect RLS table';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='storage.objects'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.profiles'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.clubs'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.events'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.announcements'::regclass) THEN
    RAISE EXCEPTION 'Expected RLS enabled on storage.objects and all image-linked tables';
  END IF;
  IF to_regprocedure('auth.uid()') IS NULL THEN
    RAISE EXCEPTION 'Supabase auth.uid() is missing; inspect the live project before applying';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='id')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='role')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='assigned_club_id')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clubs' AND column_name='id')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clubs' AND column_name='assigned_admin_id')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clubs' AND column_name='status')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clubs' AND column_name='logo_path')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='events' AND column_name='club_id')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='events' AND column_name='poster_path')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='events' AND column_name='published')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='announcements' AND column_name='club_id')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='announcements' AND column_name='published') THEN
    RAISE EXCEPTION 'Expected verified image columns are missing; inspect the live schema before applying';
  END IF;
  IF to_regprocedure('public.handle_new_user()') IS NULL
     OR to_regprocedure('public.ensure_own_profile()') IS NULL
     OR to_regprocedure('public.cc_profile_privileges_unchanged(uuid,text,uuid,boolean)') IS NULL THEN
    RAISE EXCEPTION 'Verified profile trigger/helper functions are missing; inspect profile creation and status policies before applying.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND (
      (table_name='announcements' AND column_name='image_path' AND data_type <> 'text')
      OR (table_name='profiles' AND column_name='is_active' AND data_type <> 'boolean')
      OR (table_name='clubs' AND column_name IN ('meeting_schedule','meeting_location','faculty_advisor','contact_email','contact_phone') AND data_type <> 'text')
    )
  ) OR EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='is_active'
      AND (is_nullable <> 'NO' OR column_default IS NULL)
  ) THEN
    RAISE EXCEPTION 'Compatibility columns exist with unexpected types; inspect before applying policies';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND (
      (table_name='profiles' AND column_name IN ('id','assigned_club_id') AND data_type <> 'uuid')
      OR (table_name='clubs' AND column_name IN ('id','assigned_admin_id') AND data_type <> 'uuid')
      OR (table_name='events' AND column_name IN ('club_id') AND data_type <> 'uuid')
      OR (table_name='announcements' AND column_name IN ('club_id') AND data_type <> 'uuid')
      OR (table_name='events' AND column_name='published' AND data_type <> 'boolean')
      OR (table_name='announcements' AND column_name='published' AND data_type <> 'boolean')
    ) THEN
    RAISE EXCEPTION 'Image authorization columns have unexpected types; inspect the live schema before applying';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='events' AND column_name='club_id' AND is_nullable <> 'YES') THEN
    RAISE EXCEPTION 'events.club_id must be nullable for the existing campus platform event workflow';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='public' AND tablename='events' AND cmd='SELECT' AND ('anon'=ANY(roles) OR 'public'=ANY(roles)))
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='public' AND tablename='clubs' AND cmd='SELECT' AND ('anon'=ANY(roles) OR 'public'=ANY(roles)))
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='public' AND tablename='announcements' AND cmd='SELECT' AND ('anon'=ANY(roles) OR 'public'=ANY(roles))) THEN
    RAISE EXCEPTION 'Anonymous SELECT policies are missing on parent tables; inspect/repair parent RLS separately';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='public' AND tablename='events' AND policyname='View published events' AND cmd='SELECT' AND roles @> ARRAY['anon','authenticated']::name[]) THEN
    RAISE EXCEPTION 'The verified events.View published events policy has changed; review its exact predicate before replacing it.';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname='storage' AND tablename='objects') <> 3
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users read their own avatars' AND cmd='SELECT' AND roles=ARRAY['authenticated']::name[] AND qual='((bucket_id = ''avatars''::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text))')
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can upload their own avatars' AND cmd='INSERT' AND roles=ARRAY['authenticated']::name[] AND with_check='((bucket_id = ''avatars''::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text))')
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can update their own avatars' AND cmd='UPDATE' AND roles=ARRAY['authenticated']::name[] AND qual='((bucket_id = ''avatars''::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text))' AND with_check='((bucket_id = ''avatars''::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text))') THEN
    RAISE EXCEPTION 'Storage policy inventory differs from the three verified own-avatar policies; review exact live names and definitions before applying.';
  END IF;
  IF (SELECT count(*) FROM storage.buckets WHERE id IN ('avatars','event-posters','club-logos','announcement-images')) <> 4
     OR EXISTS (SELECT 1 FROM storage.buckets WHERE id IN ('avatars','event-posters','club-logos','announcement-images') AND (public IS DISTINCT FROM false OR file_size_limit IS DISTINCT FROM 5242880 OR allowed_mime_types IS DISTINCT FROM ARRAY['image/jpeg','image/png','image/webp']::text[])) THEN
    RAISE EXCEPTION 'Expected four existing private 5 MiB image buckets; inspect bucket settings instead of changing them automatically.';
  END IF;
  IF NOT has_schema_privilege('anon','storage','USAGE') OR NOT has_schema_privilege('authenticated','storage','USAGE')
     OR NOT has_table_privilege('anon','storage.objects','SELECT')
     OR NOT has_table_privilege('authenticated','storage.objects','SELECT')
     OR NOT has_table_privilege('authenticated','storage.objects','INSERT')
     OR NOT has_table_privilege('authenticated','storage.objects','UPDATE')
     OR NOT has_table_privilege('authenticated','storage.objects','DELETE') THEN
    RAISE EXCEPTION 'Required Supabase Storage API privileges are absent; have an administrator review existing grants separately.';
  END IF;
END $$;

-- Enforce status in every authenticated data path. RLS restrictive policies
-- compose with (AND) the existing per-feature permissive policies.
CREATE OR REPLACE FUNCTION public.cc_is_active_user()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_active IS TRUE) $$;
REVOKE ALL ON FUNCTION public.cc_is_active_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cc_is_active_user() TO authenticated;

CREATE OR REPLACE FUNCTION public.cc_is_active_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.role::text='admin' AND p.is_active IS TRUE) $$;
REVOKE ALL ON FUNCTION public.cc_is_active_super_admin() FROM PUBLIC, anon;
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

-- Preserve profile fields collected at registration, including when the
-- sign-up confirmation flow has no authenticated client session yet.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  INSERT INTO public.profiles (id,full_name,email,role,student_id,department,is_active)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name',''), NULLIF(split_part(COALESCE(NEW.email,''),'@',1),''), 'Student'),
    NEW.email,
    'student'::public.app_role,
    NULLIF(NEW.raw_user_meta_data->>'student_id',''),
    NULLIF(NEW.raw_user_meta_data->>'department',''),
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_own_profile()
RETURNS public.profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  current_id uuid := auth.uid();
  user_email text;
  user_name text;
  user_student_id text;
  user_department text;
  result_profile public.profiles;
BEGIN
  IF current_id IS NULL THEN RAISE EXCEPTION 'You must be signed in to create a profile.'; END IF;
  SELECT u.email,
    COALESCE(NULLIF(u.raw_user_meta_data->>'full_name',''), NULLIF(split_part(COALESCE(u.email,''),'@',1),''), 'Student'),
    NULLIF(u.raw_user_meta_data->>'student_id',''),
    NULLIF(u.raw_user_meta_data->>'department','')
  INTO user_email,user_name,user_student_id,user_department
  FROM auth.users u WHERE u.id=current_id;
  IF NOT FOUND OR user_email IS NULL THEN RAISE EXCEPTION 'No matching Supabase Auth account with email was found.'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=current_id AND p.is_active IS FALSE) THEN
    RAISE EXCEPTION 'Your account has been deactivated. Please contact campus administration.' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.profiles (id,full_name,email,role,student_id,department,is_active)
  VALUES (current_id,user_name,user_email,'student'::public.app_role,user_student_id,user_department,true)
  ON CONFLICT (id) DO UPDATE SET
    student_id=COALESCE(public.profiles.student_id,EXCLUDED.student_id),
    department=COALESCE(public.profiles.department,EXCLUDED.department)
  RETURNING * INTO result_profile;
  RETURN result_profile;
END;
$$;

CREATE OR REPLACE FUNCTION public.cc_guard_club_admin_profile_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  IF public.cc_is_active_super_admin() THEN RETURN NEW; END IF;
  IF public.can_manage_club(OLD.id) AND (
    OLD.status IS DISTINCT FROM NEW.status
    OR OLD.assigned_admin_id IS DISTINCT FROM NEW.assigned_admin_id
    OR OLD.created_by IS DISTINCT FROM NEW.created_by
  ) THEN
    RAISE EXCEPTION 'Club admins may edit assigned-club details but cannot change approval or assignment fields.' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.cc_guard_club_admin_profile_update() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS cc_guard_club_admin_profile_update ON public.clubs;
CREATE TRIGGER cc_guard_club_admin_profile_update BEFORE UPDATE ON public.clubs
FOR EACH ROW EXECUTE FUNCTION public.cc_guard_club_admin_profile_update();

DROP POLICY IF EXISTS "Club admins update assigned club profile" ON public.clubs;
CREATE POLICY "Club admins update assigned club profile" ON public.clubs
FOR UPDATE TO authenticated USING (public.can_manage_club(id))
WITH CHECK (public.can_manage_club(id));

DROP POLICY IF EXISTS "Club admins create announcements" ON public.announcements;
CREATE POLICY "Club admins create announcements" ON public.announcements
FOR INSERT TO authenticated WITH CHECK (
  created_by=(SELECT auth.uid()) AND (
    (club_id IS NULL AND public.cc_is_active_super_admin())
    OR (club_id IS NOT NULL AND public.can_manage_club(club_id))
  )
);

-- The existing UI creates platform events with club_id NULL. Keep those
-- publicly visible only when explicitly marked as platform events and published.
DROP POLICY IF EXISTS "View published events" ON public.events;
CREATE POLICY "View published events" ON public.events
FOR SELECT TO anon, authenticated USING (
  (published IS TRUE AND (
    (club_id IS NULL AND is_platform_event IS TRUE)
    OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id=events.club_id AND c.status::text='approved')
  ))
  OR public.can_manage_club(club_id)
  OR created_by=(SELECT auth.uid())
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','clubs','events','announcements','club_memberships','event_registrations','user_announcement_reads','audit_logs'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.'||t)) THEN
      RAISE EXCEPTION 'RLS is not enabled on public.%; active-account guard was not installed', t;
    END IF;
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'CC active account guard', t);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.cc_is_active_user()) WITH CHECK (public.cc_is_active_user())', 'CC active account guard', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.cc_can_manage_storage_folder(folder text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=''
AS $function$
DECLARE folder_uuid uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.cc_is_active_user() THEN RETURN false; END IF;
  BEGIN
    folder_uuid := folder::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN false;
  END;
  RETURN public.can_manage_club(folder_uuid);
END;
$function$;
REVOKE ALL ON FUNCTION public.cc_can_manage_storage_folder(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cc_can_manage_storage_folder(text) TO authenticated;

  -- Normalize only known application-owned Storage policies. PostgreSQL
-- combines permissive policies with OR, so the older policy names must be
-- removed for the narrower rules below to take effect.
DROP POLICY IF EXISTS "Users read their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "CC 170004 public eligible image reads" ON storage.objects;
DROP POLICY IF EXISTS "CC 170004 authenticated image reads" ON storage.objects;
DROP POLICY IF EXISTS "CC 170004 authorized image uploads" ON storage.objects;
DROP POLICY IF EXISTS "CC 170004 authorized image updates" ON storage.objects;
DROP POLICY IF EXISTS "CC 170004 authorized image deletes" ON storage.objects;
DROP POLICY IF EXISTS "CC active account guard" ON storage.objects;
CREATE POLICY "CC active account guard" ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
USING (public.cc_is_active_user()) WITH CHECK (public.cc_is_active_user());

CREATE POLICY "CC 170004 public eligible image reads"
ON storage.objects FOR SELECT TO anon
USING (
  (bucket_id='event-posters' AND EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.poster_path=storage.objects.name AND e.published IS TRUE
      AND ((e.club_id IS NULL AND e.is_platform_event IS TRUE) OR EXISTS (
        SELECT 1 FROM public.clubs c WHERE c.id=e.club_id AND lower(c.status::text)='approved'
      ))
  ))
  OR (bucket_id='club-logos' AND EXISTS (
    SELECT 1 FROM public.clubs c
    WHERE c.logo_path=storage.objects.name AND lower(c.status::text)='approved'
  ))
  OR (bucket_id='announcement-images' AND EXISTS (
    SELECT 1 FROM public.announcements a
    WHERE a.image_path=storage.objects.name AND a.published IS TRUE
      AND (a.club_id IS NULL OR EXISTS (
        SELECT 1 FROM public.clubs c WHERE c.id=a.club_id AND lower(c.status::text)='approved'
      ))
  ))
);

CREATE POLICY "CC 170004 authenticated image reads"
ON storage.objects FOR SELECT TO authenticated
USING (
  (bucket_id='avatars' AND (storage.foldername(name))[1]=auth.uid()::text)
    OR (bucket_id IN ('event-posters','club-logos','announcement-images') AND (
    (storage.foldername(name))[1]=auth.uid()::text
    OR public.cc_can_manage_storage_folder((storage.foldername(name))[1])
    OR (bucket_id='event-posters' AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.poster_path=storage.objects.name AND e.published IS TRUE
        AND ((e.club_id IS NULL AND e.is_platform_event IS TRUE) OR EXISTS (
          SELECT 1 FROM public.clubs c WHERE c.id=e.club_id AND lower(c.status::text)='approved'
        ))
    ))
    OR (bucket_id='club-logos' AND EXISTS (
      SELECT 1 FROM public.clubs c WHERE c.logo_path=storage.objects.name AND lower(c.status::text)='approved'
    ))
    OR (bucket_id='announcement-images' AND EXISTS (
      SELECT 1 FROM public.announcements a
      WHERE a.image_path=storage.objects.name AND a.published IS TRUE
        AND (a.club_id IS NULL OR EXISTS (
          SELECT 1 FROM public.clubs c WHERE c.id=a.club_id AND lower(c.status::text)='approved'
        ))
    ))
  ))
);

CREATE POLICY "CC 170004 authorized image uploads"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  (bucket_id='avatars' AND (storage.foldername(name))[1]=auth.uid()::text)
  -- Students may submit a proposed logo only inside their own user folder.
  -- Once submitted, they cannot update or delete that object.
  OR (bucket_id='club-logos' AND (storage.foldername(name))[1]=auth.uid()::text AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role::text='student' AND p.is_active IS TRUE
  ))
  OR (bucket_id IN ('event-posters','club-logos','announcement-images')
      AND public.cc_can_manage_storage_folder((storage.foldername(name))[1]))
);

CREATE POLICY "CC 170004 authorized image updates"
ON storage.objects FOR UPDATE TO authenticated
USING (
  (bucket_id='avatars' AND (storage.foldername(name))[1]=auth.uid()::text)
  OR (bucket_id IN ('event-posters','club-logos','announcement-images')
      AND public.cc_can_manage_storage_folder((storage.foldername(name))[1]))
)
WITH CHECK (
  (bucket_id='avatars' AND (storage.foldername(name))[1]=auth.uid()::text)
  OR (bucket_id IN ('event-posters','club-logos','announcement-images')
      AND public.cc_can_manage_storage_folder((storage.foldername(name))[1]))
);

CREATE POLICY "CC 170004 authorized image deletes"
ON storage.objects FOR DELETE TO authenticated
USING (
  (bucket_id='avatars' AND (storage.foldername(name))[1]=auth.uid()::text)
  OR (bucket_id='club-logos' AND (storage.foldername(name))[1]=auth.uid()::text AND NOT EXISTS (
    SELECT 1 FROM public.clubs c WHERE c.logo_path=storage.objects.name
  ))
  OR (bucket_id IN ('event-posters','club-logos','announcement-images')
      AND public.cc_can_manage_storage_folder((storage.foldername(name))[1]))
);

NOTIFY pgrst, 'reload schema';
COMMIT;

-- POSTFLIGHT (run separately):
-- SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets
-- WHERE id IN ('avatars','event-posters','club-logos','announcement-images') ORDER BY id;
-- SELECT policyname, cmd, roles, qual, with_check FROM pg_policies
-- WHERE schemaname='storage' AND tablename='objects' ORDER BY policyname;
