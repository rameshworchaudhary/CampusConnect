-- Data-free staging baseline reconstructed from read-only schema and policy
-- metadata for production project fjfmnamqcupapnwsoled.
-- APPLY ONLY to the separately confirmed campusconnect-staging project.
-- This intentionally creates no users, application rows, or Storage objects.
BEGIN;

DO $$
BEGIN
  IF to_regclass('auth.users') IS NULL OR to_regclass('storage.objects') IS NULL OR to_regclass('storage.buckets') IS NULL THEN
    RAISE EXCEPTION 'Staging baseline requires Supabase Auth and Storage schemas.';
  END IF;
  IF to_regclass('public.profiles') IS NOT NULL OR to_regclass('public.clubs') IS NOT NULL OR
     to_regclass('public.events') IS NOT NULL OR to_regclass('public.announcements') IS NOT NULL THEN
    RAISE EXCEPTION 'Staging baseline expects an empty CampusConnect public schema; refusing to overwrite.';
  END IF;
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id IN ('avatars','event-posters','club-logos','announcement-images')) THEN
    RAISE EXCEPTION 'Staging baseline expects no CampusConnect buckets; refusing to change existing bucket configuration.';
  END IF;
END $$;

CREATE TYPE public.app_role AS ENUM ('student','club_admin','admin');
CREATE TYPE public.club_status AS ENUM ('pending','approved','rejected');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY CONSTRAINT profiles_id_fkey REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  role public.app_role NOT NULL DEFAULT 'student',
  created_at timestamptz NOT NULL DEFAULT now(),
  avatar_url text,
  department text,
  student_id text,
  assigned_club_id uuid
);

CREATE TABLE public.clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  logo_path text,
  status public.club_status NOT NULL DEFAULT 'pending',
  created_by uuid NOT NULL CONSTRAINT clubs_created_by_fkey REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  assigned_admin_id uuid CONSTRAINT clubs_assigned_admin_id_fkey REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.profiles ADD CONSTRAINT fk_profiles_assigned_club
  FOREIGN KEY (assigned_club_id) REFERENCES public.clubs(id) ON DELETE SET NULL;

CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL CONSTRAINT events_club_id_fkey REFERENCES public.clubs(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  venue text NOT NULL DEFAULT '',
  starts_at timestamptz,
  poster_path text,
  published boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL CONSTRAINT events_created_by_fkey REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  event_link text,
  capacity integer NOT NULL DEFAULT 100,
  registered_count integer NOT NULL DEFAULT 0,
  is_platform_event boolean NOT NULL DEFAULT false,
  badge_label text DEFAULT 'Open RSVP'
);

CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid CONSTRAINT announcements_club_id_fkey REFERENCES public.clubs(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  published boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL CONSTRAINT announcements_created_by_fkey REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.club_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL CONSTRAINT club_memberships_club_id_fkey REFERENCES public.clubs(id) ON DELETE CASCADE,
  student_id uuid NOT NULL CONSTRAINT club_memberships_student_id_fkey REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT club_memberships_club_id_student_id_key UNIQUE (club_id,student_id)
);

CREATE TABLE public.event_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL CONSTRAINT event_registrations_event_id_fkey REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL CONSTRAINT event_registrations_user_id_fkey REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'REGISTERED' CHECK (status IN ('REGISTERED','CANCELLED')),
  registered_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_registrations_event_id_user_id_key UNIQUE (event_id,user_id)
);

CREATE TABLE public.user_announcement_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL CONSTRAINT user_announcement_reads_user_id_fkey REFERENCES public.profiles(id) ON DELETE CASCADE,
  announcement_id uuid NOT NULL CONSTRAINT user_announcement_reads_announcement_id_fkey REFERENCES public.announcements(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_announcement_reads_user_id_announcement_id_key UNIQUE (user_id,announcement_id)
);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL,
  actor_email text NOT NULL,
  actor_role text NOT NULL,
  target_identifier text,
  details text NOT NULL,
  ip_address text,
  sha_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION public.is_super_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.role='admin'::public.app_role) $$;

CREATE FUNCTION public.cc_is_active_super_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.role::text='admin' AND COALESCE((to_jsonb(p)->>'is_active')::boolean,true)) $$;

CREATE FUNCTION public.cc_profile_privileges_unchanged(target_profile_id uuid, proposed_role text, proposed_club_id uuid, proposed_is_active boolean)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
  SELECT (target_profile_id<>(SELECT auth.uid()) AND public.cc_is_active_super_admin()) OR EXISTS (
    SELECT 1 FROM public.profiles existing WHERE existing.id=target_profile_id AND existing.id=(SELECT auth.uid())
      AND COALESCE((to_jsonb(existing)->>'is_active')::boolean,true)=true
      AND existing.role::text IS NOT DISTINCT FROM proposed_role
      AND existing.assigned_club_id IS NOT DISTINCT FROM proposed_club_id
      AND COALESCE((to_jsonb(existing)->>'is_active')::boolean,true) IS NOT DISTINCT FROM proposed_is_active
  )
$$;

CREATE FUNCTION public.can_manage_club(target_club_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$ SELECT public.is_super_admin() OR EXISTS (
  SELECT 1 FROM public.clubs c JOIN public.profiles p ON p.id=c.assigned_admin_id
  WHERE c.id=target_club_id AND p.id=(SELECT auth.uid()) AND p.role='club_admin'::public.app_role
) $$;

CREATE FUNCTION public.set_profile_role_and_club(p_target_user_id uuid,p_target_role text,p_target_club_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE db_role text;
BEGIN
  IF NOT public.cc_is_active_super_admin() OR NOT public.is_super_admin() THEN RAISE EXCEPTION 'Only an active Super Admin can change roles or club assignments' USING ERRCODE='42501'; END IF;
  IF p_target_user_id IS NULL OR p_target_role IS NULL OR p_target_role NOT IN ('STUDENT','CLUB_ADMIN','SUPER_ADMIN') THEN RAISE EXCEPTION 'Invalid target profile or role' USING ERRCODE='22023'; END IF;
  IF (p_target_role='CLUB_ADMIN')<>(p_target_club_id IS NOT NULL) THEN RAISE EXCEPTION 'Only CLUB_ADMIN requires a club assignment' USING ERRCODE='22023'; END IF;
  IF p_target_user_id=(SELECT auth.uid()) THEN RAISE EXCEPTION 'Super Admins cannot change their own role or club assignment' USING ERRCODE='42501'; END IF;
  db_role:=CASE p_target_role WHEN 'STUDENT' THEN 'student' WHEN 'CLUB_ADMIN' THEN 'club_admin' ELSE 'admin' END;
  PERFORM 1 FROM public.profiles WHERE id=p_target_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Target profile does not exist' USING ERRCODE='22023'; END IF;
  IF p_target_club_id IS NOT NULL THEN
    PERFORM 1 FROM public.clubs WHERE id=p_target_club_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Target club does not exist' USING ERRCODE='22023'; END IF;
    UPDATE public.profiles SET assigned_club_id=NULL,role=CASE WHEN role::text='club_admin' THEN 'student'::public.app_role ELSE role END WHERE assigned_club_id=p_target_club_id AND id<>p_target_user_id;
  END IF;
  UPDATE public.clubs SET assigned_admin_id=NULL WHERE assigned_admin_id=p_target_user_id AND (p_target_club_id IS NULL OR id<>p_target_club_id);
  UPDATE public.profiles SET role=db_role::public.app_role,assigned_club_id=p_target_club_id WHERE id=p_target_user_id;
  IF p_target_club_id IS NOT NULL THEN UPDATE public.clubs SET assigned_admin_id=p_target_user_id WHERE id=p_target_club_id; END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_profile_role_and_club(uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_profile_role_and_club(uuid,text,uuid) TO authenticated;

CREATE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  INSERT INTO public.profiles(id,full_name,email,role) VALUES (
    NEW.id,COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name',''),NULLIF(split_part(COALESCE(NEW.email,''),'@',1),''),'Student'),NEW.email,'student'::public.app_role
  ) ON CONFLICT(id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE FUNCTION public.campusconnect_event_registration_count() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  IF TG_OP='INSERT' AND NEW.status='REGISTERED' THEN UPDATE public.events SET registered_count=registered_count+1 WHERE id=NEW.event_id; RETURN NEW;
  ELSIF TG_OP='DELETE' AND OLD.status='REGISTERED' THEN UPDATE public.events SET registered_count=GREATEST(0,registered_count-1) WHERE id=OLD.event_id; RETURN OLD;
  ELSIF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER campusconnect_event_registration_count AFTER INSERT OR DELETE ON public.event_registrations FOR EACH ROW EXECUTE FUNCTION public.campusconnect_event_registration_count();

CREATE FUNCTION public.cc_audit_profile_governance_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE actor_mail text; actor_role_text text;
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role OR OLD.assigned_club_id IS DISTINCT FROM NEW.assigned_club_id THEN
    IF (SELECT auth.uid()) IS NULL THEN actor_mail:='system'; actor_role_text:='SYSTEM';
    ELSE
      IF NOT public.cc_is_active_super_admin() THEN RAISE EXCEPTION 'Only an active Super Admin can change profile roles or club assignments' USING ERRCODE='42501'; END IF;
      SELECT email,role::text INTO actor_mail,actor_role_text FROM public.profiles WHERE id=(SELECT auth.uid());
    END IF;
    INSERT INTO public.audit_logs(action_type,actor_email,actor_role,target_identifier,details,ip_address)
    VALUES (CASE WHEN OLD.assigned_club_id IS DISTINCT FROM NEW.assigned_club_id THEN 'ADMIN_ASSIGNMENT' ELSE 'ROLE_UPDATE' END,
      actor_mail,actor_role_text,NEW.id::text,format('role %s -> %s; assigned_club_id %s -> %s',OLD.role,NEW.role,OLD.assigned_club_id,NEW.assigned_club_id),NULL);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER cc_audit_profile_governance_change AFTER UPDATE OF role,assigned_club_id ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.cc_audit_profile_governance_change();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_announcement_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (id=(SELECT auth.uid()) OR public.is_super_admin());
CREATE POLICY cc_profiles_self_or_super_admin_update ON public.profiles FOR UPDATE TO authenticated USING (id=auth.uid() OR public.cc_is_active_super_admin()) WITH CHECK (id=auth.uid() OR public.cc_is_active_super_admin());
CREATE POLICY cc_profiles_privilege_change_guard ON public.profiles AS RESTRICTIVE FOR UPDATE TO authenticated USING (id=auth.uid() OR public.cc_is_active_super_admin()) WITH CHECK (public.cc_profile_privileges_unchanged(id,role::text,assigned_club_id,COALESCE((to_jsonb(profiles.*)->>'is_active')::boolean,true)));

CREATE POLICY "View approved clubs" ON public.clubs FOR SELECT TO anon,authenticated USING (status='approved' OR created_by=(SELECT auth.uid()) OR assigned_admin_id=(SELECT auth.uid()) OR public.is_super_admin());
CREATE POLICY "Submit club for approval" ON public.clubs FOR INSERT TO authenticated WITH CHECK (created_by=(SELECT auth.uid()) AND status='pending');
CREATE POLICY "Super Admin updates clubs" ON public.clubs FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Super Admin deletes clubs" ON public.clubs FOR DELETE TO authenticated USING (public.is_super_admin());

CREATE POLICY "Students request membership" ON public.club_memberships FOR INSERT TO authenticated WITH CHECK (
  student_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.role='student'::public.app_role)
  AND status='pending' AND EXISTS (SELECT 1 FROM public.clubs c WHERE c.id=club_memberships.club_id AND c.status='approved')
);
CREATE POLICY "Club admins review memberships" ON public.club_memberships FOR UPDATE TO authenticated USING (public.can_manage_club(club_id)) WITH CHECK (public.can_manage_club(club_id));
CREATE POLICY "View memberships" ON public.club_memberships FOR SELECT TO authenticated USING (student_id=(SELECT auth.uid()) OR public.can_manage_club(club_id));

CREATE POLICY "Club admins create events" ON public.events FOR INSERT TO authenticated WITH CHECK (created_by=(SELECT auth.uid()) AND public.can_manage_club(club_id));
CREATE POLICY "Club admins update events" ON public.events FOR UPDATE TO authenticated USING (public.can_manage_club(club_id)) WITH CHECK (public.can_manage_club(club_id));
CREATE POLICY "Club admins delete events" ON public.events FOR DELETE TO authenticated USING (public.can_manage_club(club_id));
CREATE POLICY "View published events" ON public.events FOR SELECT TO anon,authenticated USING (
  (published AND EXISTS (SELECT 1 FROM public.clubs c WHERE c.id=events.club_id AND c.status='approved'))
  OR public.can_manage_club(club_id) OR created_by=(SELECT auth.uid())
);

CREATE POLICY "Club admins create announcements" ON public.announcements FOR INSERT TO authenticated WITH CHECK (created_by=(SELECT auth.uid()) AND (club_id IS NULL OR public.can_manage_club(club_id)));
CREATE POLICY "Club admins update announcements" ON public.announcements FOR UPDATE TO authenticated USING (public.is_super_admin() OR (club_id IS NOT NULL AND public.can_manage_club(club_id))) WITH CHECK (public.is_super_admin() OR (club_id IS NOT NULL AND public.can_manage_club(club_id)));
CREATE POLICY "Club admins delete announcements" ON public.announcements FOR DELETE TO authenticated USING (public.is_super_admin() OR (club_id IS NOT NULL AND public.can_manage_club(club_id)));
CREATE POLICY "View published announcements" ON public.announcements FOR SELECT TO anon,authenticated USING (
  (published AND (club_id IS NULL OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id=announcements.club_id AND c.status='approved')))
  OR public.can_manage_club(club_id) OR created_by=(SELECT auth.uid())
);

CREATE POLICY "CampusConnect student event registration" ON public.event_registrations FOR INSERT TO authenticated WITH CHECK (
  user_id=auth.uid() AND status='REGISTERED' AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role::text='student')
  AND EXISTS (SELECT 1 FROM public.events e WHERE e.id=event_registrations.event_id AND e.published AND (e.club_id IS NULL OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id=e.club_id AND c.status::text='approved')))
);
CREATE POLICY "CampusConnect cancel own registration" ON public.event_registrations FOR DELETE TO authenticated USING (user_id=auth.uid());
CREATE POLICY "CampusConnect read event registrations" ON public.event_registrations FOR SELECT TO authenticated USING (
  user_id=auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role::text='admin') OR
  EXISTS (SELECT 1 FROM public.events e JOIN public.clubs c ON c.id=e.club_id WHERE e.id=event_registrations.event_id AND c.assigned_admin_id=auth.uid())
);

CREATE POLICY "CampusConnect users manage own announcement reads" ON public.user_announcement_reads FOR ALL TO authenticated USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());
CREATE POLICY "CampusConnect admins read audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role::text='admin'));
CREATE POLICY "CampusConnect users insert own audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (actor_email=(auth.jwt()->>'email'));

GRANT USAGE ON SCHEMA public TO anon,authenticated;
GRANT SELECT ON public.clubs,public.events,public.announcements TO anon;
GRANT SELECT,UPDATE ON public.profiles TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.clubs,public.club_memberships,public.events,public.announcements,public.event_registrations,public.user_announcement_reads TO authenticated;
GRANT SELECT,INSERT ON public.audit_logs TO authenticated;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES
 ('avatars','avatars',false,5242880,ARRAY['image/jpeg','image/png','image/webp']),
 ('event-posters','event-posters',false,5242880,ARRAY['image/jpeg','image/png','image/webp']),
 ('club-logos','club-logos',false,5242880,ARRAY['image/jpeg','image/png','image/webp']),
 ('announcement-images','announcement-images',false,5242880,ARRAY['image/jpeg','image/png','image/webp']);

CREATE POLICY "Users read their own avatars" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='avatars' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
CREATE POLICY "Users can upload their own avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='avatars' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
CREATE POLICY "Users can update their own avatars" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='avatars' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text) WITH CHECK (bucket_id='avatars' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);

NOTIFY pgrst,'reload schema';
COMMIT;
