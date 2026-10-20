-- Review proposal only. All four Storage buckets remain private.
-- Apply only after schema and authorization proposals pass staging checks.
BEGIN;

DO $$
BEGIN
  IF to_regclass('storage.objects') IS NULL OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='storage.objects'::regclass) THEN
    RAISE EXCEPTION 'Storage preflight failed: storage.objects is missing or RLS is disabled';
  END IF;
  IF to_regprocedure('public.cc_is_active_user()') IS NULL OR to_regprocedure('public.cc_is_active_super_admin()') IS NULL THEN
    RAISE EXCEPTION 'Storage preflight failed: active-account helpers are missing';
  END IF;
  IF (SELECT count(*) FROM storage.buckets WHERE id IN ('avatars','event-posters','club-logos','announcement-images'))<>4
     OR EXISTS (SELECT 1 FROM storage.buckets WHERE id IN ('avatars','event-posters','club-logos','announcement-images') AND public IS DISTINCT FROM false) THEN
    RAISE EXCEPTION 'Storage preflight failed: expected four existing private image buckets; do not change bucket visibility automatically';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects')<>3
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users read their own avatars' AND cmd='SELECT' AND roles=ARRAY['authenticated']::name[] AND qual='((bucket_id = ''avatars''::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text))')
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can upload their own avatars' AND cmd='INSERT' AND roles=ARRAY['authenticated']::name[] AND with_check='((bucket_id = ''avatars''::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text))')
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can update their own avatars' AND cmd='UPDATE' AND roles=ARRAY['authenticated']::name[] AND qual='((bucket_id = ''avatars''::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text))' AND with_check='((bucket_id = ''avatars''::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text))') THEN
    RAISE EXCEPTION 'Storage preflight failed: policy inventory differs from the verified three avatar policies; inspect names and expressions';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='events' AND cmd='SELECT' AND ('anon'=ANY(roles) OR 'public'=ANY(roles)) AND qual ILIKE '%published%')
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='clubs' AND cmd='SELECT' AND ('anon'=ANY(roles) OR 'public'=ANY(roles)) AND qual ILIKE '%approved%')
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='announcements' AND cmd='SELECT' AND ('anon'=ANY(roles) OR 'public'=ANY(roles)) AND qual ILIKE '%published%') THEN
    RAISE EXCEPTION 'Storage preflight failed: parent SELECT policies are missing or do not appear publication-aware; inspect exact definitions';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.cc_can_manage_storage_folder(folder text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE folder_uuid uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.cc_is_active_user() THEN RETURN false; END IF;
  IF public.cc_is_active_super_admin() THEN RETURN true; END IF;
  BEGIN folder_uuid:=folder::uuid;
  EXCEPTION WHEN invalid_text_representation THEN RETURN false;
  END;
  RETURN EXISTS (
    SELECT 1 FROM public.profiles p JOIN public.clubs c ON c.id=folder_uuid
    WHERE p.id=auth.uid() AND p.role::text='club_admin' AND p.is_active IS TRUE
      AND (p.assigned_club_id=folder_uuid OR c.assigned_admin_id=p.id)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.cc_can_manage_storage_folder(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cc_can_manage_storage_folder(text) TO authenticated;

-- This is restrictive for authenticated Storage access and does not change anon reads.
DROP POLICY IF EXISTS "CC active account guard" ON storage.objects;
CREATE POLICY "CC active account guard" ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
USING (public.cc_is_active_user()) WITH CHECK (public.cc_is_active_user());

DROP POLICY "Users read their own avatars" ON storage.objects;
DROP POLICY "Users can upload their own avatars" ON storage.objects;
DROP POLICY "Users can update their own avatars" ON storage.objects;

DROP POLICY IF EXISTS "CC public eligible referenced image reads" ON storage.objects;
DROP POLICY IF EXISTS "CC authenticated eligible image reads" ON storage.objects;
DROP POLICY IF EXISTS "CC authorized image inserts" ON storage.objects;
DROP POLICY IF EXISTS "CC authorized image updates" ON storage.objects;
DROP POLICY IF EXISTS "CC authorized image deletes" ON storage.objects;

CREATE POLICY "CC public eligible referenced image reads" ON storage.objects FOR SELECT TO anon USING (
  (bucket_id='event-posters' AND EXISTS (SELECT 1 FROM public.events e WHERE e.poster_path=objects.name AND e.published IS TRUE AND (
    (e.club_id IS NULL AND e.is_platform_event IS TRUE AND (storage.foldername(objects.name))[1]=e.created_by::text) OR
    (e.club_id IS NOT NULL AND (storage.foldername(objects.name))[1]=e.club_id::text AND EXISTS (SELECT 1 FROM public.clubs c WHERE c.id=e.club_id AND c.status::text='approved'))
  ))) OR
  (bucket_id='club-logos' AND EXISTS (SELECT 1 FROM public.clubs c WHERE c.logo_path=objects.name AND c.status::text='approved'
    AND (storage.foldername(objects.name))[1] IN (c.id::text,c.created_by::text))) OR
  (bucket_id='announcement-images' AND EXISTS (SELECT 1 FROM public.announcements a WHERE a.image_path=objects.name AND a.published IS TRUE AND (
    (a.club_id IS NULL AND (storage.foldername(objects.name))[1]=a.created_by::text) OR
    (a.club_id IS NOT NULL AND (storage.foldername(objects.name))[1]=a.club_id::text AND EXISTS (SELECT 1 FROM public.clubs c WHERE c.id=a.club_id AND c.status::text='approved'))
  )))
);

CREATE POLICY "CC authenticated eligible image reads" ON storage.objects FOR SELECT TO authenticated USING (
  (bucket_id='avatars' AND (storage.foldername(name))[1]=auth.uid()::text) OR
  (bucket_id IN ('event-posters','club-logos','announcement-images') AND (
    (storage.foldername(name))[1]=auth.uid()::text OR public.cc_can_manage_storage_folder((storage.foldername(name))[1]) OR
    (bucket_id='event-posters' AND EXISTS (SELECT 1 FROM public.events e WHERE e.poster_path=objects.name AND e.published IS TRUE AND (
      (e.club_id IS NULL AND e.is_platform_event IS TRUE AND (storage.foldername(objects.name))[1]=e.created_by::text) OR
      (e.club_id IS NOT NULL AND (storage.foldername(objects.name))[1]=e.club_id::text AND EXISTS (SELECT 1 FROM public.clubs c WHERE c.id=e.club_id AND c.status::text='approved'))
    ))) OR
    (bucket_id='club-logos' AND EXISTS (SELECT 1 FROM public.clubs c WHERE c.logo_path=objects.name AND c.status::text='approved'
      AND (storage.foldername(objects.name))[1] IN (c.id::text,c.created_by::text))) OR
    (bucket_id='announcement-images' AND EXISTS (SELECT 1 FROM public.announcements a WHERE a.image_path=objects.name AND a.published IS TRUE AND (
      (a.club_id IS NULL AND (storage.foldername(objects.name))[1]=a.created_by::text) OR
      (a.club_id IS NOT NULL AND (storage.foldername(objects.name))[1]=a.club_id::text AND EXISTS (SELECT 1 FROM public.clubs c WHERE c.id=a.club_id AND c.status::text='approved'))
    )))
  ))
);

CREATE POLICY "CC authorized image inserts" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  (bucket_id='avatars' AND (storage.foldername(name))[1]=auth.uid()::text) OR
  (bucket_id IN ('event-posters','club-logos','announcement-images') AND public.cc_can_manage_storage_folder((storage.foldername(name))[1])) OR
  (bucket_id='club-logos' AND (storage.foldername(name))[1]=auth.uid()::text AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role::text='student' AND p.is_active IS TRUE
  ))
);

CREATE POLICY "CC authorized image updates" ON storage.objects FOR UPDATE TO authenticated
USING (
  (bucket_id='avatars' AND (storage.foldername(name))[1]=auth.uid()::text) OR
  (bucket_id IN ('event-posters','club-logos','announcement-images') AND public.cc_can_manage_storage_folder((storage.foldername(name))[1]))
)
WITH CHECK (
  (bucket_id='avatars' AND (storage.foldername(name))[1]=auth.uid()::text) OR
  (bucket_id IN ('event-posters','club-logos','announcement-images') AND public.cc_can_manage_storage_folder((storage.foldername(name))[1]))
);

CREATE POLICY "CC authorized image deletes" ON storage.objects FOR DELETE TO authenticated USING (
  (bucket_id='avatars' AND (storage.foldername(name))[1]=auth.uid()::text) OR
  (bucket_id IN ('event-posters','club-logos','announcement-images') AND public.cc_can_manage_storage_folder((storage.foldername(name))[1])) OR
  (bucket_id='club-logos' AND (storage.foldername(name))[1]=auth.uid()::text AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role::text='student' AND p.is_active IS TRUE
  ) AND NOT EXISTS (SELECT 1 FROM public.clubs c WHERE c.logo_path=objects.name))
);

COMMIT;
