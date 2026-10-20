# CampusConnect migration compatibility and submission audit

Audit date: 2026-10-20. Verified project ref: `fjfmnamqcupapnwsoled`.

## Live baseline evidence

- Supabase MCP `list_migrations` returned an empty migration list. Read-only table, policy, trigger, and Storage queries returned a populated CampusConnect schema. The empty migration registry is drift; it does not mean the database is empty.
- Live profile role enum is lowercase (`student`, `club_admin`, `admin`). Profiles already include `student_id` and `assigned_club_id`; `profiles.is_active` is absent.
- Clubs use `status` (`pending`, `approved`, `rejected`) and `assigned_admin_id`; the five feature fields `meeting_schedule`, `meeting_location`, `faculty_advisor`, `contact_email`, and `contact_phone` are absent.
- Events use `published`, `is_platform_event`, `poster_path`; `events.club_id` is currently NOT NULL. Announcements use `published`, `club_id`; `announcements.image_path` is absent.
- Signup trigger exists but current `handle_new_user()` inserts only profile ID/name/email/role; registration `student_id` and `department` metadata are not persisted by the trigger.
- Live Storage has four private buckets, each configured for 5 MiB JPEG/PNG/WebP. `storage.objects` has exactly three authenticated own-avatar policies: SELECT `Users read their own avatars`; INSERT `Users can upload their own avatars`; UPDATE `Users can update their own avatars`. Their live predicates scope `bucket_id='avatars'` and the first folder name to `auth.uid()`; UPDATE has the same predicate for USING and WITH CHECK. No avatar DELETE policy was reported.
- Public parent SELECT policies exist for clubs, events, and announcements. The current event predicate requires a matching club, so a platform event with `club_id IS NULL` is not public through that policy.
- Live profile status/governance trigger/helper functions and per-table RLS policies exist. No active column means helper code using `to_jsonb(profile)->>'is_active'` with a true fallback cannot enforce deactivation in production.

## Local migration chain, chronological review

| Migration | Assessment against live schema | Evidence / risk |
|---|---|---|
| `202610160001_security_stabilization.sql` | **Incompatible; do not run.** | Uses uppercase role labels (`SUPER_ADMIN`, `CLUB_ADMIN`, `STUDENT`) against lowercase `app_role`; expects `profiles.is_active`, club `approval_status`/`is_published`, membership `user_id`/review fields, event `is_published`, and announcement `is_active`, while live uses different columns. It also installs policies and Storage rules based on those names and documents logo/poster buckets as public. It has no explicit encompassing transaction, so do not assume a failed execution is all-or-nothing. |
| `202610160002_profile_club_relationships.sql` | **Redundant/conditional; do not blindly replay.** | Live already has both profile/club relationship FKs. This script can rename equivalent constraints to its own names and validates them, which may scan existing rows and fail on orphans. It is unnecessary for the current relationship schema and should be represented by the verified live baseline instead. |
| `202610160003_profile_event_storage_hardening.sql` | **Incompatible; do not run.** | References `club_memberships.user_id`, `clubs.approval_status`/`is_published`, and event `is_published`; live has `student_id`, `status`, and `published`. It runs an `UPDATE events` to reconcile registration counts and overwrites the signup/profile functions. The live count trigger already exists. |
| `202610170000_add_club_admin_role_enum.sql` | **Already present; individually idempotent.** | Live enum already contains lowercase `club_admin`; the guard skips `ALTER TYPE`. This does not make the earlier incompatible chain safe. |
| `202610170001_profile_role_governance_alignment.sql` | **Partly redundant; staging review required.** | Adds profile IDs/fields and governance function/trigger already represented in live schema/policy inventory. It expects `audit_logs` columns and existing helper/policy details. Its active-super-admin helper treats a missing `is_active` as true; it must follow the schema addition before it can enforce status. No history record proves whether this migration produced the live objects. |
| `202610170002_private_storage_images.sql` | **Conflicting and includes production data changes; do not run as-is.** | Adds `image_path`, updates existing avatar/logo/poster references to rewrite URL strings, upserts bucket settings, and replaces/creates broad owner-folder policies. It drops only the avatar SELECT policy name and leaves the live avatar INSERT/UPDATE policies, producing overlaps. The URL normalization is DML and the bucket upsert is unnecessary because live bucket settings already match. |
| `202610170003_storage_bucket_policies.sql` | **Conflicts with 170002; do not run in sequence.** | Adds `image_path` again and installs a second set of permissive Storage policies; PostgreSQL combines permissive policies with OR, so the broader 170002 rules remain. It also upserts the three entity buckets. These policies are not safely replacing the previous generation. |
| `202610170004_storage_policy_alignment.sql` | **Current live preflight matches; chain placement is incompatible.** | Its exact three-avatar-policy preflight matches the current live names/definitions. After 170002/170003, the count and definitions differ, so it fails. It also combines schema additions, global active-account guards, trigger/policy changes on parent tables, and Storage replacement in one transaction, making rollback and independent review harder. It does not require an exact inventory of all parent permissive SELECT policies before replacing one event policy. |

The CLI treats the local migrations as pending when remote history is empty. A normal replay therefore reaches incompatible 160001 before any newer compatibility file. Do not run `supabase db push`, `supabase migration repair`, `db reset`, or any history/baseline operation against the live project. Do not rename, drop, or mark existing migrations applied to make the chain appear clean.

## Application/schema compatibility map

| Schema fact | Existing application use | Smallest compatible change |
|---|---|---|
| `announcements.image_path` missing | Announcement create/update/delete and image displays query/write this field. | Add nullable `text`; old announcements remain image-free. |
| `profiles.is_active` missing | Auth/profile mapping, Super Admin user listing and activation/deactivation UI query/update it. Helpers currently default missing status to active. | Add `boolean NOT NULL DEFAULT true`, then make every authorization helper/policy enforce it. The default preserves current accounts as active; test admin deactivation before production. |
| Club registration fields missing | Form and local service collect/save meeting schedule/location, advisor, contact email/phone; current live inserts fail or would not persist them. | Add each as nullable `text`; preserve old rows. |
| `events.club_id` NOT NULL | Super Admin platform-event form inserts NULL for platform-wide events. | Drop NOT NULL while retaining the existing FK; add no speculative column. Ensure the event SELECT and registration policies explicitly gate NULL-club events on `is_platform_event` and `published`. |
| Signup metadata trigger | Registration submits full name, student ID, department; current trigger persists only name/email/role. | Update the existing trigger function to persist the two optional fields and continue forcing role to `student`; keep existing trigger attachment. |
| Club/event/announcement entity image references | App stores `logo_path`, `poster_path`, and proposed `image_path` as object paths and signs URLs at display time. | Keep buckets private; referenced objects can be signed only when policy permits. Avoid rewriting records unless a separate audited migration is justified. |

Application code paths inspected: `src/services/authService.ts`, `userService.ts`, `clubService.ts`, `eventService.ts`, `announcementService.ts`, `storageService.ts`; upload usages in the club, student, and Super Admin dashboards. Service writes now use the corresponding live column names, but the missing schema still blocks these paths at runtime.

## Policy and path review

- Parent-table policies and Storage policies are both required. A Storage SELECT subquery to `events`, `clubs`, or `announcements` runs under the caller's table RLS. Public image SELECT should require an object path referenced by an eligible published/approved parent row; parent policy changes and Storage object policies must be staged together and tested for both anon and authenticated roles.
- Private buckets do not make `getPublicUrl()` private. The reviewed `storageService.ts` creates short-lived signed URLs and stores object paths. It rejects a URL for the wrong bucket and does not use `getPublicUrl()`. This is code review, not a live signed-URL authorization test.
- App paths use a first folder of user UUID for avatars and for Super Admin-created images; club-admin event/announcement/logo uploads use assigned-club UUID; student club-registration logos use the student UUID. Folder-based policies must account for these documented variants. Super Admin-created club images may be inaccessible for later updates by a newly assigned club admin under a strict club-folder-only write predicate. Replace/cleanup behavior for legacy refs may leave an orphan if the object folder is not the assigned club ID.
- The proposed storage policy set lets a student submit a logo in their own folder. It should also allow the student to delete only their own *unreferenced* pending logo; the current 170004 proposal provides that rule, while the initial 170004 update/delete policy as originally drafted did not. The separate proposal includes the safe unreferenced-delete predicate.
- The existing `Club admins create announcements` policy accepts `club_id IS NULL` for any authenticated creator, allowing global announcements. Super Admin-only global creation is required. The current `View published events` policy does not expose NULL-club platform events. Both parent policies need narrow replacements, not just Storage rules.
- Existing permissive policy combinations must be inventoried: multiple PERMISSIVE policies OR together; RESTRICTIVE policies AND with the permissive result. Do not assume a new narrower policy narrows access while a broad old policy remains. The separate proposal replaces the exact known announcement INSERT and event SELECT policy names, and replaces exactly the verified Storage policy inventory.
- A user-delete function in `src/services/userService.ts` deletes only `public.profiles`. There is no client-side Auth Admin delete call (which would be unsafe); the auth user remains. Complete deletion requires a server-side Edge Function/backend using Auth Admin, with authorization and foreign-key behavior tested. Treat the current UI operation as profile deletion, not account deletion.

## Proposed staging-only files

- `001_schema_compatibility.sql`: nullable feature fields, active status with active default, platform event nullability, and signup/own-profile metadata persistence.
- `002_authorization_alignment.sql`: active-account helpers and restrictive guards, assigned-club checks, protected club updates, Super Admin-only global announcement creation, and platform-event public visibility.
- `003_storage_policy_alignment.sql`: exact preflight for the three verified avatar policies, private bucket assertion without bucket upserts, eligible referenced public reads, active-user private reads/writes, assigned-club authorization, and student deletion of only an unreferenced own registration logo.

These are review drafts. Risk remains around exact live policy drift, custom triggers/grants, legacy URL data, image object rows whose paths do not match current form folder IDs, and the semantics of all existing policy OR/AND combinations. Validate each against a staging clone before production planning. The drafts were not executed by a PostgreSQL parser or database.

## Local verification and next safe commands

Executed on 2026-10-20:

- `npm run lint` — passed (`tsc --noEmit`).
- `npm run build` — passed; Vite reports a 714.98 kB minified JS chunk (chunk-size warning only).
- `git diff --check` — passed; Git printed LF-to-CRLF working-copy warnings only.
- No test script is present in `package.json`. No `psql`, `postgres`, `initdb`, Supabase CLI, or Docker executable was available. SQL execution and DB/RLS integration tests are **unverified**.
- Read-only browser smoke checks from the previous audit showed the public club page loaded and the events page settled to the empty state; this does not verify authenticated workflows.

After an isolated staging schema fixture and suitable PostgreSQL/Supabase CLI are available, use a staging-only connection and these commands from the repository root (replace `STAGING_DATABASE_URL` only in the shell environment; never echo it):

```powershell
npm run lint
npm run build
git diff --check
psql "$env:STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/proposals/001_schema_compatibility.sql
psql "$env:STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/proposals/002_authorization_alignment.sql
psql "$env:STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/proposals/003_storage_policy_alignment.sql
```

The staging database must be isolated and have a reviewed baseline matching the current live schema before the SQL commands. Do not point these commands at production. Do not use `supabase start` at this repository root until the incompatible `supabase/migrations/` chain is reconciled; the CLI starts the local stack with the repository's migrations. Do not use `db reset` under the current safety instructions.

## Required pre-submission manual checks

1. **Student:** register with full name/student ID/department; confirm the profile fields persist after email verification and a fresh sign-in; upload, display, replace, and remove an own avatar; verify a second student cannot read/write it; request a membership and register/cancel for a published event.
2. **Club Admin:** verify only the assigned club loads; edit each metadata field; create/update/publish/unpublish/delete an event and announcement, with and without images; verify another club admin cannot read or mutate any object; verify pending/unapproved content is not visible to anon users.
3. **Super Admin:** assign/unassign roles; deactivate/reactivate a test account and confirm all authenticated data/storage actions are denied while inactive; approve/reject a club; create a platform event with NULL club and a global announcement; verify anon sees only published/approved referenced images; verify unauthorized direct row/object paths fail.
4. **Account removal:** confirm UI copy and behavior; until Auth Admin deletion exists, do not describe profile-row deletion as deleting an Auth account.

Run positive and negative cases with dedicated staging accounts. No such accounts or staging database were available in this audit.

## Isolated staging run (2026-10-20)

- Created a separate Supabase project `campusconnect-staging` in the explicitly selected organization and `ap-northeast-1`; verified healthy project ref `xguansmirjarjuvelexq`, URL `https://xguansmirjarjuvelexq.supabase.co`. The organization returned a $0/month project quote. No production project, data, credentials, or Storage objects were copied.
- Applied `000_staging_schema_baseline.sql` (reconstructed from read-only production schema/policy metadata, no application rows), then `001_schema_compatibility.sql`, `002_authorization_alignment.sql`, `003_storage_policy_alignment.sql`, and `004_api_function_acl_hardening.sql`. All five staging migrations succeeded and are recorded on staging only.
- Read-only staging checks confirmed the expected announcement image field, non-null/default active profile status, five nullable club metadata fields, nullable event club ID, RLS enabled on all eight app tables, the capacity and membership-identity triggers, six Storage object policies, four private 5 MiB image buckets, and zero application or Storage rows.
- `SET LOCAL ROLE anon` and `SET LOCAL ROLE authenticated` SELECTs of the empty public tables and Storage objects completed without permission or policy SQL errors. Function ACL checks confirmed anon cannot execute `is_super_admin`, `can_manage_club`, or the three trigger-only functions. These are structural smoke checks only; without JWT subjects and rows they do not verify allow/deny behavior for actual users.
- The security advisor now reports eight SECURITY DEFINER functions callable by `authenticated`. They include policy helpers and intended authenticated RPCs; review their API exposure further before production. Anonymous callable SECURITY DEFINER findings were removed by migration 004.
- No dedicated staging Auth accounts, email verification path, or browser session were available through the connected tools. Authentication/profile creation, role-specific table/Storage checks, capacity boundary behavior, uploads, signed URLs, and end-to-end workflows remain unverified. The fresh baseline is a schema fixture reconstructed from catalog evidence, not a verified provider backup/restore of production schema; production rollout still requires a recoverable backup and restore test.

## Staging proposal corrections (2026-10-20)

The staging project already had the original baseline plus proposal migrations 001-004 recorded. Read-only catalog inspection found and corrected these defects without touching production:

- In the original Storage proposal, unqualified `name` inside a `clubs c` subquery resolved to `c.name`, not the Storage row. The public logo-read policy therefore did not match `clubs.logo_path` to an object path, and the unreferenced-logo check had the same defect. Corrected predicates explicitly use `objects.name`.
- The membership-cancel policy matched only the caller ID and `pending` status. It now also requires an active Student profile. The independent restrictive active-account guard remains in place.
- The audit log allowed authenticated clients to insert caller-controlled actor/action/detail values. The corrected ACL-hardening proposal removes that policy and gives authenticated users only SELECT, which remains row-filtered by RLS. Trigger-owned governance audit inserts continue under the function owner. Frontend client-side audit writes were removed; non-governance audit coverage is not provided by a trusted server trigger and remains a functional limitation.
- Nullable `events.club_id` made platform events possible, but did not itself prevent a clubless event from omitting the platform marker. An additive CHECK constraint now requires `is_platform_event = true` when `club_id` is NULL. The existing event-insert policy allows only an active Super Admin for NULL-club events through `can_manage_club(NULL)`; the event registration trigger locks the event row and counts registrations before insert, so its design serializes capacity decisions. Actual concurrent behavior still needs test accounts.
- Catalog review showed `authenticated` retained table-level TRUNCATE on `audit_logs`; RLS does not protect TRUNCATE. Staging correction 006 revokes all table privileges from `PUBLIC`, `anon`, and `authenticated`, then grants authenticated SELECT only. The postgres-owned SECURITY DEFINER governance trigger remains able to insert audit rows; service_role privileges are untouched.

Staging-only corrections 005, 006, and 007 were applied and recorded. Read-only post-apply checks confirmed the corrected logo path expressions, Student-only membership DELETE policy, absent client audit INSERT policy, audit table SELECT-only grants for authenticated, platform-event constraint, entity-specific Storage folder roots for eligible reads, all four buckets still private with their original limits, and zero app/Storage rows. These are schema/catalog checks, not role behavior tests.

The orphaned club-logo cleanup remains unresolved: initial student uploads live under the student's UUID, while replacements use the club UUID. A Club Admin cannot safely delete the former student-owned object. A path-only cleanup queue was rejected because a manager who can update the row could manufacture a queue entry for a different object. A protected server-side cleanup mechanism or trusted object-to-club ownership mapping with path-validation triggers is required; do not widen folder deletion.

The historic `202610170004_storage_policy_alignment.sql` preflight fails closed when the `storage.objects` policy count is not exactly three or any of the three named avatar policies/expressions is absent. The earlier read-only baseline report recorded those exact three names, so it does not support a current claim that the original baseline names were different. The historical migrations `170002` and `170003` drop/replace/add other named policies; if either has run before `170004`, the count and names no longer match, which explains the preflight failure in that chain. Do not replay that chain to work around the mismatch.

Storage review also found parent image references were not tied to the corresponding object folder. The corrected public/authenticated eligible-read policies in proposal 003 and staging correction 007 now require event images to live under the event's club UUID (or creator UUID for platform events), club logos under the club or creator UUID, and announcement images under the announcement's club UUID (or creator UUID for global announcements), in addition to publication/approval and exact path reference. Buckets remain private. This narrows disclosure through a manipulated parent path, but no role-based object tests were possible without test accounts.
