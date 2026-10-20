-- Add profile fields expected by the app schema but absent from the connected project.
-- Safe to run more than once; existing values, RLS, and bucket visibility remain intact.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS student_id TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS department TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Make the new column visible to PostgREST immediately.
NOTIFY pgrst, 'reload schema';
