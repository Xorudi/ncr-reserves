/**
 * Supabase client — singleton.
 * Returns null when env vars are not set (offline / dev without backend).
 *
 * Required env vars:
 *   VITE_SUPABASE_URL       https://xxxx.supabase.co
 *   VITE_SUPABASE_ANON_KEY  eyJ...
 *
 * Auth model: one Supabase Auth user per device/venue. The session is
 * persisted to localStorage by the SDK (under the key `sb-<project>-auth-token`)
 * and auto-refreshed before expiry. RLS policies in supabase/auth-migration.sql
 * scope every read/write to the authenticated user's `app_metadata.biz_ids`.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL  as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  URL && KEY
    ? createClient(URL, KEY, {
        realtime: { params: { eventsPerSecond: 20 } },
        auth: {
          // Persist & auto-refresh the JWT so the device stays signed in.
          persistSession:   true,
          autoRefreshToken: true,
          // We never use the URL hash for OAuth callbacks here — disabling
          // this prevents accidental session injection via crafted URLs.
          detectSessionInUrl: false,
          // Storage key namespaced so multiple Supabase apps could coexist.
          storageKey: 'ncr-reserves-auth',
        },
      })
    : null;

/** True when Supabase is configured AND the browser reports online */
export const isCloudAvailable = (): boolean =>
  supabase !== null && navigator.onLine;

/** True when env vars are present — the app should require sign-in */
export const isAuthRequired = (): boolean => supabase !== null;
