/**
 * Supabase client — singleton.
 * Returns null when env vars are not set (offline / dev without backend).
 *
 * Required env vars:
 *   VITE_SUPABASE_URL       https://xxxx.supabase.co
 *   VITE_SUPABASE_ANON_KEY  eyJ...
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL  as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  URL && KEY
    ? createClient(URL, KEY, {
        realtime: { params: { eventsPerSecond: 20 } },
        auth:     { persistSession: false },          // app uses its own auth
      })
    : null;

/** True when Supabase is configured AND the browser reports online */
export const isCloudAvailable = (): boolean =>
  supabase !== null && navigator.onLine;
