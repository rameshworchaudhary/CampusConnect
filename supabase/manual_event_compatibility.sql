-- Add the optional event fields used by CampusConnect's event form and RSVP UI
-- to the existing events table shown in the Supabase schema diagram.
-- The app maps event_date/location/poster_url/is_published to
-- starts_at/venue/poster_path/published respectively.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_link TEXT,
  ADD COLUMN IF NOT EXISTS capacity INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS registered_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_platform_event BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS badge_label TEXT DEFAULT 'Open RSVP';

-- The current app also needs registration rows for RSVP state and counts.
CREATE TABLE IF NOT EXISTS public.event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'REGISTERED' CHECK (status IN ('REGISTERED', 'CANCELLED')),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.event_registrations TO authenticated;

DROP POLICY IF EXISTS "CampusConnect read event registrations" ON public.event_registrations;
CREATE POLICY "CampusConnect read event registrations"
ON public.event_registrations FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role::text = 'admin'
  )
  OR EXISTS (
    SELECT 1 FROM public.events e JOIN public.clubs c ON c.id = e.club_id
    WHERE e.id = event_id AND c.assigned_admin_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "CampusConnect student event registration" ON public.event_registrations;
CREATE POLICY "CampusConnect student event registration"
ON public.event_registrations FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND status = 'REGISTERED'
  AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role::text = 'student'
  )
  AND EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_id AND e.published
      AND (e.club_id IS NULL OR EXISTS (
        SELECT 1 FROM public.clubs c
        WHERE c.id = e.club_id AND c.status::text = 'approved'
      ))
  )
);

DROP POLICY IF EXISTS "CampusConnect cancel own registration" ON public.event_registrations;
CREATE POLICY "CampusConnect cancel own registration"
ON public.event_registrations FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.campusconnect_event_registration_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'REGISTERED' THEN
    UPDATE public.events SET registered_count = registered_count + 1 WHERE id = NEW.event_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'REGISTERED' THEN
    UPDATE public.events SET registered_count = GREATEST(0, registered_count - 1) WHERE id = OLD.event_id;
    RETURN OLD;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS campusconnect_event_registration_count ON public.event_registrations;
CREATE TRIGGER campusconnect_event_registration_count
AFTER INSERT OR DELETE ON public.event_registrations
FOR EACH ROW EXECUTE FUNCTION public.campusconnect_event_registration_count();

-- Reconcile counters from existing active registrations, if the table existed.
UPDATE public.events e
SET registered_count = (
  SELECT count(*)::INTEGER
  FROM public.event_registrations r
  WHERE r.event_id = e.id AND r.status = 'REGISTERED'
);

-- Audit records are client-submitted, so RLS binds their identity to the session.
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  target_identifier TEXT,
  details TEXT NOT NULL,
  ip_address TEXT,
  sha_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
DROP POLICY IF EXISTS "CampusConnect users insert own audit logs" ON public.audit_logs;
CREATE POLICY "CampusConnect users insert own audit logs"
ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (actor_email = (auth.jwt() ->> 'email'));
DROP POLICY IF EXISTS "CampusConnect admins read audit logs" ON public.audit_logs;
CREATE POLICY "CampusConnect admins read audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role::text = 'admin'
));

CREATE TABLE IF NOT EXISTS public.user_announcement_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, announcement_id)
);
ALTER TABLE public.user_announcement_reads ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.user_announcement_reads TO authenticated;
DROP POLICY IF EXISTS "CampusConnect users manage own announcement reads" ON public.user_announcement_reads;
CREATE POLICY "CampusConnect users manage own announcement reads"
ON public.user_announcement_reads FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

COMMIT;

-- PostgREST can now resolve events <-> event_registrations and the new tables.
NOTIFY pgrst, 'reload schema';
