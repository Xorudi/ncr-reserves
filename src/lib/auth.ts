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
 *
 * Resilience:
 *   • `refreshSession()` returns the *refreshed* session or null. Used by
 *     the app's auth gate to recover from transient refresh failures
 *     (network blips, slow servers) without bouncing the user to login.
 *   • `signOut()` dispatches a window event `ncr:manual-signout` BEFORE
 *     calling the SDK, so the gate's auth listener can distinguish a
 *     genuine user-initiated sign-out from a transient SIGNED_OUT event
 *     fired by the SDK during refresh trouble. Treat that as the truth.
 */
import type { Session, AuthChangeEvent } from '@supabase/supabase-js';
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

/**
 * Force a refresh against the auth endpoint using the persisted refresh
 * token. Returns the refreshed session on success, or null on failure
 * (network OR auth error — caller decides what to do).
 *
 * Use this BEFORE concluding "the user is signed out" on initial load
 * or on a SIGNED_OUT event we suspect is a transient hiccup.
 */
export async function refreshSession(): Promise<Session | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) return null;
    return data.session ?? null;
  } catch {
    return null;
  }
}

/** Subscribe to auth changes. Returns an unsubscribe fn. */
export function onAuthChange(
  cb: (event: AuthChangeEvent, s: Session | null) => void,
): () => void {
  if (!supabase) return () => { /* no-op */ };
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    cb(event, session);
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

/**
 * Sign out and clear the persisted session.
 *
 * Dispatches `ncr:manual-signout` BEFORE the SDK call so the App's
 * auth-state listener knows this SIGNED_OUT event came from a deliberate
 * user action (not from a transient refresh failure). Without that
 * signal, the listener would have to treat every SIGNED_OUT as truth
 * and could kick the user out on a network hiccup.
 */
export async function signOut(): Promise<void> {
  if (!supabase) return;
  if (typeof window !== 'undefined') {
    try { window.dispatchEvent(new Event('ncr:manual-signout')); } catch { /* noop */ }
  }
  try { await supabase.auth.signOut(); } catch { /* swallow — best-effort */ }
}
