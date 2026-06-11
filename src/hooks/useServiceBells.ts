/**
 * useServiceBells — the service clock's two bells.
 *
 *  🔔 diningClose  — one-shot reminder to start clearing the dining room
 *                    (move guests to bar/terrace so the room can be reset).
 *  🔔 kitchenClose — when the LAST kitchen of the day shuts, prompt the
 *                    operator to review the "Tancament del dia" sheet.
 *
 * Times come from the per-business shifts (Més → Horaris). Each bell fires
 * at most ONCE per business per calendar day — the flag is persisted in
 * localStorage so a reload doesn't re-ring it mid-service.
 *
 * Also returns `kitchenClosed` so the UI can badge the Tancament entry.
 */
import { useEffect, useState } from 'react';
import { toast } from '@/components/shared/Toaster';
import type { BizShift } from '@/types';

const CHECK_MS = 30_000;

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function flagKey(kind: 'dining' | 'kitchen', bizId: string): string {
  return `ncr-bell-${kind}-${bizId}-${todayIso()}`;
}
function rung(kind: 'dining' | 'kitchen', bizId: string): boolean {
  try { return localStorage.getItem(flagKey(kind, bizId)) === '1'; } catch { return false; }
}
function ring(kind: 'dining' | 'kitchen', bizId: string): void {
  try { localStorage.setItem(flagKey(kind, bizId), '1'); } catch { /* ignore */ }
}

/** Latest configured kitchenClose across today's active shifts — the
 *  "kitchen of the day is done" moment. HH:MM comparison is enough: bells
 *  are pre-midnight by nature (23:00, 22:30…). */
function lastKitchenClose(shifts: BizShift[]): string | null {
  let last: string | null = null;
  for (const s of shifts) {
    if (!s.active || !s.kitchenClose) continue;
    if (!last || s.kitchenClose > last) last = s.kitchenClose;
  }
  return last;
}

export function useServiceBells(bizId: string, shifts: BizShift[]): { kitchenClosed: boolean } {
  const [kitchenClosed, setKitchenClosed] = useState(false);

  useEffect(() => {
    function check() {
      const now = nowHHMM();

      // ── Dining-room bell ────────────────────────────────────────────
      for (const s of shifts) {
        if (!s.active || !s.diningClose) continue;
        if (now >= s.diningClose && !rung('dining', bizId)) {
          ring('dining', bizId);
          toast('Tanca el menjador — convida els clients a bar/terrassa per preparar la sala', {
            icon: 'alert', tone: 'clay', ms: 15000,
            action: { label: 'Entesos', onClick: () => { /* ack only */ } },
          });
        }
      }

      // ── Kitchen bell + closed state ─────────────────────────────────
      const kc = lastKitchenClose(shifts);
      const closed = !!kc && now >= kc;
      setKitchenClosed(closed);
      if (closed && !rung('kitchen', bizId)) {
        ring('kitchen', bizId);
        toast('Cuina tancada — repassa el tancament del dia', {
          icon: 'check', tone: 'olive', ms: 15000,
          action: {
            label: 'Veure',
            onClick: () => window.dispatchEvent(new CustomEvent('app:open-dayclose')),
          },
        });
      }
    }

    check();
    const id = window.setInterval(check, CHECK_MS);
    return () => window.clearInterval(id);
  }, [bizId, shifts]);

  return { kitchenClosed };
}
