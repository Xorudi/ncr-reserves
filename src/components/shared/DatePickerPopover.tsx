/**
 * DatePickerPopover — premium floating calendar anchored to a trigger element.
 *
 * Replaces the native <input type="date"> picker so the design stays on-brand
 * (cream + terracotta + Fraunces) and the tap targets are big enough for a
 * restaurant counter touchscreen.
 *
 * Behaviour:
 *   - Portal-rendered above an opaque backdrop. Click outside or press Escape
 *     to dismiss. Selecting a day commits immediately and closes.
 *   - Positioning: computed once on open from the anchor's bounding rect.
 *     Falls back to "above the anchor" when there's no room below, and clamps
 *     horizontally so the popover never overflows the viewport.
 *   - Visible content adapts to the locale's first-day-of-week — for ca-ES we
 *     start the week on Monday.
 *   - Today and the selected day are visually distinct: today is a subtle
 *     terracotta ring, selected is a filled terracotta circle.
 *
 * The component does NOT manage open-state — pass `open` from the parent.
 * Parent decides when to mount the popover, which gives a clean fade/scale
 * entrance via the .picker-pop / .picker-pop.vis classes in index.css.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon, I } from '@/components/shared/Icons';

interface Props {
  open: boolean;
  /** Currently selected date. */
  selected: Date;
  /** Fires when a day is tapped. The popover does not close on its own;
   *  parent should call `onClose` from here if it wants close-on-select. */
  onSelect: (d: Date) => void;
  onClose: () => void;
  /** Element to anchor below. Required — without it we can't position. */
  anchorRef: React.RefObject<HTMLElement | null>;
  /** z-index of the panel. Backdrop gets zIndex − 1. Default 300. */
  zIndex?: number;
}

const WEEKDAYS_CA = ['dl.', 'dt.', 'dc.', 'dj.', 'dv.', 'ds.', 'dg.'];

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth()    === b.getMonth()
      && a.getDate()     === b.getDate();
}

export default function DatePickerPopover({
  open, selected, onSelect, onClose, anchorRef, zIndex = 300,
}: Props) {
  // The visible month — tracked separately from `selected` so the user can
  // navigate around without committing.
  const [view, setView] = useState<{ y: number; m: number }>(() => ({
    y: selected.getFullYear(),
    m: selected.getMonth(),
  }));

  // Realign the view month whenever the popover is opened so it always lands
  // on the currently-selected day's month.
  useEffect(() => {
    if (open) setView({ y: selected.getFullYear(), m: selected.getMonth() });
  }, [open, selected]);

  // ── Entrance/exit lifecycle (mirror AnimatedSheet's double-rAF pattern) ──
  const [mounted, setMounted] = useState(open);
  const [vis,     setVis]     = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setVis(true)));
      return () => cancelAnimationFrame(r);
    } else {
      setVis(false);
      const t = setTimeout(() => setMounted(false), 220);
      return () => clearTimeout(t);
    }
  }, [open]);

  // ── Positioning ──────────────────────────────────────────────────────────
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; placement: 'below' | 'above' }>({
    top: 0, left: 0, placement: 'below',
  });

  useLayoutEffect(() => {
    if (!mounted || !anchorRef.current || !panelRef.current) return;
    const anchor = anchorRef.current.getBoundingClientRect();
    const panel  = panelRef.current.getBoundingClientRect();
    const vw     = window.innerWidth;
    const vh     = window.innerHeight;
    const GAP    = 10;
    const MARGIN = 12;

    // Prefer below; fall back to above when there's not enough room.
    const fitsBelow = anchor.bottom + GAP + panel.height + MARGIN <= vh;
    const placement: 'below' | 'above' = fitsBelow ? 'below' : 'above';
    const top = placement === 'below'
      ? anchor.bottom + GAP
      : anchor.top    - GAP - panel.height;

    // Center horizontally on the anchor, clamped to the viewport.
    const anchorCenter = anchor.left + anchor.width / 2;
    let left = anchorCenter - panel.width / 2;
    if (left < MARGIN)               left = MARGIN;
    if (left + panel.width > vw - MARGIN) left = vw - MARGIN - panel.width;

    setPos({ top, left, placement });
  }, [mounted, vis, view, anchorRef]);

  // Reposition on resize / scroll so the popover follows its anchor.
  useEffect(() => {
    if (!mounted) return;
    const handler = () => {
      if (!anchorRef.current || !panelRef.current) return;
      const anchor = anchorRef.current.getBoundingClientRect();
      const panel  = panelRef.current.getBoundingClientRect();
      const vw = window.innerWidth, vh = window.innerHeight;
      const GAP = 10, MARGIN = 12;
      const fitsBelow = anchor.bottom + GAP + panel.height + MARGIN <= vh;
      const placement: 'below' | 'above' = fitsBelow ? 'below' : 'above';
      const top = placement === 'below'
        ? anchor.bottom + GAP
        : anchor.top - GAP - panel.height;
      const anchorCenter = anchor.left + anchor.width / 2;
      let left = anchorCenter - panel.width / 2;
      if (left < MARGIN) left = MARGIN;
      if (left + panel.width > vw - MARGIN) left = vw - MARGIN - panel.width;
      setPos({ top, left, placement });
    };
    window.addEventListener('resize', handler, { passive: true });
    window.addEventListener('scroll', handler, { capture: true, passive: true });
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, { capture: true } as EventListenerOptions);
    };
  }, [mounted, anchorRef]);

  // Escape to close.
  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mounted, onClose]);

  if (!mounted) return null;

  // ── Calendar math ────────────────────────────────────────────────────────
  // Build the visible cells: leading empty slots from prev month + actual
  // days + trailing slots so the grid is always a multiple of 7.
  const firstDow    = (new Date(view.y, view.m, 1).getDay() + 6) % 7; // Mon=0 … Sun=6
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const totalCells  = Math.ceil((firstDow + daysInMonth) / 7) * 7;
  const cells: (number | null)[] = Array(totalCells).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells[firstDow + d - 1] = d;

  const monthLabel = new Date(view.y, view.m, 1)
    .toLocaleDateString('ca-ES', { month: 'long', year: 'numeric' });

  const today = new Date();

  const shiftMonth = (delta: number) => {
    const nm = view.m + delta;
    const ny = view.y + Math.floor(nm / 12);
    const m  = ((nm % 12) + 12) % 12;
    setView({ y: ny, m });
  };

  const handleSelect = (day: number) => {
    onSelect(new Date(view.y, view.m, day));
    onClose();
  };

  const handleToday = () => {
    onSelect(new Date());
    onClose();
  };

  return createPortal(
    <>
      {/* Lightweight backdrop — captures outside clicks, no blur (we want
          the calendar to feel light and quick, not modal-heavy). */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: zIndex - 1,
          background: 'transparent',
        }}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        className={`picker-pop ${vis ? 'vis' : ''}`}
        role="dialog" aria-label="Selecciona una data"
        data-placement={pos.placement}
        style={{
          position: 'fixed',
          top: pos.top, left: pos.left,
          zIndex,
          width: 340,
          background: 'var(--surface-elevated)',
          border: '1px solid rgba(60,40,20,.10)',
          borderRadius: 20,
          boxShadow: 'var(--shadow-2xl), var(--shadow-inset-top)',
          padding: '16px 16px 14px',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {/* ── Header: month label + prev/next ───────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          marginBottom: 12,
        }}>
          <span style={{
            flex: 1,
            fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 500,
            color: 'var(--ink-900)', letterSpacing: -.005,
            textTransform: 'capitalize',
          }}>
            {monthLabel}
          </span>
          <button onClick={() => shiftMonth(-1)} className="press"
            aria-label="Mes anterior"
            style={pickerNavBtn}>
            <Icon d={I.chevL} size={18} stroke={1.9} />
          </button>
          <button onClick={() => shiftMonth(1)} className="press"
            aria-label="Mes següent"
            style={pickerNavBtn}>
            <Icon d={I.chevR} size={18} stroke={1.9} />
          </button>
        </div>

        {/* ── Weekday headers ───────────────────────────────────────────── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 2, marginBottom: 4,
        }}>
          {WEEKDAYS_CA.map(d => (
            <div key={d} style={{
              textAlign: 'center', padding: '6px 0',
              fontFamily: 'var(--font-mono)', fontSize: 10.5,
              fontWeight: 700, letterSpacing: .08,
              color: 'var(--ink-500)', textTransform: 'uppercase',
            }}>{d.replace('.', '')}</div>
          ))}
        </div>

        {/* ── Day grid ──────────────────────────────────────────────────── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2,
        }}>
          {cells.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} style={{ height: 40 }} />;
            const d       = new Date(view.y, view.m, day);
            const isSel   = sameDay(d, selected);
            const isToday = sameDay(d, today);
            return (
              <button key={isoDate(d)}
                onClick={() => handleSelect(day)}
                className="press"
                style={{
                  height: 40, width: '100%',
                  border: 'none', padding: 0,
                  background: 'transparent', cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'grid', placeItems: 'center',
                }}>
                <span style={{
                  width: 34, height: 34, borderRadius: 999,
                  display: 'grid', placeItems: 'center',
                  fontFamily: 'var(--font-serif)',
                  fontSize: 15,
                  fontWeight: isSel ? 600 : isToday ? 600 : 500,
                  color: isSel
                    ? '#ffffff'
                    : isToday
                      ? 'var(--terracotta-700)'
                      : 'var(--ink-800)',
                  background: isSel ? 'var(--terracotta-600)' : 'transparent',
                  boxShadow: isSel ? '0 1px 2px rgba(168,74,42,.32), inset 0 1px 0 rgba(255,255,255,.18)' : 'none',
                  border: !isSel && isToday ? '1.5px solid var(--terracotta-300, var(--terracotta-500))' : '1.5px solid transparent',
                  transition: 'background 160ms var(--ease-out), color 160ms var(--ease-out)',
                  letterSpacing: -.005,
                }}>
                  {day}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Footer actions: Avui + Tancar ─────────────────────────────── */}
        <div style={{
          display: 'flex', gap: 8, marginTop: 12,
          paddingTop: 12, borderTop: '1px solid rgba(60,40,20,.08)',
        }}>
          <button onClick={handleToday} className="tac-btn"
            style={{
              flex: 1, padding: '10px 14px',
              color: 'var(--terracotta-700)',
              fontSize: 13.5, fontWeight: 650,
              minHeight: 42,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
            Avui
          </button>
          <button onClick={onClose} className="tac-btn tac-btn--accent"
            aria-label="Tancar"
            style={{
              padding: '10px 14px',
              fontSize: 13.5, fontWeight: 700,
              minHeight: 42, minWidth: 56,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
            <Icon d={I.check} size={18} stroke={2.4} />
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}

const pickerNavBtn: React.CSSProperties = {
  width: 36, height: 36, borderRadius: 10,
  border: '1px solid rgba(60,40,20,.10)',
  background: 'var(--surface-base)',
  color: 'var(--ink-700)',
  cursor: 'pointer',
  display: 'grid', placeItems: 'center',
};
