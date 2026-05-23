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

// ── Listener instrumentation ──────────────────────────────────────────────
// Repeated SIGNED_IN events in production were initially suspected to come
// from multiple listeners being mounted (StrictMode double-mount in dev,
// HMR re-runs, AuthProvider duplication). We track a per-listener id and
// the live count so we can PROVE there's only one. The dedup in App.tsx
// catches duplicate WORK; this tracks duplicate LISTENERS.
let listenerSeq        = 0;
let listenersActive    = 0;
function authDebugOn(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (localStorage.getItem('NCR_DEBUG_PERF') === 'true') return true;
    if (localStorage.getItem('NCR_DEBUG_AUTH') === 'true') return true;
  } catch { /* ignore */ }
  try {
    const isDev = Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);
    if (isDev) return true;
  } catch { /* ignore */ }
  return false;
}
function aLog(...args: unknown[]): void {
  if (!authDebugOn()) return;
  // eslint-disable-next-line no-console
  console.info('[ncr-auth]', ...args);
}

/** True when more than one auth listener is currently mounted. Exported
 *  for telemetry / debug overlays. */
export function getAuthListenerCount(): number { return listenersActive; }

/** Subscribe to auth changes. Returns an unsubscribe fn.
 *  Logs mount/cleanup with an id so we can detect duplicate listeners. */
export function onAuthChange(
  cb: (event: AuthChangeEvent, s: Session | null) => void,
): () => void {
  if (!supabase) return () => { /* no-op */ };
  const id = ++listenerSeq;
  listenersActive += 1;
  aLog(`listener mounted id=${id} active=${listenersActive}`);
  if (listenersActive > 1) {
    // eslint-disable-next-line no-console
    console.warn(`[ncr-auth] WARNING: ${listenersActive} auth listeners active — expected 1.`);
  }
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    cb(event, session);
  });
  let off = false;
  return () => {
    if (off) return;
    off = true;
    listenersActive -= 1;
    aLog(`listener cleanup id=${id} active=${listenersActive}`);
    try { data.subscription.unsubscribe(); } catch { /* ignore */ }
  };
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
