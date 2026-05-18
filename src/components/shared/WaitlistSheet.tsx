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
import type { WaitlistEntry, Reservation, FloorPlan } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called after "Asseure": receives the freshly-created walk-in reservation
   *  so the shell can navigate to Reserves with it selected. */
  onSeated?: (res: Reservation) => void;
}

export default function WaitlistSheet({ open, onClose, onSeated }: Props) {
  const {
    selectedBusiness, selectedDate, waitlist, floorPlans,
    addToWaitlist, removeFromWaitlist, notifyWaitlist, seatFromWaitlist,
  } = useAppStore();
  const plan = floorPlans[selectedBusiness];
  // Queues are inherently a "this day" thing — an entry added Wednesday only
  // surfaces on Wednesday, not on every subsequent day the operator browses.
  const selDayIso = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth()+1).padStart(2,'0')}-${String(selectedDate.getDate()).padStart(2,'0')}`;
  const addedOnSelDay = (epochMs: number) => {
    const d = new Date(epochMs);
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return iso === selDayIso;
  };

  // Re-render every 30s so the "X min" counters stay fresh while the sheet
  // is open. Cheap because the list is tiny.
  const [, force] = useState(0);
  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => force(n => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, [open]);

  const bizQueue = waitlist
    .filter(w => w.bizId === selectedBusiness && addedOnSelDay(w.addedAt))
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
          <button onClick={onClose} className="tac-btn tac-btn--ghost" style={{
            color: 'var(--ink-600)', fontSize: 14,
            fontWeight: 600, padding: '6px 12px', borderRadius: 999,
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
              {bizQueue.map((w, i) => <QueueRow key={w.id} w={w}
                rank={i + 1}
                isNext={i === 0}
                plan={plan}
                onNotify={() => handleNotify(w)}
                onSeat={() => handleSeat(w)}
                onRemove={() => handleRemove(w)} />)}
            </div>
          )}
        </div>

        {/* Add form — only when viewing today; the waitlist is a real-time
            concept and adding to past or future days doesn't make sense. */}
        {addedOnSelDay(Date.now()) ? (
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
              <button onClick={() => setPax(p => Math.max(1, p - 1))} className="tac-btn"
                style={{
                  width: 36, height: 36,
                  color: 'var(--ink-700)',
                  display: 'grid', placeItems: 'center',
                }}>
                <Icon d={I.chevL} size={14} stroke={2.4} />
              </button>
              <div style={{
                flex: '0 0 60px', textAlign: 'center',
                fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 500,
                color: 'var(--ink-900)',
              }}>{pax}p</div>
              <button onClick={() => setPax(p => Math.min(20, p + 1))} className="tac-btn"
                style={{
                  width: 36, height: 36,
                  color: 'var(--ink-700)',
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
            <button onClick={handleAdd} className="tac-btn tac-btn--accent"
              disabled={!name.trim()}
              style={{
                padding: '11px 0', borderRadius: 11,
                fontSize: 14, fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
              <Icon d={I.plus} size={14} stroke={2.4} /> Afegir a la cua
            </button>
          </div>
        </div>
        ) : (
          <div style={{
            padding: '14px', borderTop: 'var(--hair)', background: 'var(--cream)',
            fontSize: 12, color: 'var(--ink-500)', textAlign: 'center', fontStyle: 'italic',
          }}>
            Historial del dia · només es pot afegir a la cua quan estàs a "Avui"
          </div>
        )}
      </div>
    </AnimatedSheet>
  );
}

// ─── QueueRow ─────────────────────────────────────────────────────────────────
//
// Visual hierarchy: rank #1 ("Següent") is bigger, terracotta-tinted, with
// the wait time as the most prominent secondary number. Subsequent rows are
// compacter but still show rank + wait so the operator can scan the queue
// in one glance.

interface QueueRowProps {
  w: WaitlistEntry;
  rank: number;
  isNext: boolean;
  plan?: FloorPlan;
  onNotify: () => void;
  onSeat:   () => void;
  onRemove: () => void;
}

/** Pick a wait-time tone: ink (cool), clay (warm warn), rose (urgent). */
function waitTone(min: number): { fg: string; bg: string; label?: string } {
  if (min >= 25) return { fg: 'var(--rose-700)',  bg: 'rgba(194,74,74,.10)', label: 'massa' };
  if (min >= 15) return { fg: 'var(--clay-700)',  bg: 'rgba(204,144,73,.12)', label: 'avís' };
  return { fg: 'var(--ink-700)', bg: 'transparent' };
}

/** Find a compatible free table for this party size; returns a label like "4–6 pax". */
function compatibleTableLabel(plan: FloorPlan | undefined, pax: number): string | null {
  if (!plan) return null;
  // Free tables whose capacity covers the party. Prefer smallest fit so we
  // don't tie up a 10-top for a 2-party. Group consecutive caps for a range.
  const candidates = plan.tables
    .filter(t => t.status === 'free' && t.cap >= pax)
    .sort((a, b) => a.cap - b.cap);
  if (candidates.length === 0) return null;
  const minCap = candidates[0].cap;
  const maxCap = candidates[Math.min(2, candidates.length - 1)].cap;
  return minCap === maxCap ? `${minCap} pax` : `${minCap}–${maxCap} pax`;
}

function QueueRow({ w, rank, isNext, plan, onNotify, onSeat, onRemove }: QueueRowProps) {
  const waitMin = Math.max(0, Math.floor((Date.now() - w.addedAt) / 60_000));
  const tone = waitTone(waitMin);
  const isNotified = w.status === 'notified';
  const tableLabel = compatibleTableLabel(plan, w.pax);

  // First-in-queue card: bigger padding, terracotta tint, "Següent" pill,
  // larger wait time, optional compatible-table hint.
  if (isNext) {
    return (
      <div style={{
        position: 'relative',
        padding: '14px 14px 12px', borderRadius: 14,
        background: isNotified
          ? 'linear-gradient(180deg, var(--olive-50) 0%, var(--paper) 90%)'
          : 'linear-gradient(180deg, var(--terracotta-50) 0%, var(--paper) 80%)',
        border: `1.5px solid ${isNotified ? 'rgba(116,133,74,.32)' : 'rgba(168,74,42,.28)'}`,
        boxShadow: '0 2px 8px rgba(168,74,42,.10)',
        display: 'flex', flexDirection: 'column', gap: 11,
      }}>
        {/* Top stripe: rank + Següent pill + remove */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'baseline', gap: 4,
            fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
            color: 'var(--ink-500)', letterSpacing: .04,
          }}>
            <span style={{ opacity: .6 }}>#</span>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 500, color: 'var(--terracotta-700)' }}>{rank}</span>
          </span>
          <span style={{
            fontSize: 9.5, fontWeight: 800, letterSpacing: .14,
            textTransform: 'uppercase',
            padding: '3px 8px', borderRadius: 999,
            background: 'var(--terracotta-600)', color: '#fff',
          }}>★ Següent</span>
          {isNotified && (
            <span title="Avisat" style={{
              fontSize: 9.5, fontWeight: 800, letterSpacing: .14,
              textTransform: 'uppercase',
              padding: '3px 8px', borderRadius: 999,
              background: 'var(--olive-700)', color: '#fff',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>📞 Avisat</span>
          )}
          <span style={{ flex: 1 }} />
          <button onClick={onRemove} aria-label="Eliminar"
            className="tac-btn tac-btn--ghost"
            style={{
              width: 28, height: 28, borderRadius: 999,
              color: 'var(--ink-400)',
              display: 'grid', placeItems: 'center',
            }}>
            <Icon d={I.x} size={14} />
          </button>
        </div>

        {/* Main row: name+pax on the left, wait time prominent on the right */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--font-serif)', fontSize: 21, fontWeight: 500,
              color: 'var(--ink-900)', lineHeight: 1.05, letterSpacing: -.005,
            }}>
              {w.name} <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
                color: 'var(--ink-500)', marginLeft: 4,
              }}>· {w.pax}p</span>
            </div>
            {w.phone && (
              <div style={{
                fontSize: 11.5, color: 'var(--ink-500)', marginTop: 3,
                fontFamily: 'var(--font-mono)', fontWeight: 600,
              }}>{w.phone}</div>
            )}
          </div>
          <div style={{
            flexShrink: 0, textAlign: 'right',
            padding: '6px 10px', borderRadius: 10,
            background: tone.bg,
          }}>
            <div style={{
              fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 500,
              color: tone.fg, lineHeight: 1, letterSpacing: -.01,
            }}>{waitMin}<span style={{ fontSize: 12, marginLeft: 2 }}>min</span></div>
            <div style={{
              fontSize: 9.5, fontWeight: 700, color: tone.fg, opacity: .7,
              letterSpacing: .08, textTransform: 'uppercase', marginTop: 2,
            }}>{tone.label ?? 'esperant'}</div>
          </div>
        </div>

        {/* Compatible-table hint when at least one free table can host them */}
        {tableLabel && (
          <div style={{
            display: 'inline-flex', alignSelf: 'flex-start',
            alignItems: 'center', gap: 6,
            padding: '4px 9px', borderRadius: 999,
            background: 'var(--paper)', border: '1px solid rgba(60,40,20,.10)',
            fontSize: 11, color: 'var(--ink-700)', fontWeight: 600,
          }}>
            <span style={{ fontSize: 12 }}>🪑</span>
            <span>Taula lliure compatible: {tableLabel}</span>
          </div>
        )}

        {/* Action row */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onNotify} disabled={isNotified} className="tac-btn"
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10,
              color: isNotified ? 'var(--ink-400)' : 'var(--ink-800)',
              fontSize: 13, fontWeight: 650,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
            <Icon d={I.phone} size={13} stroke={2} />
            {isNotified ? 'Avisat' : 'Avisar'}
          </button>
          <button onClick={onSeat} className="tac-btn tac-btn--accent"
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10,
              fontSize: 13, fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
            <Icon d={I.users} size={13} stroke={2} /> Asseure
          </button>
        </div>
      </div>
    );
  }

  // Compact card for #2+ — rank big-ish, wait time clearly to the right,
  // actions in a single row beneath. Notified state still shifts the bg.
  return (
    <div style={{
      padding: '11px 12px', borderRadius: 12,
      background: isNotified ? 'var(--olive-50)' : 'var(--paper)',
      border: `1px solid ${isNotified ? 'rgba(116,133,74,.28)' : 'rgba(60,40,20,.08)'}`,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Rank pill */}
        <span style={{
          flexShrink: 0,
          width: 30, height: 30, borderRadius: 8,
          background: 'var(--ink-50)',
          display: 'grid', placeItems: 'center',
          fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 500,
          color: 'var(--ink-700)',
        }}>{rank}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 14, fontWeight: 650, color: 'var(--ink-900)',
            letterSpacing: -.005,
          }}>
            <span>{w.name}</span>
            <span style={{
              fontSize: 11, fontWeight: 700, color: 'var(--ink-500)',
              fontFamily: 'var(--font-mono)',
            }}>· {w.pax}p</span>
            {isNotified && <span title="Avisat" style={{ fontSize: 11 }}>📞</span>}
          </div>
          {w.phone && (
            <div style={{
              fontSize: 11, color: 'var(--ink-500)', marginTop: 1,
              fontFamily: 'var(--font-mono)', fontWeight: 600,
            }}>{w.phone}</div>
          )}
        </div>
        <span style={{
          flexShrink: 0,
          fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 700,
          color: tone.fg, letterSpacing: .04,
          padding: '4px 8px', borderRadius: 8,
          background: tone.bg,
        }}>
          {waitMin === 0 ? 'ara' : `${waitMin} min`}
        </span>
        <button onClick={onRemove} aria-label="Eliminar"
          className="tac-btn tac-btn--ghost"
          style={{
            width: 26, height: 26, borderRadius: 999,
            color: 'var(--ink-400)',
            display: 'grid', placeItems: 'center',
          }}>
          <Icon d={I.x} size={13} />
        </button>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={onNotify} disabled={isNotified} className="tac-btn"
          style={{
            flex: 1, padding: '7px 0', borderRadius: 9,
            color: isNotified ? 'var(--ink-400)' : 'var(--ink-800)',
            fontSize: 12, fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}>
          <Icon d={I.phone} size={11} stroke={2} />
          {isNotified ? 'Avisat' : 'Avisar'}
        </button>
        <button onClick={onSeat} className="tac-btn tac-btn--accent"
          style={{
            flex: 1, padding: '7px 0', borderRadius: 9,
            fontSize: 12, fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}>
          <Icon d={I.users} size={11} stroke={2} /> Asseure
        </button>
      </div>
    </div>
  );
}
