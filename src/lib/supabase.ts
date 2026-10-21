import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Keep the initial callback URL before Supabase client initialization can
// consume auth tokens and remove them from the browser address bar.
export const initialAuthCallbackUrl = typeof window === 'undefined' ? '' : window.location.href;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY
)?.trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'https://your-project.supabase.co' &&
  supabaseAnonKey !== 'your-anon-key-here' &&
  supabaseAnonKey !== 'your-publishable-key-here'
);

// Read-only empty-state fallback for data views. Authentication always requires Supabase.
const LOCAL_STORAGE_KEY = 'campusconnect_local_db';

interface LocalDatabase {
  profiles: any[];
  clubs: any[];
  club_memberships: any[];
  events: any[];
  event_registrations: any[];
  announcements: any[];
  user_announcement_reads: any[];
  audit_logs: any[];
}

const getLocalDb = (): LocalDatabase => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return {
    profiles: [],
    clubs: [],
    club_memberships: [],
    events: [],
    event_registrations: [],
    announcements: [],
    user_announcement_reads: [],
    audit_logs: [],
  };
};

const saveLocalDb = (db: LocalDatabase) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(db));
  } catch {
    // ignore
  }
};

// The placeholder client prevents import-time crashes; all authentication and data
// mutations are disabled by callers while isSupabaseConfigured is false.
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : (createClient(
      supabaseUrl || 'https://placeholder.supabase.co',
      supabaseAnonKey || 'placeholder-anon-key',
      {
        auth: {
          persistSession: true,
          autoRefreshToken: false,
        },
      }
    ));

export { getLocalDb, saveLocalDb };
