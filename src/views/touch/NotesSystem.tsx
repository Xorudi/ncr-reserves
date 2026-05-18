/**
 * NotesSystem — operational shift notes for the current day.
 *
 * Two pieces:
 *   - <NotesBanner />   compact paper-note pill that appears in the shell when
 *                       there are notes for today. Tap to open the sheet.
 *   - <NotesSheet  />   bottom sheet with the full list, add/edit/delete.
 *
 * Use cases the operator types up:
 *   "Sense calamars avui · arribada divendres"
 *   "Plat especial · arròs negre amb gambes"
 *   "Cuina tanca a 23:00"
 *   "Marta entra a les 19h, fa torn extra"
 */
import React, { useEffect, useMemo, useState } from 'react';
import AnimatedSheet from '@/components/shared/AnimatedSheet';
import { Icon, I } from '@/components/shared/Icons';
import { useAppStore } from '@/store/useAppStore';
import { toast } from '@/components/shared/Toaster';
import type { BusinessId, ShiftNote } from '@/types';

function localIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Compact banner — paper-note styling. When `showEmptyHint` is true and
 *  there are no notes today, renders a dashed ghost as an entry point. */
export function NotesBanner({ bizId, date, onOpen, showEmptyHint = false }: {
  bizId: BusinessId; date: Date; onOpen: () => void;
  showEmptyHint?: boolean;
}) {
  const { shiftNotes } = useAppStore();
  const dateIso = localIso(date);
  const todayNotes = useMemo(
    () => shiftNotes.filter(n => n.bizId === bizId && n.date === dateIso)
                    .sort((a, b) => b.createdAt - a.createdAt),
    [shiftNotes, bizId, dateIso],
  );

  // Empty-state ghost — gives the operator an entry point to write the first
  // note without having to dig into Més. Only shows when explicitly requested
  // (typically on the Reserves screen) so we don't clutter every tab.
  if (todayNotes.length === 0) {
    if (!showEmptyHint) return null;
    return (
      <button onClick={onOpen} className="press"
        style={{
          flexShrink: 0,
          margin: '8px 22px 0',
          padding: '7px 12px',
          borderRadius: 10,
          background: 'transparent',
          border: '1px dashed rgba(180,140,40,.35)',
          color: '#8a6a10',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
          letterSpacing: .02,
        }}>
        <Icon d={I.plus} size={12} stroke={2.4} />
        Afegir nota del torn
      </button>
    );
  }
  const first = todayNotes[0];
  const more  = todayNotes.length - 1;

  return (
    <button onClick={onOpen} className="press"
      style={{
        flexShrink: 0,
        margin: '8px 22px 0',
        padding: '8px 12px 8px 14px',
        borderRadius: 10,
        background:
          'linear-gradient(180deg, #fff8e6 0%, #fbf2d3 100%)',
        border: '1px solid rgba(180,140,40,.20)',
        boxShadow: '0 1px 2px rgba(180,140,40,.08), 0 4px 10px rgba(180,140,40,.06)',
        // Slight tilt — like a paper note pinned to a corkboard
        transform: 'rotate(-0.25deg)',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 10,
        fontFamily: 'inherit', textAlign: 'left',
        position: 'relative',
        width: 'calc(100% - 44px)',
      }}>
      {/* Pin dot (left) */}
      <span style={{
        width: 8, height: 8, borderRadius: 999,
        background: '#c89a3a', flexShrink: 0,
        boxShadow: '0 1px 2px rgba(120,80,10,.25)',
      }} />
      {/* Body — first note inline */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: .08,
          color: '#8a6a10', textTransform: 'uppercase',
          fontFamily: 'var(--font-mono)',
        }}>
          Nota torn
        </span>
        <span style={{
          fontFamily: 'var(--font-serif)', fontSize: 13.5, fontWeight: 500,
          color: '#5e4708', letterSpacing: -.005,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          flex: 1, minWidth: 0,
        }}>
          {first.body}
        </span>
      </div>
      {more > 0 && (
        <span style={{
          fontSize: 10.5, fontWeight: 700, color: '#8a6a10',
          background: 'rgba(200,154,58,.18)',
          padding: '2px 7px', borderRadius: 999,
          fontFamily: 'var(--font-mono)',
          flexShrink: 0,
        }}>
          +{more}
        </span>
      )}
      <Icon d={I.chevR} size={13} stroke={1.8} />
    </button>
  );
}

/** Bottom-sheet to manage today's notes. */
export function NotesSheet({ open, bizId, date, authorName, onClose }: {
  open: boolean;
  bizId: BusinessId;
  date: Date;
  authorName: string;
  onClose: () => void;
}) {
  const { shiftNotes, addShiftNote, editShiftNote, deleteShiftNote } = useAppStore();
  const dateIso = localIso(date);
  const todayNotes = useMemo(
    () => shiftNotes.filter(n => n.bizId === bizId && n.date === dateIso)
                    .sort((a, b) => b.createdAt - a.createdAt),
    [shiftNotes, bizId, dateIso],
  );

  const [draft,  setDraft]  = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');

  useEffect(() => {
    if (!open) { setDraft(''); setEditId(null); setEditBody(''); }
  }, [open]);

  function handleAdd() {
    const body = draft.trim();
    if (!body) return;
    addShiftNote({
      bizId, date: dateIso, author: authorName || 'Sense usuari',
      body, createdAt: Date.now(),
    });
    setDraft('');
  }
  function startEdit(n: ShiftNote) {
    setEditId(n.id); setEditBody(n.body);
  }
  function commitEdit() {
    if (!editId) return;
    const body = editBody.trim();
    if (body) editShiftNote(editId, body);
    setEditId(null); setEditBody('');
  }

  // Friendly weekday label for the header
  const DAYS = ['Diumenge','Dilluns','Dimarts','Dimecres','Dijous','Divendres','Dissabte'];
  const MONTHS = ['gen','feb','mar','abr','maig','jun','jul','ago','set','oct','nov','des'];
  const dayLabel = `${DAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;

  return (
    <AnimatedSheet open={open} onClose={onClose} zIndex={400}>
      <div style={{
        width: '100%',
        background: 'linear-gradient(180deg, var(--paper) 0%, var(--ink-50) 100%)',
        borderRadius: '22px 22px 0 0',
        padding: '10px 16px 24px',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)',
        boxShadow: '0 -8px 32px rgba(60,40,20,.18)',
        maxHeight: '82dvh', overflowY: 'auto',
      }}>
        <div style={{
          width: 38, height: 4, borderRadius: 2,
          background: 'var(--ink-200)', margin: '8px auto 16px',
        }} />

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          padding: '0 4px', marginBottom: 16,
        }}>
          <div>
            <div style={{
              fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 500,
              color: 'var(--ink-900)', letterSpacing: -.005, lineHeight: 1.1,
            }}>
              Notes del torn
            </div>
            <div style={{
              fontSize: 11, color: 'var(--ink-500)', fontWeight: 600,
              letterSpacing: .08, textTransform: 'uppercase', marginTop: 4,
              fontFamily: 'var(--font-mono)',
            }}>
              {dayLabel} · {todayNotes.length} {todayNotes.length === 1 ? 'nota' : 'notes'}
            </div>
          </div>
          <button onClick={onClose} aria-label="Tancar" className="tac-btn"
            style={{
              width: 34, height: 34, borderRadius: 999,
              color: 'var(--ink-600)',
              display: 'grid', placeItems: 'center', flexShrink: 0,
            }}>
            <Icon d={I.x} size={15} />
          </button>
        </div>

        {/* New-note composer */}
        <div style={{
          background: 'var(--paper)',
          border: '1px solid rgba(60,40,20,.08)',
          borderRadius: 14, padding: 12,
          display: 'flex', flexDirection: 'column', gap: 10,
          marginBottom: 14,
          boxShadow: '0 1px 2px rgba(60,40,20,.04)',
        }}>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Escriu una nota — sense calamars, plat especial, hora de tancament…"
            rows={2}
            style={{
              width: '100%', resize: 'none',
              border: 'none', outline: 'none', background: 'transparent',
              fontFamily: 'inherit', fontSize: 14, color: 'var(--ink-900)',
              lineHeight: 1.45, padding: 0,
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--ink-400)', fontFamily: 'var(--font-mono)' }}>
              {authorName ? `Per ${authorName.split(' ')[0]}` : 'Sense usuari actiu'}
            </span>
            <button onClick={handleAdd} disabled={!draft.trim()} className="press"
              style={{
                marginLeft: 'auto',
                padding: '8px 14px', borderRadius: 10,
                border: 'none', cursor: draft.trim() ? 'pointer' : 'not-allowed',
                background: draft.trim()
                  ? 'linear-gradient(180deg, var(--terracotta-600) 0%, var(--terracotta-700) 100%)'
                  : 'var(--ink-100)',
                color: draft.trim() ? '#fff' : 'var(--ink-400)',
                fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', gap: 6,
                boxShadow: draft.trim() ? '0 2px 6px rgba(168,74,42,.24)' : 'none',
                transition: 'background 200ms var(--ease-in-out), box-shadow 200ms var(--ease-in-out), color 200ms var(--ease-in-out)',
              }}>
              <Icon d={I.plus} size={12} stroke={2.6} />
              Afegir nota
            </button>
          </div>
        </div>

        {/* Existing notes */}
        {todayNotes.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '32px 18px',
            color: 'var(--ink-500)',
            fontFamily: 'var(--font-serif)', fontSize: 14,
            fontStyle: 'italic',
          }}>
            Cap nota de torn per avui
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {todayNotes.map((n, i) => {
              const isEditing = editId === n.id;
              const t = new Date(n.createdAt);
              const hh = `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`;
              return (
                <div key={n.id}
                  className="row-stagger"
                  style={{
                    ['--row-i' as string]: Math.min(i, 7),
                    background: 'linear-gradient(180deg, #fff8e6 0%, #fbf2d3 100%)',
                    border: '1px solid rgba(180,140,40,.20)',
                    borderRadius: 12,
                    padding: '11px 12px 10px',
                    boxShadow: '0 1px 2px rgba(180,140,40,.08)',
                    display: 'flex', flexDirection: 'column', gap: 8,
                  }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: 10.5, fontWeight: 700, letterSpacing: .06,
                    color: '#8a6a10', textTransform: 'uppercase',
                    fontFamily: 'var(--font-mono)',
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: '#c89a3a' }} />
                    {n.author.split(' ')[0]}
                    <span style={{ width: 3, height: 3, borderRadius: 999, background: 'rgba(180,140,40,.45)' }} />
                    <span style={{ letterSpacing: .04 }}>{hh}</span>
                    <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                      {!isEditing && (
                        <button onClick={() => startEdit(n)} className="press"
                          style={iconBtn}>
                          <Icon d={I.pencil} size={12} stroke={2} />
                        </button>
                      )}
                      <button onClick={() => {
                        // Snapshot so the toast undo can restore the note as-is.
                        const snap = { bizId: n.bizId, date: n.date, author: n.author, body: n.body, createdAt: n.createdAt };
                        deleteShiftNote(n.id);
                        toast('Nota eliminada', {
                          icon: 'check', tone: 'ink', ms: 5000,
                          action: { label: 'Desfer', onClick: () => addShiftNote(snap) },
                        });
                      }} className="press"
                        style={{ ...iconBtn, color: '#a83020' }}>
                        <Icon d={I.trash} size={12} stroke={2} />
                      </button>
                    </span>
                  </div>
                  {isEditing ? (
                    <>
                      <textarea
                        value={editBody}
                        onChange={e => setEditBody(e.target.value)}
                        rows={2}
                        autoFocus
                        style={{
                          width: '100%', resize: 'none',
                          border: '1px solid rgba(180,140,40,.30)',
                          borderRadius: 8, padding: '8px 10px',
                          background: 'rgba(255,255,255,.6)',
                          outline: 'none',
                          fontFamily: 'var(--font-serif)', fontSize: 14,
                          color: '#5e4708', letterSpacing: -.005, lineHeight: 1.45,
                        }}
                      />
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button onClick={() => { setEditId(null); setEditBody(''); }} className="press"
                          style={{
                            padding: '5px 11px', borderRadius: 7, border: 'none',
                            background: 'transparent', color: 'var(--ink-500)',
                            fontFamily: 'inherit', fontSize: 11.5, fontWeight: 650, cursor: 'pointer',
                          }}>
                          Cancel·la
                        </button>
                        <button onClick={commitEdit} disabled={!editBody.trim()} className="press"
                          style={{
                            padding: '5px 11px', borderRadius: 7, border: 'none',
                            background: editBody.trim() ? '#8a6a10' : 'rgba(180,140,40,.20)',
                            color: editBody.trim() ? '#fff' : 'rgba(138,106,16,.5)',
                            fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700,
                            cursor: editBody.trim() ? 'pointer' : 'not-allowed',
                          }}>
                          Desar
                        </button>
                      </div>
                    </>
                  ) : (
                    <div style={{
                      fontFamily: 'var(--font-serif)', fontSize: 14.5, fontWeight: 500,
                      color: '#3e2f04', letterSpacing: -.005, lineHeight: 1.45,
                    }}>
                      {n.body}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AnimatedSheet>
  );
}

const iconBtn: React.CSSProperties = {
  width: 22, height: 22, borderRadius: 6, border: 'none',
  background: 'rgba(180,140,40,.14)', color: '#8a6a10',
  cursor: 'pointer',
  display: 'grid', placeItems: 'center', padding: 0,
};
