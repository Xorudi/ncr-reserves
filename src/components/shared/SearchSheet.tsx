/**
 * SearchSheet — global search across reservations, clients, notes, and events.
 *
 * Open via the search icon in any shell header. Type a query and results
 * appear live, grouped by type. Tapping a result navigates to the relevant
 * context (sets selected date/reservation/customer in the store and asks the
 * caller to switch to the right tab).
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import AnimatedSheet from './AnimatedSheet';
import { Icon, I } from './Icons';
import { useAppStore } from '@/store/useAppStore';
import { resPalette } from '@/utils/statusLabels';
import type { Reservation, Customer, ShiftNote, AppEvent } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called after a result is picked — used to switch tabs on mobile/tablet. */
  onNavigate?: (target: 'reservations' | 'clients') => void;
}

type ResultKind = 'reservation' | 'client' | 'note' | 'event';
interface Result {
  kind:  ResultKind;
  id:    string;
  // ranking: higher = better match
  score: number;
  data:  Reservation | Customer | ShiftNote | AppEvent;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('ca-ES', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
}

export default function SearchSheet({ open, onClose, onNavigate }: Props) {
  const {
    selectedBusiness, reservations, customers, shiftNotes, appEvents,
    setSelectedDate, setSelectedReservation, setSelectedCustomer,
  } = useAppStore();

  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reset query when sheet opens and focus the input.
  useEffect(() => {
    if (!open) return;
    setQ('');
    const t = setTimeout(() => inputRef.current?.focus(), 240);
    return () => clearTimeout(t);
  }, [open]);

  const results = useMemo<Result[]>(() => {
    const query = q.trim().toLowerCase();
    if (query.length < 2) return [];

    const out: Result[] = [];

    // Reservations — match name, phone, notes. Scoped to active business.
    for (const r of reservations) {
      if (r.bizId !== selectedBusiness) continue;
      const name = (r.name || '').toLowerCase();
      const phone = (r.phone || '').toLowerCase();
      const notes = (r.notes || '').toLowerCase();
      let score = 0;
      if (name.startsWith(query))   score = 100;
      else if (name.includes(query)) score = 70;
      else if (phone.includes(query)) score = 50;
      else if (notes.includes(query)) score = 30;
      if (score > 0) out.push({ kind: 'reservation', id: r.id, score, data: r });
    }

    // Clients — match name, phone, email, notes. Across all businesses they
    // belong to so a multi-restaurant operator can find them anywhere.
    for (const c of customers) {
      const name = (c.name || '').toLowerCase();
      const phone = (c.phone || '').toLowerCase();
      const email = (c.email || '').toLowerCase();
      const notes = (c.notes || '').toLowerCase();
      let score = 0;
      if (name.startsWith(query))   score = 100;
      else if (name.includes(query)) score = 70;
      else if (phone.includes(query)) score = 60;
      else if (email.includes(query)) score = 50;
      else if (notes.includes(query)) score = 30;
      if (score > 0) out.push({ kind: 'client', id: c.id, score, data: c });
    }

    // Shift notes — match body. Scoped to active business.
    for (const n of shiftNotes) {
      if (n.bizId !== selectedBusiness) continue;
      const body = (n.body || '').toLowerCase();
      if (body.includes(query)) {
        out.push({ kind: 'note', id: n.id, score: body.startsWith(query) ? 60 : 40, data: n });
      }
    }

    // App events — match title, description.
    for (const e of appEvents) {
      if (e.bizId !== selectedBusiness) continue;
      const title = (e.title || '').toLowerCase();
      const desc  = (e.description || '').toLowerCase();
      let score = 0;
      if (title.startsWith(query))   score = 80;
      else if (title.includes(query)) score = 60;
      else if (desc.includes(query))  score = 35;
      if (score > 0) out.push({ kind: 'event', id: e.id, score, data: e });
    }

    return out.sort((a, b) => b.score - a.score).slice(0, 40);
  }, [q, reservations, customers, shiftNotes, appEvents, selectedBusiness]);

  // Group results by kind for the rendered sections.
  const grouped = useMemo(() => {
    const g: Record<ResultKind, Result[]> = { reservation: [], client: [], note: [], event: [] };
    results.forEach(r => g[r.kind].push(r));
    return g;
  }, [results]);

  function pickReservation(r: Reservation) {
    setSelectedDate(new Date(r.date + 'T00:00:00'));
    setSelectedReservation(r);
    onNavigate?.('reservations');
    onClose();
  }
  function pickClient(c: Customer) {
    setSelectedCustomer(c);
    onNavigate?.('clients');
    onClose();
  }
  function pickNoteOrEvent(date: string) {
    setSelectedDate(new Date(date + 'T00:00:00'));
    onNavigate?.('reservations');
    onClose();
  }

  return (
    <AnimatedSheet open={open} onClose={onClose} zIndex={200}>
      <div style={{
        background: 'var(--paper)', borderRadius: '18px 18px 0 0',
        boxShadow: '0 -4px 28px rgba(0,0,0,.18)',
        maxHeight: '88vh',
        display: 'flex', flexDirection: 'column',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)',
      }}>
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--ink-200)', margin: '10px auto 8px' }} />

        {/* Input */}
        <div style={{
          padding: '6px 16px 12px',
          display: 'flex', alignItems: 'center', gap: 10,
          borderBottom: 'var(--hair)',
        }}>
          <Icon d={I.search} size={17} stroke={2} />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Cerca reserves, clients, notes…"
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontFamily: 'inherit', fontSize: 16, color: 'var(--ink-900)',
              letterSpacing: -.005,
            }}
          />
          {q && (
            <button onClick={() => setQ('')} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--ink-400)', padding: 4,
            }}>
              <Icon d={I.x} size={15} />
            </button>
          )}
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--ink-600)', fontFamily: 'inherit', fontSize: 14,
            fontWeight: 600, padding: '4px 6px',
          }}>
            Tancar
          </button>
        </div>

        {/* Results */}
        <div className="scroll" style={{ flex: 1, overflowY: 'auto', padding: '8px 0 4px' }}>
          {q.trim().length < 2 ? (
            <SearchHint />
          ) : results.length === 0 ? (
            <EmptyState query={q} />
          ) : (
            <>
              {grouped.reservation.length > 0 && (
                <SearchSection title={`Reserves · ${grouped.reservation.length}`}>
                  {grouped.reservation.map(r => (
                    <ReservationRow key={r.id} r={r.data as Reservation} onClick={() => pickReservation(r.data as Reservation)} />
                  ))}
                </SearchSection>
              )}
              {grouped.client.length > 0 && (
                <SearchSection title={`Clients · ${grouped.client.length}`}>
                  {grouped.client.map(r => (
                    <ClientRow key={r.id} c={r.data as Customer} onClick={() => pickClient(r.data as Customer)} />
                  ))}
                </SearchSection>
              )}
              {grouped.event.length > 0 && (
                <SearchSection title={`Esdeveniments · ${grouped.event.length}`}>
                  {grouped.event.map(r => (
                    <EventRow key={r.id} e={r.data as AppEvent} onClick={() => pickNoteOrEvent((r.data as AppEvent).date)} />
                  ))}
                </SearchSection>
              )}
              {grouped.note.length > 0 && (
                <SearchSection title={`Notes de torn · ${grouped.note.length}`}>
                  {grouped.note.map(r => (
                    <NoteRow key={r.id} n={r.data as ShiftNote} onClick={() => pickNoteOrEvent((r.data as ShiftNote).date)} />
                  ))}
                </SearchSection>
              )}
            </>
          )}
        </div>
      </div>
    </AnimatedSheet>
  );
}

// ─── Sub-views ────────────────────────────────────────────────────────────────

function SearchHint() {
  return (
    <div style={{ padding: '32px 22px', color: 'var(--ink-500)', fontSize: 13.5, lineHeight: 1.55 }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--ink-900)', marginBottom: 8 }}>
        Cerca a tota l'app
      </div>
      <div style={{ marginBottom: 6 }}>Escriu 2 caràcters per començar. La cerca cobreix:</div>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        <li>Reserves — per nom, telèfon o nota</li>
        <li>Clients — per nom, telèfon, email o nota</li>
        <li>Notes de torn — pel cos</li>
        <li>Esdeveniments — per títol o descripció</li>
      </ul>
    </div>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div style={{ padding: '40px 22px', textAlign: 'center', color: 'var(--ink-500)' }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--ink-700)', marginBottom: 6 }}>
        Sense resultats
      </div>
      <div style={{ fontSize: 13 }}>Cap coincidència per <i>"{query}"</i></div>
    </div>
  );
}

function SearchSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{
        padding: '10px 18px 6px',
        fontSize: 10.5, fontWeight: 700,
        color: 'var(--ink-500)', letterSpacing: .08, textTransform: 'uppercase',
        fontFamily: 'var(--font-mono)',
      }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}

function ReservationRow({ r, onClick }: { r: Reservation; onClick: () => void }) {
  const pal = resPalette(r.status);
  return (
    <button onClick={onClick} className="press"
      style={rowBtn}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 38, textAlign: 'center', flexShrink: 0,
          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
          color: 'var(--ink-600)',
        }}>{r.time}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 650, color: 'var(--ink-900)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            letterSpacing: -.005,
          }}>{r.name}</div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 2 }}>
            {fmtDate(r.date)} · {r.pax} pax
          </div>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700,
          padding: '3px 8px', borderRadius: 999,
          background: pal.bg, color: pal.fg, border: `1px solid ${pal.ring}`,
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>{pal.label}</span>
      </div>
    </button>
  );
}

function ClientRow({ c, onClick }: { c: Customer; onClick: () => void }) {
  return (
    <button onClick={onClick} className="press" style={rowBtn}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 999, flexShrink: 0,
          background: 'var(--ink-100)', color: 'var(--ink-700)',
          display: 'grid', placeItems: 'center',
          fontFamily: 'var(--font-serif)', fontSize: 14, fontWeight: 600,
        }}>
          {c.name.slice(0, 1).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 650, color: 'var(--ink-900)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{c.name}</div>
          <div style={{
            fontSize: 11.5, color: 'var(--ink-500)', marginTop: 2,
            fontFamily: 'var(--font-mono)',
          }}>
            {c.phone || '—'}{c.visits > 0 ? ` · ${c.visits} ${c.visits === 1 ? 'visita' : 'visites'}` : ''}
          </div>
        </div>
      </div>
    </button>
  );
}

function EventRow({ e, onClick }: { e: AppEvent; onClick: () => void }) {
  return (
    <button onClick={onClick} className="press" style={rowBtn}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 38, textAlign: 'center', flexShrink: 0,
          fontSize: 16,
        }}>📌</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 650, color: 'var(--ink-900)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{e.title}</div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 2 }}>
            {fmtDate(e.date)}{e.time ? ` · ${e.time}` : ''}
          </div>
        </div>
      </div>
    </button>
  );
}

function NoteRow({ n, onClick }: { n: ShiftNote; onClick: () => void }) {
  return (
    <button onClick={onClick} className="press" style={rowBtn}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 38, textAlign: 'center', flexShrink: 0,
          fontSize: 16, paddingTop: 1,
        }}>📝</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13.5, color: 'var(--ink-800)',
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2 as any, WebkitBoxOrient: 'vertical' as any,
            lineHeight: 1.35,
          }}>{n.body}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 3 }}>
            {fmtDate(n.date)}{n.author ? ` · ${n.author}` : ''}
          </div>
        </div>
      </div>
    </button>
  );
}

const rowBtn: React.CSSProperties = {
  width: '100%', textAlign: 'left',
  background: 'transparent', border: 'none', cursor: 'pointer',
  padding: '11px 18px',
  fontFamily: 'inherit',
  borderTop: '1px solid rgba(60,40,20,.06)',
};
