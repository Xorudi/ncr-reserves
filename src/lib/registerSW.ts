/**
 * registerSW — installs the service worker (production only) and wires a
 * safe update flow.
 *
 * Update UX (no surprise mid-service reloads):
 *   1. A new SW installs in the background while the old one keeps serving.
 *   2. When it's ready AND there's already a controller (i.e. this is an
 *      update, not a first install), we surface a "Nova versió" toast with
 *      an "Actualitza" action.
 *   3. Tapping it tells the waiting SW to skipWaiting; on controllerchange
 *      we reload exactly once.
 *
 * If the operator ignores the toast, nothing breaks: navigations are
 * network-first, so the running tab still talks to the latest backend. The
 * new SW simply takes over on the next cold start.
 */
import { toast } from '@/components/shared/Toaster';

export function registerSW(): void {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // A new worker started installing.
      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            // An update (not the first install) is ready and waiting.
            toast('Nova versió disponible', {
              tone: 'olive',
              icon: 'info',
              ms: 12000,
              action: {
                label: 'Actualitza',
                onClick: () => reg.waiting?.postMessage('SKIP_WAITING'),
              },
            });
          }
        });
      });
    }).catch(() => { /* SW registration is best-effort; app works without it */ });

    // When the new SW takes control, reload once to pick up the new assets.
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  });
}
