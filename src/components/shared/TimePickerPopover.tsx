/**
 * TimePickerPopover — premium floating time picker anchored to a trigger.
 *
 * Two scrollable columns (hours + minutes) with snap-to-center, matching the
 * iOS-style wheel picker. The currently-selected value sits in a terracotta
 * pill in the middle row; surrounding values fade with the distance from
 * center. Tap any visible value to jump to it.
 *
 * Replaces the native <input type="time"> picker so the look matches the
 * DatePickerPopover and the rest of the restaurant counter UI.
 *
 * Behaviour mirrors DatePickerPopover:
 *   - Portal-rendered above a click-catching backdrop.
 *   - Positioning anchored under the trigger; flips above when not enough
 *     room; clamped horizontally to the viewport.
 *   - Selecting commits the value; the popover stays open so the operator
 *     can adjust the other column. The Check button confirms + closes.
 *   - Escape / outside click closes WITHOUT discarding (commits-as-you-go).
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon, I } from '@/components/shared/Icons';

interface Props {
  open: boolean;
  /** Current value in "HH:MM" 24-hour format. */
  value: string;
  onChange: (next: string) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  /** Minute step granularity (1, 5, 15…). Defaults to 5. */
  minuteStep?: number;
  zIndex?: number;
}

const ROW_H = 44; // px per row — also the snap height
const VISIBLE = 5; // rows shown (must be odd so a single row sits centered)

function parse(value: string): { h: number; m: number } {
  const [hStr, mStr] = (value || '00:00').split(':');
  const h = Math.min(23, Math.max(0, parseInt(hStr, 10) || 0));
  const m = Math.min(59, Math.max(0, parseInt(mStr, 10) || 0));
  return { h, m };
}

function format(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function TimePickerPopover({
  open, value, onChange, onClose, anchorRef, minuteStep = 5, zIndex = 300,
}: Props) {
  const { h: initH, m: initM } = parse(value);

  // Snap the minute to the step so the wheel always lands on a valid row.
  const snapToStep = (m: number) => Math.round(m / minuteStep) * minuteStep;
  const currentH = initH;
  const currentM = Math.min(59, snapToStep(initM));

  // Hours 0..23, minutes 0..55 (step 5 by default) — generated once per step.
  const hours   = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes = useMemo(() => {
    const arr: number[] = [];
    for (let m = 0; m < 60; m += minuteStep) arr.push(m);
    return arr;
  }, [minuteStep]);

  // ── Entrance/exit lifecycle ───────────────────────────────────────────────
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

  // ── Positioning (same logic as DatePickerPopover) ─────────────────────────
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; placement: 'below' | 'above' }>({
    top: 0, left: 0, placement: 'below',
  });
  useLayoutEffect(() => {
    if (!mounted || !anchorRef.current || !panelRef.current) return;
    const anchor = anchorRef.current.getBoundingClientRect();
    const panel  = panelRef.current.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const GAP = 10, MARGIN = 12;
    const fitsBelow = anchor.bottom + GAP + panel.height + MARGIN <= vh;
    const placement: 'below' | 'above' = fitsBelow ? 'below' : 'above';
    const top = placement === 'below' ? anchor.bottom + GAP : anchor.top - GAP - panel.height;
    const center = anchor.left + anchor.width / 2;
    let left = center - panel.width / 2;
    if (left < MARGIN) left = MARGIN;
    if (left + panel.width > vw - MARGIN) left = vw - MARGIN - panel.width;
    setPos({ top, left, placement });
  }, [mounted, vis, anchorRef]);

  useEffect(() => {
    if (!mounted) return;
    const reposition = () => {
      if (!anchorRef.current || !panelRef.current) return;
      const anchor = anchorRef.current.getBoundingClientRect();
      const panel  = panelRef.current.getBoundingClientRect();
      const vw = window.innerWidth, vh = window.innerHeight;
      const GAP = 10, MARGIN = 12;
      const fitsBelow = anchor.bottom + GAP + panel.height + MARGIN <= vh;
      const placement: 'below' | 'above' = fitsBelow ? 'below' : 'above';
      const top = placement === 'below' ? anchor.bottom + GAP : anchor.top - GAP - panel.height;
      const center = anchor.left + anchor.width / 2;
      let left = center - panel.width / 2;
      if (left < MARGIN) left = MARGIN;
      if (left + panel.width > vw - MARGIN) left = vw - MARGIN - panel.width;
      setPos({ top, left, placement });
    };
    window.addEventListener('resize', reposition, { passive: true });
    window.addEventListener('scroll', reposition, { capture: true, passive: true });
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, { capture: true } as EventListenerOptions);
    };
  }, [mounted, anchorRef]);

  // Escape to close.
  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mounted, onClose]);

  // ── Refs for the two scroll columns ───────────────────────────────────────
  const hourColRef = useRef<HTMLDivElement | null>(null);
  const minColRef  = useRef<HTMLDivElement | null>(null);

  // Center the columns on the current value whenever we mount or value changes
  // externally. Use scrollTop, not scrollTo({behavior:'smooth'}), to land
  // instantly on open (so the wheel never starts at zero and snaps later).
  useLayoutEffect(() => {
    if (!mounted) return;
    if (hourColRef.current) hourColRef.current.scrollTop = currentH * ROW_H;
    if (minColRef.current)  minColRef.current.scrollTop  = (currentM / minuteStep) * ROW_H;
  }, [mounted, currentH, currentM, minuteStep]);

  // Track which row is centered, so the highlight follows the wheel as it
  // scrolls (before the operator lifts). On scroll end we commit by snapping.
  const [hoverH, setHoverH] = useState(currentH);
  const [hoverM, setHoverM] = useState(currentM);

  useEffect(() => { setHoverH(currentH); }, [currentH]);
  useEffect(() => { setHoverM(currentM); }, [currentM]);

  // Debounced commit on scroll end (also handles touch+wheel).
  const commitTimer = useRef<number | null>(null);
  const onScroll = (which: 'h' | 'm') => (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rawIdx = Math.round(el.scrollTop / ROW_H);
    if (which === 'h') {
      const i = Math.min(23, Math.max(0, rawIdx));
      setHoverH(i);
    } else {
      const i = Math.min(minutes.length - 1, Math.max(0, rawIdx));
      setHoverM(minutes[i] ?? 0);
    }
    if (commitTimer.current !== null) window.clearTimeout(commitTimer.current);
    commitTimer.current = window.setTimeout(() => {
      const idx = Math.round(el.scrollTop / ROW_H);
      const targetTop = idx * ROW_H;
      if (Math.abs(el.scrollTop - targetTop) > 0.5) {
        el.scrollTo({ top: targetTop, behavior: 'smooth' });
      }
      // Commit to parent
      if (which === 'h') {
        const ni = Math.min(23, Math.max(0, idx));
        onChange(format(ni, hoverM));
      } else {
        const ni = Math.min(minutes.length - 1, Math.max(0, idx));
        onChange(format(hoverH, minutes[ni] ?? 0));
      }
    }, 140);
  };

  const handleNow = () => {
    const d = new Date();
    const h = d.getHours();
    const m = snapToStep(d.getMinutes());
    onChange(format(h, m));
    // Scroll wheels to new positions so the operator sees the result.
    if (hourColRef.current) hourColRef.current.scrollTo({ top: h * ROW_H, behavior: 'smooth' });
    if (minColRef.current)  minColRef.current.scrollTo({ top: (m / minuteStep) * ROW_H, behavior: 'smooth' });
  };

  if (!mounted) return null;

  const padTopBot = (VISIBLE - 1) / 2 * ROW_H; // empty rows so the first and last items can reach center

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: zIndex - 1, background: 'transparent' }}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        className={`picker-pop ${vis ? 'vis' : ''}`}
        role="dialog" aria-label="Selecciona una hora"
        data-placement={pos.placement}
        style={{
          position: 'fixed',
          top: pos.top, left: pos.left,
          zIndex,
          width: 260,
          background: 'var(--surface-elevated)',
          border: '1px solid rgba(60,40,20,.10)',
          borderRadius: 20,
          boxShadow: 'var(--shadow-2xl), var(--shadow-inset-top)',
          padding: '16px 16px 14px',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {/* ── Header: current value in big serif ─────────────────────── */}
        <div style={{
          textAlign: 'center', marginBottom: 12,
          fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 500,
          color: 'var(--ink-900)', letterSpacing: -.01,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {format(hoverH, hoverM)}
        </div>

        {/* ── Two scroll wheels + a center band that marks selection ──── */}
        <div style={{
          position: 'relative',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
          height: ROW_H * VISIBLE,
        }}>
          {/* Center band — terracotta pill behind the centered row */}
          <div aria-hidden style={{
            position: 'absolute',
            top: padTopBot, left: 0, right: 0, height: ROW_H,
            background: 'var(--terracotta-50)',
            border: '1px solid rgba(168,74,42,.16)',
            borderRadius: 12,
            pointerEvents: 'none',
          }} />

          {/* HOUR column */}
          <Column
            innerRef={hourColRef}
            values={hours}
            selectedIdx={hoverH}
            onScroll={onScroll('h')}
            onPick={(v) => {
              if (hourColRef.current) hourColRef.current.scrollTo({ top: v * ROW_H, behavior: 'smooth' });
            }}
            padTopBot={padTopBot}
          />
          {/* MINUTE column */}
          <Column
            innerRef={minColRef}
            values={minutes}
            selectedIdx={minutes.indexOf(hoverM)}
            onScroll={onScroll('m')}
            onPick={(v) => {
              const idx = minutes.indexOf(v);
              if (idx >= 0 && minColRef.current) minColRef.current.scrollTo({ top: idx * ROW_H, behavior: 'smooth' });
            }}
            padTopBot={padTopBot}
          />

          {/* Top + bottom fade gradients — visual cue that there's more above/below */}
          <div aria-hidden style={topFade} />
          <div aria-hidden style={bottomFade} />
        </div>

        {/* ── Footer: Ara (now) + Check (confirm) ─────────────────────── */}
        <div style={{
          display: 'flex', gap: 8, marginTop: 12,
          paddingTop: 12, borderTop: '1px solid rgba(60,40,20,.08)',
        }}>
          <button onClick={handleNow} className="press"
            style={{
              flex: 1, padding: '10px 14px',
              border: '1px solid rgba(60,40,20,.10)',
              borderRadius: 10, background: 'var(--surface-base)',
              color: 'var(--terracotta-700)',
              fontFamily: 'inherit', fontSize: 13.5, fontWeight: 650,
              cursor: 'pointer', minHeight: 42,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
            Ara
          </button>
          <button onClick={onClose} className="press"
            aria-label="Confirmar"
            style={{
              padding: '10px 14px',
              border: 'none', borderRadius: 10,
              background: 'var(--terracotta-600)', color: '#fff',
              fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700,
              cursor: 'pointer', minHeight: 42, minWidth: 56,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              boxShadow: '0 1px 2px rgba(168,74,42,.32), inset 0 1px 0 rgba(255,255,255,.18)',
            }}>
            <Icon d={I.check} size={18} stroke={2.4} />
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}

// ── Single scrollable wheel column ──────────────────────────────────────────
function Column({
  innerRef, values, selectedIdx, onScroll, onPick, padTopBot,
}: {
  innerRef: React.MutableRefObject<HTMLDivElement | null>;
  values: number[];
  selectedIdx: number;
  onScroll: React.UIEventHandler<HTMLDivElement>;
  onPick: (v: number) => void;
  padTopBot: number;
}) {
  return (
    <div
      ref={innerRef}
      className="scroll"
      onScroll={onScroll}
      style={{
        height: '100%',
        overflowY: 'auto',
        scrollSnapType: 'y mandatory',
        // -webkit-mask creates the soft top/bottom fade ON the column itself,
        // independent of the absolutely-positioned overlay fades. Both work
        // together so the gradient also masks the actual rows.
        WebkitMaskImage:
          'linear-gradient(180deg, transparent 0, #000 24%, #000 76%, transparent 100%)',
        maskImage:
          'linear-gradient(180deg, transparent 0, #000 24%, #000 76%, transparent 100%)',
      }}
    >
      {/* Top padding so the first value can reach the centered band */}
      <div style={{ height: padTopBot }} aria-hidden />
      {values.map((v, i) => {
        const isSel = i === selectedIdx;
        return (
          <button key={v} onClick={() => onPick(v)}
            style={{
              height: ROW_H, width: '100%',
              border: 'none', background: 'transparent', cursor: 'pointer',
              fontFamily: 'var(--font-serif)',
              fontSize: isSel ? 22 : 18,
              fontWeight: isSel ? 600 : 500,
              color: isSel ? 'var(--terracotta-700)' : 'var(--ink-700)',
              letterSpacing: -.005,
              scrollSnapAlign: 'center',
              transition: 'font-size 140ms var(--ease-out), color 140ms var(--ease-out)',
              fontVariantNumeric: 'tabular-nums',
            }}>
            {String(v).padStart(2, '0')}
          </button>
        );
      })}
      <div style={{ height: padTopBot }} aria-hidden />
    </div>
  );
}

// Soft fades that overlay the columns at the top and bottom of the scroll area.
const topFade: React.CSSProperties = {
  position: 'absolute', top: 0, left: 0, right: 0, height: 36,
  background: 'linear-gradient(180deg, var(--surface-elevated) 0%, rgba(255,255,255,0) 100%)',
  pointerEvents: 'none',
  borderTopLeftRadius: 20, borderTopRightRadius: 20,
};
const bottomFade: React.CSSProperties = {
  position: 'absolute', bottom: 0, left: 0, right: 0, height: 36,
  background: 'linear-gradient(0deg, var(--surface-elevated) 0%, rgba(255,255,255,0) 100%)',
  pointerEvents: 'none',
};
