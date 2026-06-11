/**
 * BriefingActionSheet — secondary slide-up sheet that resolves a
 * briefing action that targets a *list* of reservations.
 *
 * Two flavours, picked by the `action` discriminator:
 *
 *   • 'assign-table'         — list of big groups with no tableIds.
 *                              Each row offers "Obrir plànol" which
 *                              navigates to the floor plan with the
 *                              reservation pre-selected (the existing
 *                              flow handles the actual table picking).
 *
 *   • 'confirm-reservations' — list of pending reservations near the
 *                              service. Each row offers [Confirmar]
 *                              (status → confirmed, toast feedback),
 *                              [Trucar] (tel: link, only if phone)
 *                              and [Detall] (opens reservation detail).
 *
 * The sheet always lets the operator escape with × — confirming or
 * assigning never closes it automatically; instead, the list updates
 * in place so they can keep working through the queue.
 */

import { useMemo, useState } from 'react';
import AnimatedSheet from './AnimatedSheet';
import { Z_INDEX } from '@/lib/zIndex';
import TableSelectorModal from './TableSelectorModal';
import { useAppStore } from '@/store/useAppStore';
import { toast } from './Toaster';
import type { Reservation } from '@/types';

type AssignTableAction = {
  kind: 'assign-table';
  label: string;
  reservationIds: string[];
  reason: string;
};
type ConfirmAction = {
  kind: 'confirm-reservations';
  label: string;
  reservationIds: string[];
  reason: string;
};
export type ResolvableAction = AssignTableAction | ConfirmAction;

interface Props {
  open: boolean;
  onClose: () => void;
  action: ResolvableAction | null;
  /** Open the reservation detail sheet (existing flow). */
  onOpenReservationDetail: (r: Reservation) => void;
}

export default function BriefingActionSheet({
  open, onClose, action,
  onOpenReservationDetail,
}: Props) {
  const { reservations, updateReservationStatus, assignTablesToReservation } = useAppStore();

  // Track which reservation the operator is assigning a table to right
  // now. While set, the TableSelectorModal renders on top of this sheet
  // — same picker the rest of the app uses, so behaviour is identical
  // to the floor-plan flow but without leaving the briefing context.
  const [assigningRes, setAssigningRes] = useState<Reservation | null>(null);

  // Resolve reservationIds → current Reservation rows. We re-read from
  // the store on every render so confirming a reservation in-place
  // updates the list without remounting.
  const rows = useMemo<Reservation[]>(() => {
    if (!action) return [];
    const set = new Set(action.reservationIds);
    return reservations.filter(r => set.has(r.id));
  }, [action, reservations]);

  // For confirm flow we hide rows that the operator has already moved
  // out of "pending" — they shouldn't reappear in the same sheet session.
  const visibleRows = action?.kind === 'confirm-reservations'
    ? rows.filter(r => r.status === 'pending')
    : rows;

  if (!action) return null;

  const title = action.kind === 'assign-table' ? 'Assignar taula' : 'Confirmar reserves';
  const subtitle = action.reason;

  function handleConfirm(r: Reservation) {
    updateReservationStatus(r.id, 'confirmed');
    toast(`${r.name} confirmada`, { icon: 'check', tone: 'olive' });
  }

  function handleAssign(r: Reservation) {
    // Open the same TableSelectorModal the new-reservation form and the
    // reservation detail sheet use. Stays in the briefing context — no
    // navigation, no walk-in side-effect, no losing the operator's place.
    setAssigningRes(r);
  }

  function handleOpenDetail(r: Reservation) {
    onOpenReservationDetail(r);
    onClose();
  }

  return (
    <>
    <AnimatedSheet open={open} onClose={onClose} desktopMaxWidth={620} zIndex={Z_INDEX.action}>
      <div style={{
        padding: '18px 20px 22px',
        display: 'flex', flexDirection: 'column', gap: 14,
        background: 'var(--surface-elevated)',
        color: 'var(--ink-900)',
      }}>
        {/* Header */}
        <header style={{
          display: 'flex', alignItems: 'flex-start', gap: 12,
          paddingBottom: 6,
          borderBottom: '1px solid var(--line-soft)',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: .14,
              color: 'var(--ink-500)', textTransform: 'uppercase',
              fontFamily: 'var(--font-mono)',
              marginBottom: 4,
            }}>
              Acció del briefing
            </div>
            <div style={{
              fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 500,
              letterSpacing: -.01, color: 'var(--ink-900)',
            }}>
              {title}
            </div>
            <div style={{
              fontSize: 12.5, color: 'var(--ink-600)', marginTop: 4,
              fontFamily: 'var(--font-sans)', fontWeight: 500,
            }}>
              {subtitle}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Tancar"
            className="tac-btn tac-btn--ghost"
            style={{
              flexShrink: 0, width: 36, height: 36, padding: 0,
              display: 'grid', placeItems: 'center', borderRadius: 10,
              fontSize: 20, color: 'var(--ink-500)', lineHeight: 1,
            }}
          >
            ×
          </button>
        </header>

        {/* Empty state — everything resolved in-session */}
        {visibleRows.length === 0 && (
          <div style={{
            padding: '24px 8px',
            fontFamily: 'var(--font-serif)', fontSize: 15,
            color: 'var(--ink-500)', textAlign: 'center',
            lineHeight: 1.5,
          }}>
            {action.kind === 'confirm-reservations'
              ? 'Totes les reserves d\'aquesta llista ja estan confirmades.'
              : 'Totes les reserves d\'aquesta llista ja tenen taula assignada.'}
          </div>
        )}

        {/* Rows */}
        {visibleRows.length > 0 && (
          <ul style={{
            margin: 0, padding: 0, listStyle: 'none',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            {visibleRows.map(r => (
              <li key={r.id} style={{
                position: 'relative',
                padding: '12px 12px 12px 14px',
                background: 'var(--surface-elevated)',
                borderRadius: 12,
                boxShadow: '0 0 0 1px rgba(60,40,20,.08) inset, 0 1px 0 rgba(255,255,255,.5) inset',
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                {/* Row identity line: time · name · pax */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  minWidth: 0,
                }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
                    color: 'var(--ink-700)', flexShrink: 0,
                    padding: '2px 8px', borderRadius: 6,
                    background: 'rgba(60,40,20,.05)',
                  }}>{r.time}</span>
                  <span style={{
                    fontSize: 14.5, fontWeight: 600, color: 'var(--ink-900)',
                    letterSpacing: -.003, minWidth: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    flex: 1,
                  }}>{r.name}</span>
                  <span style={{
                    fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 500,
                    color: 'var(--ink-700)', flexShrink: 0,
                  }}>
                    {r.pax}
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-500)', marginLeft: 3 }}>
                      PAX
                    </span>
                  </span>
                </div>

                {/* Meta line: phone · source · status hint */}
                {(r.phone || r.source) && (
                  <div style={{
                    fontSize: 11.5, color: 'var(--ink-500)',
                    display: 'flex', alignItems: 'center', gap: 8,
                    flexWrap: 'wrap',
                  }}>
                    {r.phone && (
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{r.phone}</span>
                    )}
                    {r.source && (
                      <span>· {r.source}</span>
                    )}
                  </div>
                )}

                {/* Action buttons per row */}
                <div style={{
                  display: 'flex', gap: 6, flexWrap: 'wrap',
                  marginTop: 2,
                }}>
                  {action.kind === 'confirm-reservations' && (
                    <>
                      <button
                        onClick={() => handleConfirm(r)}
                        className="tac-btn tac-btn--accent"
                        style={{
                          padding: '7px 14px', fontSize: 12.5, fontWeight: 700,
                          borderRadius: 8,
                        }}
                      >
                        Confirmar
                      </button>
                      {r.phone && (
                        <a
                          href={`tel:${r.phone}`}
                          className="tac-btn"
                          style={{
                            padding: '7px 12px', fontSize: 12.5, fontWeight: 600,
                            borderRadius: 8, color: 'var(--ink-700)',
                            display: 'inline-flex', alignItems: 'center',
                            textDecoration: 'none',
                          }}
                        >
                          Trucar
                        </a>
                      )}
                      <button
                        onClick={() => handleOpenDetail(r)}
                        className="tac-btn tac-btn--ghost"
                        style={{
                          padding: '7px 12px', fontSize: 12.5, fontWeight: 600,
                          borderRadius: 8, color: 'var(--ink-600)',
                        }}
                      >
                        Detall
                      </button>
                    </>
                  )}

                  {action.kind === 'assign-table' && (
                    <>
                      <button
                        onClick={() => handleAssign(r)}
                        className="tac-btn tac-btn--accent"
                        style={{
                          padding: '7px 14px', fontSize: 12.5, fontWeight: 700,
                          borderRadius: 8,
                        }}
                      >
                        Triar taula
                      </button>
                      <button
                        onClick={() => handleOpenDetail(r)}
                        className="tac-btn tac-btn--ghost"
                        style={{
                          padding: '7px 12px', fontSize: 12.5, fontWeight: 600,
                          borderRadius: 8, color: 'var(--ink-600)',
                        }}
                      >
                        Detall
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AnimatedSheet>

    {/* Table picker — same modal the new-reservation form / detail sheet
        use. Renders on top of this sheet via portal (z-index from
        TableSelectorModal itself). Saving calls the store; we toast and
        clear the assigning state so the parent sheet's empty-state
        message can kick in once every row is resolved. */}
    {assigningRes && (
      <TableSelectorModal
        bizId={assigningRes.bizId}
        pax={assigningRes.pax}
        currentIds={assigningRes.tableIds ?? []}
        date={assigningRes.date}
        onSave={ids => {
          assignTablesToReservation(assigningRes.id, ids);
          toast(`Taula assignada a ${assigningRes.name}`, { icon: 'check', tone: 'olive' });
          setAssigningRes(null);
        }}
        onClose={() => setAssigningRes(null)}
      />
    )}
    </>
  );
}
