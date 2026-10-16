-- Run once in the Supabase SQL Editor if an existing auth.users row has no
-- matching public.profiles row. This is intentionally standalone and additive.
-- New and repaired profiles always receive the app_role value 'student';
-- existing profiles are untouched.

-- CampusConnect: Repair the signed-in user's missing profile
-- Safe approach: never accept a role from user metadata.

BEGIN;

-- Keep future signups compatible with the live profiles table shape.
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
        COALESCE(
            NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
            NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
            'Student'
        ),
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

-- Return type changed from the earlier void version; drop only this helper
-- function so it can be safely replaced with a profile-returning function.
DROP FUNCTION IF EXISTS public.ensure_own_profile();
CREATE FUNCTION public.ensure_own_profile()
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
    -- Identify the currently authenticated user.
    current_id := auth.uid();

    IF current_id IS NULL THEN
        RAISE EXCEPTION 'You must be signed in to create a profile.';
    END IF;

    -- Get trusted account identity and optional display name.
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

    -- Create only the signed-in user's profile.
    -- Never promote the user based on metadata.
    INSERT INTO public.profiles (id, full_name, email, role)
    VALUES (current_id, user_name, user_email, 'student')
    ON CONFLICT (id) DO NOTHING;

    -- Return the existing or newly created profile.
    SELECT p.*
    INTO result_profile
    FROM public.profiles AS p
    WHERE p.id = current_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile could not be loaded.';
    END IF;

    RETURN result_profile;
END;
$$;

-- Allow signed-in users to call the function.
REVOKE ALL ON FUNCTION public.ensure_own_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_own_profile() TO authenticated;

-- Refresh Supabase's API schema cache.
NOTIFY pgrst, 'reload schema';
COMMIT;
