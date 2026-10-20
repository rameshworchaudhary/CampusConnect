-- Review draft for the isolated staging database only. Prevent an eligible
-- parent row from making another user's/club's object readable by reference.
BEGIN;
DO $$
BEGIN
  IF to_regclass('storage.objects') IS NULL OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='storage.objects'::regclass) THEN
    RAISE EXCEPTION 'Storage path-scope preflight failed: storage.objects is missing or RLS is disabled';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects')<>6
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='CC public eligible referenced image reads' AND cmd='SELECT' AND 'anon'=ANY(roles))
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='CC authenticated eligible image reads' AND cmd='SELECT' AND 'authenticated'=ANY(roles)) THEN
    RAISE EXCEPTION 'Storage path-scope preflight failed: SELECT policy inventory differs; inspect permissive policies before replacement';
  END IF;
  IF (SELECT count(*) FROM storage.buckets WHERE id IN ('avatars','event-posters','club-logos','announcement-images'))<>4
     OR EXISTS (SELECT 1 FROM storage.buckets WHERE id IN ('avatars','event-posters','club-logos','announcement-images') AND public IS DISTINCT FROM false) THEN
    RAISE EXCEPTION 'Storage path-scope preflight failed: expected four existing private buckets; no bucket settings will be changed';
  END IF;
END $$;

DROP POLICY "CC public eligible referenced image reads" ON storage.objects;
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

DROP POLICY "CC authenticated eligible image reads" ON storage.objects;
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
COMMIT;
