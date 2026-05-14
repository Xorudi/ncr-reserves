/**
 * Auth helpers around the Supabase client.
 *
 * Design:
 *   • The whole module is a no-op when Supabase isn't configured (offline
 *     dev mode). `getSession()` resolves to null, sign-in always errors.
 *   • The session is persisted by the SDK; we just surface readable
 *     wrappers and a typed view of `app_metadata.biz_ids`.
 *   • biz_ids are server-controlled (writable only with the service_role
 *     key) — the client cannot escalate by editing user_metadata.
 */
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type AuthState =
  | { status: 'loading' }
  | { status: 'unconfigured' }                     // env vars missing → run offline
  | { status: 'signed-out' }
  | { status: 'signed-in'; session: Session; bizIds: readonly string[] };

/** Extract the server-controlled biz_ids allow-list from an active session. */
export function extractBizIds(session: Session | null): readonly string[] {
  if (!session) return [];
  // app_metadata is server-controlled (service_role only). user_metadata is
  // user-writable and MUST NOT be trusted for authorisation.
  const meta = (session.user.app_metadata ?? {}) as { biz_ids?: unknown };
  const raw  = meta.biz_ids;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === 'string');
}

/** Current session (cached on disk by the SDK). Null when not signed in. */
export async function getSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

/** Subscribe to auth changes. Returns an unsubscribe fn. */
export function onAuthChange(cb: (s: Session | null) => void): () => void {
  if (!supabase) return () => { /* no-op */ };
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    cb(session);
  });
  return () => data.subscription.unsubscribe();
}

/**
 * Sign in with email + password.
 * Returns null on success, or a user-friendly error message on failure.
 * Never expose raw Supabase error codes to the UI (information disclosure).
 */
export async function signIn(email: string, password: string): Promise<string | null> {
  if (!supabase) return 'Auth no configurat en aquest entorn.';

  // Defensive client-side checks. The real validation runs server-side.
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@') || cleanEmail.length > 320) {
    return 'Email no vàlid.';
  }
  if (!password || password.length < 8 || password.length > 200) {
    return 'Contrasenya no vàlida.';
  }

  const { error } = await supabase.auth.signInWithPassword({
    email:    cleanEmail,
    password,
  });

  if (error) {
    // Map well-known errors to neutral messages; default to a generic line
    // so we don't leak whether the email exists.
    const msg = error.message?.toLowerCase() ?? '';
    if (msg.includes('rate')) return 'Massa intents. Torna-ho a provar d\'aquí una estona.';
    if (msg.includes('email not confirmed')) return 'Compte no confirmat. Contacta amb l\'administrador.';
    return 'Credencials incorrectes.';
  }
  return null;
}

/** Sign out and clear the persisted session. */
export async function signOut(): Promise<void> {
  if (!supabase) return;
  try { await supabase.auth.signOut(); } catch { /* swallow — best-effort */ }
}
