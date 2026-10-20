-- Review draft for the isolated staging project only. This corrects defects
-- found in the already-applied staging proposals; it is not a production
-- migration and must not be added to the historical migration runner.
BEGIN;

DO $$
DECLARE existing_definition text;
BEGIN
  IF to_regclass('public.events') IS NULL OR to_regclass('public.club_memberships') IS NULL
     OR to_regclass('public.profiles') IS NULL OR to_regclass('public.audit_logs') IS NULL
     OR to_regclass('storage.objects') IS NULL THEN
    RAISE EXCEPTION 'Staging correction preflight failed: expected CampusConnect and Storage tables are missing';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='storage.objects'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.audit_logs'::regclass) THEN
    RAISE EXCEPTION 'Staging correction preflight failed: RLS must remain enabled on Storage objects and audit logs';
  END IF;
  IF (SELECT count(*) FROM storage.buckets WHERE id IN ('avatars','event-posters','club-logos','announcement-images'))<>4
     OR EXISTS (SELECT 1 FROM storage.buckets WHERE id IN ('avatars','event-posters','club-logos','announcement-images') AND public IS DISTINCT FROM false) THEN
    RAISE EXCEPTION 'Staging correction preflight failed: expected four existing private buckets; no bucket settings will be changed';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects')<>6
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='CC public eligible referenced image reads' AND cmd='SELECT' AND 'anon'=ANY(roles))
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='CC authenticated eligible image reads' AND cmd='SELECT' AND 'authenticated'=ANY(roles))
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='CC authorized image deletes' AND cmd='DELETE' AND 'authenticated'=ANY(roles)) THEN
    RAISE EXCEPTION 'Staging correction preflight failed: Storage policy inventory differs; inspect all permissive policies before replacement';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='audit_logs' AND cmd='INSERT' AND ('authenticated'=ANY(roles) OR 'public'=ANY(roles)))<>1
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audit_logs' AND policyname='CampusConnect users insert own audit logs' AND cmd='INSERT' AND 'authenticated'=ANY(roles)) THEN
    RAISE EXCEPTION 'Staging correction preflight failed: audit-log INSERT policy inventory differs';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='club_memberships' AND cmd='DELETE' AND 'authenticated'=ANY(roles))<>1
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='club_memberships' AND policyname='CC students cancel own pending memberships' AND cmd='DELETE') THEN
    RAISE EXCEPTION 'Staging correction preflight failed: membership DELETE policy inventory differs';
  END IF;
  IF to_regprocedure('public.cc_is_active_user()') IS NULL OR to_regprocedure('public.cc_can_manage_storage_folder(text)') IS NULL THEN
    RAISE EXCEPTION 'Staging correction preflight failed: active-account or Storage authorization helper is missing';
  END IF;
  SELECT pg_get_constraintdef(oid) INTO existing_definition
  FROM pg_constraint WHERE conrelid='public.events'::regclass AND conname='events_platform_event_requires_marker';
  IF existing_definition IS NOT NULL AND
     (existing_definition NOT ILIKE '%club_id IS NOT NULL%' OR existing_definition NOT ILIKE '%is_platform_event IS TRUE%') THEN
    RAISE EXCEPTION 'Staging correction preflight failed: platform-event constraint exists with unexpected definition';
  END IF;
  IF EXISTS (SELECT 1 FROM public.events WHERE club_id IS NULL AND is_platform_event IS NOT TRUE) THEN
    RAISE EXCEPTION 'Staging correction preflight failed: a clubless non-platform event needs review before adding the marker constraint';
  END IF;
END $$;

DO $$
DECLARE existing_definition text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO existing_definition
  FROM pg_constraint WHERE conrelid='public.events'::regclass AND conname='events_platform_event_requires_marker';
  IF existing_definition IS NULL THEN
    ALTER TABLE public.events ADD CONSTRAINT events_platform_event_requires_marker
      CHECK (club_id IS NOT NULL OR is_platform_event IS TRUE);
  END IF;
END $$;

DROP POLICY "CC students cancel own pending memberships" ON public.club_memberships;
CREATE POLICY "CC students cancel own pending memberships" ON public.club_memberships
FOR DELETE TO authenticated USING (
  student_id=(SELECT auth.uid()) AND status='pending' AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id=(SELECT auth.uid()) AND p.role::text='student' AND p.is_active IS TRUE
  )
);

DROP POLICY "CC public eligible referenced image reads" ON storage.objects;
CREATE POLICY "CC public eligible referenced image reads" ON storage.objects FOR SELECT TO anon USING (
  (bucket_id='event-posters' AND EXISTS (SELECT 1 FROM public.events e WHERE e.poster_path=objects.name AND e.published IS TRUE AND (
    (e.club_id IS NULL AND e.is_platform_event IS TRUE) OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id=e.club_id AND c.status::text='approved')
  ))) OR
  (bucket_id='club-logos' AND EXISTS (SELECT 1 FROM public.clubs c WHERE c.logo_path=objects.name AND c.status::text='approved')) OR
  (bucket_id='announcement-images' AND EXISTS (SELECT 1 FROM public.announcements a WHERE a.image_path=objects.name AND a.published IS TRUE AND (
    a.club_id IS NULL OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id=a.club_id AND c.status::text='approved')
  )))
);

DROP POLICY "CC authenticated eligible image reads" ON storage.objects;
CREATE POLICY "CC authenticated eligible image reads" ON storage.objects FOR SELECT TO authenticated USING (
  (bucket_id='avatars' AND (storage.foldername(name))[1]=auth.uid()::text) OR
  (bucket_id IN ('event-posters','club-logos','announcement-images') AND (
    (storage.foldername(name))[1]=auth.uid()::text OR public.cc_can_manage_storage_folder((storage.foldername(name))[1]) OR
    (bucket_id='event-posters' AND EXISTS (SELECT 1 FROM public.events e WHERE e.poster_path=objects.name AND e.published IS TRUE AND (
      (e.club_id IS NULL AND e.is_platform_event IS TRUE) OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id=e.club_id AND c.status::text='approved')
    ))) OR
    (bucket_id='club-logos' AND EXISTS (SELECT 1 FROM public.clubs c WHERE c.logo_path=objects.name AND c.status::text='approved')) OR
    (bucket_id='announcement-images' AND EXISTS (SELECT 1 FROM public.announcements a WHERE a.image_path=objects.name AND a.published IS TRUE AND (
      a.club_id IS NULL OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id=a.club_id AND c.status::text='approved')
    )))
  ))
);

DROP POLICY "CC authorized image deletes" ON storage.objects;
CREATE POLICY "CC authorized image deletes" ON storage.objects FOR DELETE TO authenticated USING (
  (bucket_id='avatars' AND (storage.foldername(name))[1]=auth.uid()::text) OR
  (bucket_id IN ('event-posters','club-logos','announcement-images') AND public.cc_can_manage_storage_folder((storage.foldername(name))[1])) OR
  (bucket_id='club-logos' AND (storage.foldername(name))[1]=auth.uid()::text AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role::text='student' AND p.is_active IS TRUE
  ) AND NOT EXISTS (SELECT 1 FROM public.clubs c WHERE c.logo_path=objects.name))
);

DROP POLICY "CampusConnect users insert own audit logs" ON public.audit_logs;
REVOKE INSERT ON public.audit_logs FROM PUBLIC,anon,authenticated;

NOTIFY pgrst,'reload schema';
COMMIT;
