-- Review proposal only. Additive compatibility for the currently deployed schema.
-- Do not apply to production from this draft.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.announcements') IS NULL
     OR to_regclass('public.profiles') IS NULL
     OR to_regclass('public.clubs') IS NULL
     OR to_regclass('public.events') IS NULL
     OR to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION 'CampusConnect compatibility preflight failed: expected current public tables and auth.users';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='role' AND udt_schema='public' AND udt_name='app_role')
     OR NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid WHERE n.nspname='public' AND t.typname='app_role' AND e.enumlabel='student')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clubs' AND column_name='status')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='events' AND column_name='is_platform_event' AND data_type='boolean') THEN
    RAISE EXCEPTION 'CampusConnect compatibility preflight failed: unexpected role/status/platform-event schema';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.events'::regclass AND confrelid='public.clubs'::regclass AND contype='f' AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='public.events'::regclass AND attname='club_id')]::smallint[])
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.club_memberships'::regclass AND confrelid='public.clubs'::regclass AND contype='f' AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='public.club_memberships'::regclass AND attname='club_id')]::smallint[])
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.club_memberships'::regclass AND confrelid='public.profiles'::regclass AND contype='f' AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='public.club_memberships'::regclass AND attname='student_id')]::smallint[]) THEN
    RAISE EXCEPTION 'CampusConnect compatibility preflight failed: expected event/club and membership foreign keys are missing or target unexpected tables';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND (
      (table_name='announcements' AND column_name='image_path' AND data_type<>'text') OR
      (table_name='profiles' AND column_name='is_active' AND data_type<>'boolean') OR
      (table_name='clubs' AND column_name IN ('meeting_schedule','meeting_location','faculty_advisor','contact_email','contact_phone') AND data_type<>'text')
    )
  ) THEN
    RAISE EXCEPTION 'CampusConnect compatibility preflight failed: a target column exists with an unexpected type';
  END IF;
END $$;

-- Existing rows get NULL metadata/image values and remain active.
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS image_path text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS meeting_schedule text;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS meeting_location text;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS faculty_advisor text;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS contact_phone text;
-- Required by the existing Super Admin platform-event form, which inserts NULL.
ALTER TABLE public.events ALTER COLUMN club_id DROP NOT NULL;
-- A clubless row is a platform event. This prevents an event from becoming
-- invisible to public queries merely because its caller forgot the marker.
DO $$
DECLARE existing_definition text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.events WHERE club_id IS NULL AND is_platform_event IS NOT TRUE) THEN
    RAISE EXCEPTION 'Compatibility preflight failed: a clubless event is not marked as a platform event; review those rows before adding the constraint';
  END IF;
  SELECT pg_get_constraintdef(oid) INTO existing_definition
  FROM pg_constraint
  WHERE conrelid='public.events'::regclass AND conname='events_platform_event_requires_marker';
  IF existing_definition IS NULL THEN
    ALTER TABLE public.events ADD CONSTRAINT events_platform_event_requires_marker
      CHECK (club_id IS NOT NULL OR is_platform_event IS TRUE);
  ELSIF existing_definition NOT ILIKE '%club_id IS NOT NULL%' OR existing_definition NOT ILIKE '%is_platform_event IS TRUE%' THEN
    RAISE EXCEPTION 'Compatibility preflight failed: events_platform_event_requires_marker exists with an unexpected definition';
  END IF;
END $$;

-- Keep the existing auth trigger attached. Only enrich its function so signup
-- metadata collected by the client is persisted; client-supplied roles remain ignored.
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
  ) ON CONFLICT (id) DO NOTHING;
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
REVOKE ALL ON FUNCTION public.ensure_own_profile() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ensure_own_profile() TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
