-- Ensure the two profile/club relationships used by PostgREST have stable names.
-- This preserves rows; validation fails safely if existing IDs are orphaned.

DO $$
DECLARE
    existing_name TEXT;
BEGIN
    SELECT c.conname INTO existing_name
    FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.conrelid = 'public.profiles'::regclass
      AND c.confrelid = 'public.clubs'::regclass
      AND c.conkey = ARRAY[(
          SELECT a.attnum FROM pg_attribute a
          WHERE a.attrelid = 'public.profiles'::regclass
            AND a.attname = 'assigned_club_id' AND NOT a.attisdropped
      )]::SMALLINT[]
      AND c.confkey = ARRAY[(
          SELECT a.attnum FROM pg_attribute a
          WHERE a.attrelid = 'public.clubs'::regclass
            AND a.attname = 'id' AND NOT a.attisdropped
      )]::SMALLINT[];

    IF existing_name IS NULL THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT fk_profiles_assigned_club
            FOREIGN KEY (assigned_club_id) REFERENCES public.clubs(id)
            ON DELETE SET NULL NOT VALID;
    ELSIF existing_name <> 'fk_profiles_assigned_club' THEN
        IF EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'public.profiles'::regclass
              AND conname = 'fk_profiles_assigned_club'
        ) THEN
            RAISE EXCEPTION 'Cannot standardize assigned_club_id FK: fk_profiles_assigned_club is already used';
        END IF;
        EXECUTE format(
            'ALTER TABLE public.profiles RENAME CONSTRAINT %I TO fk_profiles_assigned_club',
            existing_name
        );
    END IF;
END $$;

DO $$
DECLARE
    existing_name TEXT;
BEGIN
    SELECT c.conname INTO existing_name
    FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.conrelid = 'public.clubs'::regclass
      AND c.confrelid = 'public.profiles'::regclass
      AND c.conkey = ARRAY[(
          SELECT a.attnum FROM pg_attribute a
          WHERE a.attrelid = 'public.clubs'::regclass
            AND a.attname = 'assigned_admin_id' AND NOT a.attisdropped
      )]::SMALLINT[]
      AND c.confkey = ARRAY[(
          SELECT a.attnum FROM pg_attribute a
          WHERE a.attrelid = 'public.profiles'::regclass
            AND a.attname = 'id' AND NOT a.attisdropped
      )]::SMALLINT[];

    IF existing_name IS NULL THEN
        ALTER TABLE public.clubs
            ADD CONSTRAINT fk_clubs_assigned_admin
            FOREIGN KEY (assigned_admin_id) REFERENCES public.profiles(id)
            ON DELETE SET NULL NOT VALID;
    ELSIF existing_name <> 'fk_clubs_assigned_admin' THEN
        IF EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'public.clubs'::regclass
              AND conname = 'fk_clubs_assigned_admin'
        ) THEN
            RAISE EXCEPTION 'Cannot standardize assigned_admin_id FK: fk_clubs_assigned_admin is already used';
        END IF;
        EXECUTE format(
            'ALTER TABLE public.clubs RENAME CONSTRAINT %I TO fk_clubs_assigned_admin',
            existing_name
        );
    END IF;
END $$;

ALTER TABLE public.profiles VALIDATE CONSTRAINT fk_profiles_assigned_club;
ALTER TABLE public.clubs VALIDATE CONSTRAINT fk_clubs_assigned_admin;

-- Rebuild PostgREST's relationship cache after both named FKs are in place.
NOTIFY pgrst, 'reload schema';
