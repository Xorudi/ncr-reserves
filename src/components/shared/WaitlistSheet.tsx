/**
 * WaitlistSheet — manage the live walk-in queue (parties waiting at the door).
 *
 * Used from both mobile/tablet and desktop. Renders as a bottom sheet via
 * AnimatedSheet. Lists currently-waiting parties with their wait time, a
 * "Avisar" action that marks them as notified, and a "Asseure" action that
 * removes them from the queue (operator handles actual table assignment via
 * the Walk-in flow).
 */
import React, { useEffect, useState } from 'react';
import AnimatedSheet from './AnimatedSheet';
import { Icon, I } from './Icons';
import { useAppStore } from '@/store/useAppStore';
import { toast } from './Toaster';
import type { WaitlistEntry, Reservation } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called after "Asseure": receives the freshly-created walk-in reservation
   *  so the shell can navigate to Reserves with it selected. */
  onSeated?: (res: Reservation) => void;
}

export default function WaitlistSheet({ open, onClose, onSeated }: Props) {
  const {
    selectedBusiness, waitlist,
    addToWaitlist, removeFromWaitlist, notifyWaitlist, seatFromWaitlist,
  } = useAppStore();

  // Re-render every 30s so the "X min" counters stay fresh while the sheet
  // is open. Cheap because the list is tiny.
  const [, force] = useState(0);
  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => force(n => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, [open]);

  const bizQueue = waitlist
    .filter(w => w.bizId === selectedBusiness)
    .sort((a, b) => a.addedAt - b.addedAt);

  const [name, setName]   = useState('');
  const [pax, setPax]     = useState(2);
  const [phone, setPhone] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(''); setPax(2); setPhone(''); setTouched(false);
  }, [open]);

  function handleAdd() {
    setTouched(true);
    if (!name.trim()) return;
    addToWaitlist({
      bizId: selectedBusiness,
      name:  name.trim(),
      pax,
      phone: phone.trim() || undefined,
    });
    setName(''); setPhone(''); setPax(2); setTouched(false);
    toast(`${name.trim()} a la cua`, { icon: 'check', tone: 'olive', ms: 1800 });
  }

  function handleNotify(w: WaitlistEntry) {
    notifyWaitlist(w.id);
    toast(`Avisat: ${w.name}`, { icon: 'check', tone: 'olive', ms: 1800 });
  }

  function handleSeat(w: WaitlistEntry) {
    const newRes = seatFromWaitlist(w.id);
    if (!newRes) return;
    toast(`${w.name} a taula · assigna-la`, {
      icon: 'check', tone: 'terracotta', ms: 2600,
    });
    onClose();
    // Defer so the sheet exit animation has room to play before the tab swap.
    setTimeout(() => onSeated?.(newRes), 240);
  }

  function handleRemove(w: WaitlistEntry) {
    const snap = { bizId: w.bizId, name: w.name, pax: w.pax, phone: w.phone, notes: w.notes };
    removeFromWaitlist(w.id);
    toast(`${w.name} eliminat`, {
      icon: 'x', tone: 'ink', ms: 5000,
      action: { label: 'Desfer', onClick: () => addToWaitlist(snap) },
    });
  }

  return (
    <AnimatedSheet open={open} onClose={onClose} zIndex={200}>
      <div style={{
        background: 'var(--paper)', borderRadius: '18px 18px 0 0',
        boxShadow: '0 -4px 28px rgba(0,0,0,.18)',
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)',
      }}>
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--ink-200)', margin: '10px auto 8px' }} />

        {/* Header */}
        <div style={{
          padding: '4px 18px 12px', display: 'flex', alignItems: 'center', gap: 10,
          borderBottom: 'var(--hair)',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 500,
              color: 'var(--ink-900)', letterSpacing: -.005, lineHeight: 1.05,
            }}>Llista d'espera</div>
            <div style={{
              fontSize: 11, color: 'var(--ink-500)', fontWeight: 600,
              letterSpacing: .06, marginTop: 3, fontFamily: 'var(--font-mono)',
            }}>
              {bizQueue.length === 0 ? 'cap grup esperant' : `${bizQueue.length} grups en cua`}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--ink-600)', fontFamily: 'inherit', fontSize: 14,
            fontWeight: 600, padding: '4px 6px',
          }}>Tancar</button>
        </div>

        {/* Scrollable middle: list */}
        <div className="scroll" style={{ flex: 1, overflowY: 'auto', padding: '8px 14px 12px' }}>
          {bizQueue.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '32px 16px',
              color: 'var(--ink-500)', fontSize: 13.5,
            }}>
              <div style={{
                fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--ink-800)',
                marginBottom: 6,
              }}>Cua buida</div>
              Afegeix un grup amb el formulari de sota quan estigui ple.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {bizQueue.map(w => <QueueRow key={w.id} w={w}
                onNotify={() => handleNotify(w)}
                onSeat={() => handleSeat(w)}
                onRemove={() => handleRemove(w)} />)}
            </div>
          )}
        </div>

        {/* Add form */}
        <div style={{
          padding: '14px 14px 4px',
          borderTop: 'var(--hair)', background: 'var(--cream)',
        }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-500)', letterSpacing: .06, textTransform: 'uppercase', marginBottom: 8 }}>
            Afegir grup
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              value={name} onChange={e => setName(e.target.value)}
              placeholder="Nom"
              style={{
                padding: '10px 12px', borderRadius: 10,
                border: `1.5px solid ${touched && !name.trim() ? 'var(--terracotta-500)' : 'rgba(60,40,20,.14)'}`,
                background: 'var(--paper)', outline: 'none',
                fontFamily: 'inherit', fontSize: 14.5, color: 'var(--ink-900)',
              }}
            />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={() => setPax(p => Math.max(1, p - 1))} className="press"
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  border: '1px solid rgba(60,40,20,.14)', background: 'var(--paper)',
                  color: 'var(--ink-700)', cursor: 'pointer',
                  display: 'grid', placeItems: 'center',
                }}>
                <Icon d={I.chevL} size={14} stroke={2.4} />
              </button>
              <div style={{
                flex: '0 0 60px', textAlign: 'center',
                fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 500,
                color: 'var(--ink-900)',
              }}>{pax}p</div>
              <button onClick={() => setPax(p => Math.min(20, p + 1))} className="press"
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  border: '1px solid rgba(60,40,20,.14)', background: 'var(--paper)',
                  color: 'var(--ink-700)', cursor: 'pointer',
                  display: 'grid', placeItems: 'center',
                }}>
                <Icon d={I.chevR} size={14} stroke={2.4} />
              </button>
              <input
                value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="Telèfon (opcional)"
                type="tel"
                style={{
                  flex: 1, padding: '9px 12px', borderRadius: 10,
                  border: '1.5px solid rgba(60,40,20,.14)',
                  background: 'var(--paper)', outline: 'none',
                  fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-900)',
                }}
              />
            </div>
            <button onClick={handleAdd} className="press"
              disabled={!name.trim()}
              style={{
                padding: '11px 0', borderRadius: 11, border: 'none',
                background: name.trim() ? 'var(--terracotta-600)' : 'var(--ink-200)',
                color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
                cursor: name.trim() ? 'pointer' : 'not-allowed',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
              <Icon d={I.plus} size={14} stroke={2.4} /> Afegir a la cua
            </button>
          </div>
        </div>
      </div>
    </AnimatedSheet>
  );
}

// ─── QueueRow ─────────────────────────────────────────────────────────────────

function QueueRow({ w, onNotify, onSeat, onRemove }: {
  w: WaitlistEntry;
  onNotify: () => void;
  onSeat:   () => void;
  onRemove: () => void;
}) {
  const waitMin = Math.max(0, Math.floor((Date.now() - w.addedAt) / 60_000));
  const isLong  = waitMin >= 15;
  const isNotified = w.status === 'notified';

  return (
    <div style={{
      padding: '12px 14px', borderRadius: 12,
      background: isNotified ? 'var(--olive-50)' : 'var(--paper)',
      border: `1px solid ${isNotified ? 'rgba(116,133,74,.28)' : 'rgba(60,40,20,.08)'}`,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {/* Top row: name + pax + wait time + remove */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 14.5, fontWeight: 650, color: 'var(--ink-900)',
            letterSpacing: -.005,
          }}>
            <span>{w.name}</span>
            <span style={{
              fontSize: 11, fontWeight: 700, color: 'var(--ink-500)',
              fontFamily: 'var(--font-mono)',
            }}>· {w.pax}p</span>
            {isNotified && (
              <span title="Avisat" style={{ fontSize: 12 }}>📞</span>
            )}
          </div>
          <div style={{
            fontSize: 11.5, color: isLong ? 'var(--rose-700)' : 'var(--ink-500)',
            marginTop: 2, fontFamily: 'var(--font-mono)', fontWeight: 600,
            letterSpacing: .04,
          }}>
            {waitMin === 0 ? 'ara mateix' : `fa ${waitMin} min`}
            {w.phone ? ` · ${w.phone}` : ''}
          </div>
        </div>
        <button onClick={onRemove} aria-label="Eliminar"
          style={{
            width: 30, height: 30, borderRadius: 999,
            border: 'none', background: 'transparent',
            color: 'var(--ink-400)', cursor: 'pointer',
            display: 'grid', placeItems: 'center',
          }}>
          <Icon d={I.x} size={14} />
        </button>
      </div>
      {/* Action row */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={onNotify} disabled={isNotified} className="press"
          style={{
            flex: 1, padding: '8px 0', borderRadius: 9,
            border: '1px solid rgba(60,40,20,.10)',
            background: isNotified ? 'transparent' : 'var(--paper)',
            color: isNotified ? 'var(--ink-400)' : 'var(--ink-800)',
            cursor: isNotified ? 'default' : 'pointer',
            fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            opacity: isNotified ? .6 : 1,
          }}>
          <Icon d={I.phone} size={12} stroke={2} />
          {isNotified ? 'Avisat' : 'Avisar'}
        </button>
        <button onClick={onSeat} className="press"
          style={{
            flex: 1, padding: '8px 0', borderRadius: 9, border: 'none',
            background: 'var(--terracotta-600)', color: '#fff',
            cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}>
          <Icon d={I.users} size={12} stroke={2} /> Asseure
        </button>
      </div>
    </div>
  );
}
