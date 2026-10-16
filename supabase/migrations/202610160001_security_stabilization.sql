-- Additive security corrections for the schema in ../schema.sql.
-- Review and apply with Supabase CLI or the SQL editor; this migration does not drop data.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Deactivated accounts must lose all role-derived database privileges immediately.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE r TEXT;
BEGIN
  SELECT role INTO r FROM public.profiles
  WHERE id = auth.uid() AND is_active;
  RETURN r;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'SUPER_ADMIN' AND is_active
  );
$$;

CREATE OR REPLACE FUNCTION public.is_club_admin_for(target_club_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_active
      AND ((role = 'CLUB_ADMIN' AND assigned_club_id = target_club_id)
           OR role = 'SUPER_ADMIN')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_club_admin_for_folder(folder TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN public.is_club_admin_for(folder::uuid);
EXCEPTION WHEN invalid_text_representation THEN
  RETURN FALSE;
END;
$$;

-- Prevent role/club assignment changes by ordinary users, while keeping profile edits.
DROP POLICY IF EXISTS "Users can update their own profile personal info" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can update any profile" ON public.profiles;
CREATE POLICY "Users update own non-privileged profile fields"
ON public.profiles FOR UPDATE TO authenticated
USING (id = (SELECT auth.uid()))
WITH CHECK (
  id = (SELECT auth.uid())
  AND role = (SELECT p.role FROM public.profiles p WHERE p.id = (SELECT auth.uid()))
  AND assigned_club_id IS NOT DISTINCT FROM
      (SELECT p.assigned_club_id FROM public.profiles p WHERE p.id = (SELECT auth.uid()))
  AND is_active = (SELECT p.is_active FROM public.profiles p WHERE p.id = (SELECT auth.uid()))
);
CREATE POLICY "Super admins update profiles"
ON public.profiles FOR UPDATE TO authenticated
USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- A submitted club cannot arrive pre-approved or assign itself an administrator.
DROP POLICY IF EXISTS "Authenticated users can register clubs" ON public.clubs;
CREATE POLICY "Students submit pending club registrations"
ON public.clubs FOR INSERT TO authenticated
WITH CHECK (
  public.current_user_role() = 'STUDENT'
  AND approval_status = 'PENDING'
  AND assigned_admin_id IS NULL
);

-- Assigned admins can edit their club's details but cannot change its approval state.
DROP POLICY IF EXISTS "Club admins can update assigned club" ON public.clubs;
CREATE POLICY "Active assigned admins update club details"
ON public.clubs FOR UPDATE TO authenticated
USING (public.is_club_admin_for(id))
WITH CHECK (
  public.is_club_admin_for(id)
  AND (
    public.is_super_admin()
    OR approval_status = (SELECT c.approval_status FROM public.clubs c WHERE c.id = clubs.id)
  )
);

-- Membership requests must belong to students and an approved, visible club.
DROP POLICY IF EXISTS "Students can request membership" ON public.club_memberships;
CREATE POLICY "Students request membership in approved clubs"
ON public.club_memberships FOR INSERT TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND public.current_user_role() = 'STUDENT'
  AND status = 'PENDING'
  AND EXISTS (
    SELECT 1 FROM public.clubs c
    WHERE c.id = club_id AND c.approval_status = 'APPROVED' AND c.is_published
  )
);

-- Scope membership review writes and prevent moving a request between users/clubs.
DROP POLICY IF EXISTS "Club admins can review memberships" ON public.club_memberships;
CREATE POLICY "Assigned admins review memberships"
ON public.club_memberships FOR UPDATE TO authenticated
USING (public.is_club_admin_for(club_id))
WITH CHECK (
  public.is_club_admin_for(club_id)
  AND reviewed_by_id = (SELECT auth.uid())
  AND reviewed_at IS NOT NULL
);

-- Registration rows can only be created for a currently published event by students.
DROP POLICY IF EXISTS "Students can register for events" ON public.event_registrations;
CREATE POLICY "Students register for published events"
ON public.event_registrations FOR INSERT TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND public.current_user_role() = 'STUDENT'
  AND status = 'REGISTERED'
  AND EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_id AND e.is_published
      AND (e.club_id IS NULL OR EXISTS (
        SELECT 1 FROM public.clubs c
        WHERE c.id = e.club_id AND c.approval_status = 'APPROVED' AND c.is_published
      ))
  )
);

-- Do not expose event records belonging to unapproved or unpublished clubs.
DROP POLICY IF EXISTS "Public can view published events" ON public.events;
CREATE POLICY "Public views published events from approved clubs"
ON public.events FOR SELECT TO authenticated, anon
USING (
  (is_published AND (
    club_id IS NULL OR EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = events.club_id AND c.approval_status = 'APPROVED' AND c.is_published
    )
  ))
  OR (club_id IS NOT NULL AND public.is_club_admin_for(club_id))
  OR public.is_super_admin()
);

-- Likewise hide announcements until their club is approved and public.
DROP POLICY IF EXISTS "Public can view active announcements" ON public.announcements;
CREATE POLICY "Public views active announcements from approved clubs"
ON public.announcements FOR SELECT TO authenticated, anon
USING (
  (is_active AND (
    club_id IS NULL OR EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = announcements.club_id AND c.approval_status = 'APPROVED' AND c.is_published
    )
  ))
  OR (club_id IS NOT NULL AND public.is_club_admin_for(club_id))
  OR public.is_super_admin()
);

-- Avoid arbitrary client-written audit identities and roles.
DROP POLICY IF EXISTS "System can record audit logs" ON public.audit_logs;
CREATE POLICY "Users record audit entries as themselves"
ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (
  actor_email = (SELECT auth.jwt()->>'email')
  AND actor_role = public.current_user_role()
);

-- Storage objects are organized under an owner or club UUID folder. Club admins
-- can write only to their assigned club folder; users can write only to their own.
-- Existing objects remain readable from the deliberately public logo/poster buckets.
DROP POLICY IF EXISTS "Authenticated users can upload club logos" ON storage.objects;
DROP POLICY IF EXISTS "Authorized users can update club logos" ON storage.objects;
DROP POLICY IF EXISTS "Authorized users can delete club logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload event posters" ON storage.objects;
DROP POLICY IF EXISTS "Authorized users can update event posters" ON storage.objects;
DROP POLICY IF EXISTS "Authorized users can delete event posters" ON storage.objects;
DROP POLICY IF EXISTS "Users upload authorized campus images" ON storage.objects;
CREATE POLICY "Users upload authorized campus images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id IN ('club-logos', 'event-posters', 'avatars')
  AND (
    (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
    OR (bucket_id <> 'avatars' AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::text
      OR public.is_club_admin_for_folder((storage.foldername(name))[1])
      OR public.is_super_admin()
    ))
  )
);
CREATE POLICY "Users update authorized campus images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id IN ('club-logos', 'event-posters', 'avatars')
  AND (
    (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
    OR (bucket_id <> 'avatars' AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::text
      OR public.is_club_admin_for_folder((storage.foldername(name))[1])
      OR public.is_super_admin()
    ))
  )
)
WITH CHECK (
  bucket_id IN ('club-logos', 'event-posters', 'avatars')
  AND (
    (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
    OR (bucket_id <> 'avatars' AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::text
      OR public.is_club_admin_for_folder((storage.foldername(name))[1])
      OR public.is_super_admin()
    ))
  )
);
CREATE POLICY "Users delete authorized campus images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id IN ('club-logos', 'event-posters', 'avatars')
  AND (
    (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
    OR (bucket_id <> 'avatars' AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::text
      OR public.is_club_admin_for((storage.foldername(name))[1]::uuid)
      OR public.is_super_admin()
    ))
  )
);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

DROP POLICY IF EXISTS "Users read their own avatars" ON storage.objects;
CREATE POLICY "Users read their own avatars"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

-- Keep the auth trigger authoritative and tolerate missing optional metadata.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, student_id, department, role)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(COALESCE(NEW.email, ''), '@', 1), 'Student'),
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'student_id', ''),
    NULLIF(NEW.raw_user_meta_data->>'department', ''),
    'STUDENT'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
