-- ==============================================================
-- CampusConnect - Supabase Database Schema, RLS & Storage
-- ==============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- --------------------------------------------------------------
-- 1. PROFILES TABLE (Extends Supabase auth.users)
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    student_id TEXT,
    department TEXT,
    role TEXT NOT NULL DEFAULT 'STUDENT' CHECK (role IN ('STUDENT', 'CLUB_ADMIN', 'SUPER_ADMIN')),
    assigned_club_id UUID,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- --------------------------------------------------------------
-- 2. CLUBS TABLE
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clubs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ref_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    meeting_schedule TEXT,
    meeting_location TEXT,
    faculty_advisor TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    logo_url TEXT,
    approval_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    assigned_admin_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT fk_clubs_assigned_admin
        FOREIGN KEY (assigned_admin_id) REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Add foreign key constraint for assigned_club_id in profiles after clubs is created
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_profiles_assigned_club'
    ) THEN
        ALTER TABLE public.profiles
        ADD CONSTRAINT fk_profiles_assigned_club
        FOREIGN KEY (assigned_club_id) REFERENCES public.clubs(id) ON DELETE SET NULL;
    END IF;
END $$;

-- --------------------------------------------------------------
-- 3. CLUB MEMBERSHIPS TABLE
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.club_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    applied_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    reviewed_at TIMESTAMPTZ,
    reviewed_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    UNIQUE(club_id, user_id)
);

-- --------------------------------------------------------------
-- 4. EVENTS TABLE
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    event_date TEXT NOT NULL,
    location TEXT NOT NULL,
    event_link TEXT,
    poster_url TEXT,
    capacity INTEGER NOT NULL DEFAULT 100,
    registered_count INTEGER NOT NULL DEFAULT 0,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    is_platform_event BOOLEAN NOT NULL DEFAULT FALSE,
    badge_label TEXT DEFAULT 'Open RSVP',
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- --------------------------------------------------------------
-- 5. EVENT REGISTRATIONS TABLE
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'REGISTERED' CHECK (status IN ('REGISTERED', 'CANCELLED')),
    registered_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(event_id, user_id)
);

-- --------------------------------------------------------------
-- 6. ANNOUNCEMENTS TABLE
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    posted_by_name TEXT NOT NULL,
    posted_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- --------------------------------------------------------------
-- 7. USER ANNOUNCEMENT READS TABLE
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_announcement_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, announcement_id)
);

-- --------------------------------------------------------------
-- 8. AUDIT LOGS TABLE
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type TEXT NOT NULL,
    actor_email TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    target_identifier TEXT,
    details TEXT,
    ip_address TEXT,
    sha_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- --------------------------------------------------------------
-- 9. HELPER FUNCTIONS FOR ROW LEVEL SECURITY (RLS)
-- --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r TEXT;
BEGIN
    SELECT role INTO r FROM public.profiles WHERE id = auth.uid();
    RETURN COALESCE(r, 'STUDENT');
END;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN (SELECT role = 'SUPER_ADMIN' FROM public.profiles WHERE id = auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.is_club_admin_for(target_club_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN (SELECT (role = 'CLUB_ADMIN' AND assigned_club_id = target_club_id) OR role = 'SUPER_ADMIN'
            FROM public.profiles WHERE id = auth.uid());
END;
$$;

-- --------------------------------------------------------------
-- 10. ENABLE ROW LEVEL SECURITY
-- --------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_announcement_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------
-- 11. RLS POLICIES
-- --------------------------------------------------------------

-- Profiles:
-- Anyone authenticated can view profiles
CREATE POLICY "Profiles are viewable by authenticated users"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- User can update their own personal info (NOT role or assigned club)
CREATE POLICY "Users can update their own profile personal info"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
    id = auth.uid()
    AND (
        -- Regular users cannot change their own role or assigned club
        (role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
         AND assigned_club_id IS NOT DISTINCT FROM (SELECT p.assigned_club_id FROM public.profiles p WHERE p.id = auth.uid()))
        OR public.is_super_admin()
    )
);

-- Super admin can update any profile (roles, active status, club assignments)
CREATE POLICY "Super admins can update any profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.is_super_admin());

-- Super admin can delete users
CREATE POLICY "Super admins can delete profiles"
ON public.profiles FOR DELETE
TO authenticated
USING (public.is_super_admin());

-- Clubs:
-- Anyone can view approved and published clubs
CREATE POLICY "Public can view approved published clubs"
ON public.clubs FOR SELECT
TO authenticated, anon
USING (
    (approval_status = 'APPROVED' AND is_published = true)
    OR public.is_super_admin()
    OR (auth.uid() IS NOT NULL AND assigned_admin_id = auth.uid())
);

-- Any authenticated user can submit a club registration (with PENDING status)
CREATE POLICY "Authenticated users can register clubs"
ON public.clubs FOR INSERT
TO authenticated
WITH CHECK (
    approval_status = 'PENDING'
    OR public.is_super_admin()
);

-- Club admins can update their assigned club (except approval status)
CREATE POLICY "Club admins can update assigned club"
ON public.clubs FOR UPDATE
TO authenticated
USING (
    assigned_admin_id = auth.uid()
    OR public.is_super_admin()
)
WITH CHECK (
    (assigned_admin_id = auth.uid() AND approval_status = (SELECT c.approval_status FROM public.clubs c WHERE c.id = clubs.id))
    OR public.is_super_admin()
);

-- Super admins can delete clubs
CREATE POLICY "Super admins can delete clubs"
ON public.clubs FOR DELETE
TO authenticated
USING (public.is_super_admin());

-- Club Memberships:
-- Users can see their own memberships; Club Admins can see their club's memberships; Super Admin can see all
CREATE POLICY "Memberships viewable by relevant users"
ON public.club_memberships FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
    OR public.is_club_admin_for(club_id)
    OR public.is_super_admin()
);

-- Students can apply to join a club (PENDING status only)
CREATE POLICY "Students can request membership"
ON public.club_memberships FOR INSERT
TO authenticated
WITH CHECK (
    user_id = auth.uid()
    AND status = 'PENDING'
);

-- Students can cancel their own pending request
CREATE POLICY "Students can cancel pending request"
ON public.club_memberships FOR DELETE
TO authenticated
USING (
    user_id = auth.uid()
    AND status = 'PENDING'
);

-- Club admins or Super Admins can review/update membership status
CREATE POLICY "Club admins can review memberships"
ON public.club_memberships FOR UPDATE
TO authenticated
USING (
    public.is_club_admin_for(club_id)
    OR public.is_super_admin()
);

-- Events:
-- Public can view published events
CREATE POLICY "Public can view published events"
ON public.events FOR SELECT
TO authenticated, anon
USING (
    is_published = true
    OR (club_id IS NOT NULL AND public.is_club_admin_for(club_id))
    OR public.is_super_admin()
);

-- Club admins can create events for their club; Super admin can create any event
CREATE POLICY "Authorized users can create events"
ON public.events FOR INSERT
TO authenticated
WITH CHECK (
    (club_id IS NOT NULL AND public.is_club_admin_for(club_id))
    OR (is_platform_event = true AND public.is_super_admin())
);

-- Club admins can update their club's events; Super admin can update any
CREATE POLICY "Authorized users can update events"
ON public.events FOR UPDATE
TO authenticated
USING (
    (club_id IS NOT NULL AND public.is_club_admin_for(club_id))
    OR public.is_super_admin()
);

-- Club admins can delete their club's events; Super admin can delete any
CREATE POLICY "Authorized users can delete events"
ON public.events FOR DELETE
TO authenticated
USING (
    (club_id IS NOT NULL AND public.is_club_admin_for(club_id))
    OR public.is_super_admin()
);

-- Event Registrations:
-- Users can see their own registrations; Club admins see for their events; Super admins see all
CREATE POLICY "Registrations viewable by relevant users"
ON public.event_registrations FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = event_registrations.event_id
        AND (e.club_id IS NOT NULL AND public.is_club_admin_for(e.club_id))
    )
    OR public.is_super_admin()
);

-- Students can register for events
CREATE POLICY "Students can register for events"
ON public.event_registrations FOR INSERT
TO authenticated
WITH CHECK (
    user_id = auth.uid()
);

-- Students can cancel their own registrations
CREATE POLICY "Students can cancel registration"
ON public.event_registrations FOR DELETE
TO authenticated
USING (
    user_id = auth.uid()
    OR public.is_super_admin()
);

-- Announcements:
-- Anyone can view active announcements for published clubs or platform
CREATE POLICY "Public can view active announcements"
ON public.announcements FOR SELECT
TO authenticated, anon
USING (
    is_active = true
    OR (club_id IS NOT NULL AND public.is_club_admin_for(club_id))
    OR public.is_super_admin()
);

-- Club admins can post for their club; Super admin can post any
CREATE POLICY "Authorized users can post announcements"
ON public.announcements FOR INSERT
TO authenticated
WITH CHECK (
    (club_id IS NOT NULL AND public.is_club_admin_for(club_id))
    OR public.is_super_admin()
);

-- Club admins can update their announcements; Super admin can update any
CREATE POLICY "Authorized users can update announcements"
ON public.announcements FOR UPDATE
TO authenticated
USING (
    (club_id IS NOT NULL AND public.is_club_admin_for(club_id))
    OR public.is_super_admin()
);

-- Club admins can delete their announcements; Super admin can delete any
CREATE POLICY "Authorized users can delete announcements"
ON public.announcements FOR DELETE
TO authenticated
USING (
    (club_id IS NOT NULL AND public.is_club_admin_for(club_id))
    OR public.is_super_admin()
);

-- User Announcement Reads:
CREATE POLICY "Users can track their own announcement reads"
ON public.user_announcement_reads FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Audit Logs:
CREATE POLICY "System can record audit logs"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Super admins can view audit logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (public.is_super_admin());

-- --------------------------------------------------------------
-- 12. TRIGGERS
-- --------------------------------------------------------------

-- Trigger: Automatically create public.profiles row when auth.users signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, student_id, department, role)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        new.email,
        new.raw_user_meta_data->>'student_id',
        new.raw_user_meta_data->>'department',
        'STUDENT' -- Default always STUDENT. No self-promotion.
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: Update registered_count on events
CREATE OR REPLACE FUNCTION public.update_event_registration_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.events
        SET registered_count = registered_count + 1
        WHERE id = NEW.event_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.events
        SET registered_count = GREATEST(0, registered_count - 1)
        WHERE id = OLD.event_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS on_event_registration_changed ON public.event_registrations;
CREATE TRIGGER on_event_registration_changed
    AFTER INSERT OR DELETE ON public.event_registrations
    FOR EACH ROW EXECUTE FUNCTION public.update_event_registration_count();

-- --------------------------------------------------------------
-- 13. STORAGE BUCKETS & ACCESS POLICIES
-- --------------------------------------------------------------
-- Insert buckets into storage.buckets if they do not exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('club-logos', 'club-logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('event-posters', 'event-posters', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage RLS Policies:
-- Anyone can view files in public buckets
CREATE POLICY "Public Access for club-logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'club-logos');

CREATE POLICY "Public Access for event-posters"
ON storage.objects FOR SELECT
USING (bucket_id = 'event-posters');

-- Authenticated users can upload to club-logos and event-posters
CREATE POLICY "Authenticated users can upload club logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'club-logos');

CREATE POLICY "Authorized users can update club logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'club-logos');

CREATE POLICY "Authorized users can delete club logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'club-logos');

CREATE POLICY "Authenticated users can upload event posters"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'event-posters');

CREATE POLICY "Authorized users can update event posters"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'event-posters');

CREATE POLICY "Authorized users can delete event posters"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'event-posters');
