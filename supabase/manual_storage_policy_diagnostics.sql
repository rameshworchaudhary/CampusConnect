-- READ-ONLY diagnostics for CampusConnect Storage. Run queries in order in
-- Supabase SQL Editor. No placeholders, DDL, DML, or migration-history edits.
--
-- Identity reference (do not interchange these values):
--   club-admin profile/auth user: e7198a4a-e075-43a3-afbd-7508faeca60f
--   assigned club:               e42a2a87-6db6-423a-b30e-51d32b8099f9
-- The failed request paths previously shown used folder 6ea72fc3-3741-49b3-992e-1d5583ccac73.
-- That is only an observed object-folder UUID; this file does not assume who owns it.

-- 1) Confirm required relations and RLS flags without assuming a relation exists.
SELECT n.nspname AS schema_name, c.relname AS relation_name,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS force_rls
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE (n.nspname='storage' AND c.relname IN ('objects','buckets'))
   OR (n.nspname='public' AND c.relname IN ('profiles','clubs','events','announcements'))
ORDER BY n.nspname, c.relname;

-- 2) Inspect only columns that exist. jsonb-based queries below tolerate
-- optional columns such as profiles.is_active without referencing them directly.
SELECT table_name, column_name, data_type, udt_name, is_nullable
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name IN ('profiles','clubs','events','announcements')
  AND column_name IN (
    'id','role','is_active','assigned_club_id','assigned_admin_id','status',
    'approval_status','logo_path','club_id','poster_path','published','is_published',
    'image_path'
  )
ORDER BY table_name, ordinal_position;

-- 3) Bucket privacy and upload constraints. Expected: four rows, public=false,
-- 5242880 bytes, and only image/jpeg, image/png, image/webp.
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id IN ('avatars','event-posters','club-logos','announcement-images')
ORDER BY id;

-- 4) Every policy can affect access because permissive policies combine with OR.
-- Review all rows, including policies whose names are not in local migrations.
SELECT policyname, permissive, cmd, roles, qual, with_check
FROM pg_catalog.pg_policies
WHERE schemaname='storage' AND tablename='objects'
ORDER BY policyname;

-- 5) Check SQL table privileges needed by Storage API authorization. RLS
-- policies alone do not grant SQL privileges. SELECT is needed for anon signed
-- URL creation; the RLS predicates must still limit which object rows are visible.
SELECT grantee, privilege_type, is_grantable
FROM information_schema.role_table_grants
WHERE table_schema='storage' AND table_name='objects'
  AND grantee IN ('anon','authenticated','service_role')
ORDER BY grantee, privilege_type;
SELECT has_table_privilege('anon','storage.objects','SELECT') AS anon_has_select,
       has_table_privilege('authenticated','storage.objects','SELECT') AS authenticated_has_select;
SELECT has_schema_privilege('anon','storage','USAGE') AS anon_has_storage_schema_usage,
       has_schema_privilege('authenticated','storage','USAGE') AS authenticated_has_storage_schema_usage;

-- 6) Inspect helper definitions safely. Missing functions return no rows rather
-- than raising an invalid regprocedure error. Check prosecdef and proconfig.
SELECT n.nspname AS schema_name, p.proname,
       pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer,
       p.proconfig AS function_settings,
       pg_catalog.pg_get_userbyid(p.proowner) AS owner,
       pg_catalog.pg_get_functiondef(p.oid) AS definition
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN ('cc_can_manage_storage_folder','cc_is_active_super_admin','is_super_admin','can_manage_club')
ORDER BY p.proname, arguments;

-- 7) Verify the known club-admin relationship. The output distinguishes the
-- profile UUID from the assigned club UUID. JSON extraction avoids errors if
-- optional columns are absent; the column inventory in query 2 shows that fact.
SELECT p.id AS profile_user_id,
       to_jsonb(p)->>'role' AS profile_role,
       to_jsonb(p)->>'is_active' AS profile_is_active,
       to_jsonb(p)->>'assigned_club_id' AS profile_assigned_club_id,
       to_jsonb(c)->>'id' AS club_id,
       to_jsonb(c)->>'status' AS club_status,
       to_jsonb(c)->>'assigned_admin_id' AS club_assigned_admin_id
FROM public.profiles p
LEFT JOIN public.clubs c
  ON to_jsonb(c)->>'id'='e42a2a87-6db6-423a-b30e-51d32b8099f9'
  OR to_jsonb(c)->>'assigned_admin_id'=p.id::text
WHERE p.id='e7198a4a-e075-43a3-afbd-7508faeca60f'::uuid
ORDER BY to_jsonb(c)->>'id';

-- 8) Check the two failed object references seen in the browser log. No folder
-- ownership is inferred from the path; compare the folder UUID to query 7.
WITH attempted(bucket_id, object_name) AS (
  VALUES
    ('announcement-images','6ea72fc3-3741-49b3-992e-1d5583ccac73/350d9d29-38c4-4c2c-b04c-f257600de628.jpg'),
    ('event-posters','6ea72fc3-3741-49b3-992e-1d5583ccac73/9b68789a-9acb-4ef2-b276-0d1964bf9e10.jpg')
)
SELECT a.bucket_id, a.object_name,
       (o.id IS NOT NULL) AS object_exists,
       to_jsonb(o)->>'owner_id' AS owner_id,
       to_jsonb(o)->>'created_at' AS created_at,
       to_jsonb(o)->>'metadata' AS metadata
FROM attempted a
LEFT JOIN storage.objects o ON o.bucket_id=a.bucket_id AND o.name=a.object_name
ORDER BY a.bucket_id;

-- 9) Check anonymous parent-table SELECT policies. Read their USING expressions;
-- policy presence alone does not prove they expose only the intended rows.
SELECT tablename, policyname, permissive, roles, qual
FROM pg_catalog.pg_policies
WHERE schemaname='public'
  AND tablename IN ('events','clubs','announcements')
  AND cmd='SELECT'
ORDER BY tablename, policyname;

-- OPTIONAL helper simulation, only if query 6 confirms the function exists.
-- This transaction changes JWT claim settings only for the current transaction
-- and rolls them back. It does not write database rows or alter policies.
-- Expected for the confirmed club admin: true for the assigned club UUID and
-- false for a different folder unless a verified super-admin role applies.
-- BEGIN;
-- SELECT set_config('request.jwt.claim.sub','e7198a4a-e075-43a3-afbd-7508faeca60f',true),
--        set_config('request.jwt.claim.role','authenticated',true),
--        set_config('request.jwt.claims','{"sub":"e7198a4a-e075-43a3-afbd-7508faeca60f","role":"authenticated"}',true);
-- SELECT auth.uid() AS simulated_user,
--        public.cc_can_manage_storage_folder('e42a2a87-6db6-423a-b30e-51d32b8099f9') AS can_manage_assigned_club,
--        public.cc_can_manage_storage_folder('6ea72fc3-3741-49b3-992e-1d5583ccac73') AS can_manage_observed_folder;
-- ROLLBACK;
