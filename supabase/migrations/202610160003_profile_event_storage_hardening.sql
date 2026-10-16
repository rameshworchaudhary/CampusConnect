-- Additive follow-up for existing installs. Run after 001 and 002.
-- No rows are deleted, and registration counts are reconciled from current rows.

-- Ensure signup always creates a least-privileged profile, even on installs
-- where the auth trigger was missing or had drifted.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''), 'Student'),
    NEW.email,
    'student'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Authenticated users can repair only their own missing profile. Role and club
-- assignment are intentionally not accepted as arguments and always default safely.
DROP FUNCTION IF EXISTS public.ensure_own_profile();
CREATE OR REPLACE FUNCTION public.ensure_own_profile()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_id UUID;
  user_email TEXT;
  user_name TEXT;
  result_profile public.profiles;
BEGIN
  current_id := auth.uid();
  IF current_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to create a profile.';
  END IF;

  SELECT
    u.email,
    COALESCE(
    NULLIF(u.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(split_part(COALESCE(u.email, ''), '@', 1), ''),
    'Student'
    )
  INTO user_email, user_name
  FROM auth.users AS u
  WHERE u.id = current_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No matching Supabase Auth account was found.';
  END IF;

  IF user_email IS NULL THEN
    RAISE EXCEPTION 'Your account does not have an email address.';
  END IF;

  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (current_id, user_name, user_email, 'student')
  ON CONFLICT (id) DO NOTHING;

  SELECT p.* INTO result_profile
  FROM public.profiles AS p
  WHERE p.id = current_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile could not be loaded.';
  END IF;

  RETURN result_profile;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_own_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_own_profile() TO authenticated;

-- Remove the blanket profile-directory read policy. Own profile, super-admin
-- administration, and assigned club admins reviewing their club members remain visible.
CREATE OR REPLACE FUNCTION public.can_view_profile(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT target_user_id = auth.uid()
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.club_memberships cm
      WHERE cm.user_id = target_user_id
        AND public.is_club_admin_for(cm.club_id)
    );
$$;
REVOKE ALL ON FUNCTION public.can_view_profile(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_profile(UUID) TO authenticated;
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users read authorized profiles" ON public.profiles;
CREATE POLICY "Users read authorized profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.can_view_profile(id));

-- Non-super-admin club admins may edit club details, but cannot reassign the
-- club admin or alter approval state.
DROP POLICY IF EXISTS "Active assigned admins update club details" ON public.clubs;
CREATE POLICY "Active assigned admins update club details"
ON public.clubs FOR UPDATE TO authenticated
USING (public.is_club_admin_for(id))
WITH CHECK (
  public.is_super_admin()
  OR (
    public.is_club_admin_for(id)
    AND assigned_admin_id IS NOT DISTINCT FROM
      (SELECT c.assigned_admin_id FROM public.clubs c WHERE c.id = clubs.id)
    AND approval_status =
      (SELECT c.approval_status FROM public.clubs c WHERE c.id = clubs.id)
  )
);

-- Keep registration totals aligned with active rows for inserts, deletes,
-- cancellation/status changes, and event reassignment.
CREATE OR REPLACE FUNCTION public.update_event_registration_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'REGISTERED' THEN
      UPDATE public.events SET registered_count = registered_count + 1 WHERE id = NEW.event_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status = 'REGISTERED' THEN
      UPDATE public.events SET registered_count = GREATEST(0, registered_count - 1) WHERE id = OLD.event_id;
    END IF;
    RETURN OLD;
  ELSE
    IF OLD.event_id = NEW.event_id THEN
      IF OLD.status = 'REGISTERED' AND NEW.status <> 'REGISTERED' THEN
        UPDATE public.events SET registered_count = GREATEST(0, registered_count - 1) WHERE id = NEW.event_id;
      ELSIF OLD.status <> 'REGISTERED' AND NEW.status = 'REGISTERED' THEN
        UPDATE public.events SET registered_count = registered_count + 1 WHERE id = NEW.event_id;
      END IF;
    ELSE
      IF OLD.status = 'REGISTERED' THEN
        UPDATE public.events SET registered_count = GREATEST(0, registered_count - 1) WHERE id = OLD.event_id;
      END IF;
      IF NEW.status = 'REGISTERED' THEN
        UPDATE public.events SET registered_count = registered_count + 1 WHERE id = NEW.event_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
END;
$$;
DROP TRIGGER IF EXISTS on_event_registration_changed ON public.event_registrations;
CREATE TRIGGER on_event_registration_changed
  AFTER INSERT OR DELETE OR UPDATE OF event_id, status ON public.event_registrations
  FOR EACH ROW EXECUTE FUNCTION public.update_event_registration_count();

UPDATE public.events e
SET registered_count = (
  SELECT COUNT(*)::INTEGER
  FROM public.event_registrations er
  WHERE er.event_id = e.id AND er.status = 'REGISTERED'
);

-- Use the safe UUID parser for deletion too; malformed folder names must deny,
-- not raise a cast exception. The first folder remains the authorization scope.
DROP POLICY IF EXISTS "Users delete authorized campus images" ON storage.objects;
CREATE POLICY "Users delete authorized campus images"
ON storage.objects FOR DELETE TO authenticated
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
);

NOTIFY pgrst, 'reload schema';
