/**
 * Toaster — minimal Sonner-flavoured toast system, no external deps.
 *
 * Mount <Toaster /> once at the shell (already done in TouchShell). Anywhere
 * in the app, call toast('message', { tone, icon }) to show a brief pill.
 *
 * Cohesion notes:
 *   - Eases with --ease-out for entrance, --ease-in-out for exit
 *   - Uses CSS transitions (not keyframes) so rapid toasts can retarget mid-
 *     animation (Sonner principle)
 *   - Auto-dismiss after 2.6s; up to 3 toasts stack with subtle scale-back
 *   - Duration scales with text length (longer text => slightly longer)
 */
import React, { useEffect, useState, useRef } from 'react';
import { Icon, I } from '@/components/shared/Icons';

export type ToastTone = 'olive' | 'terracotta' | 'clay' | 'rose' | 'ink';
export type ToastIcon = 'check' | 'x' | 'info' | 'alert';

export interface ToastAction {
  label:   string;
  onClick: () => void;
}

export interface ToastMsg {
  id:    number;
  text:  string;
  tone?: ToastTone;
  icon?: ToastIcon;
  /** Override duration in ms. */
  ms?:   number;
  /** Optional inline action (e.g. "Desfer"). Dismisses on click. */
  action?: ToastAction;
}

let nextId = 1;
export function toast(text: string, opts: Omit<ToastMsg, 'id' | 'text'> = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ToastMsg>('app:toast', {
    detail: { id: nextId++, text, ...opts },
  }));
}

const TONE_STYLE: Record<ToastTone, { bg: string; fg: string; ring: string }> = {
  olive:      { bg:'var(--olive-50)',      fg:'var(--olive-700)',      ring:'rgba(116,133,74,.30)' },
  terracotta: { bg:'var(--terracotta-50)', fg:'var(--terracotta-700)', ring:'rgba(168,74,42,.28)'  },
  clay:       { bg:'var(--clay-50)',       fg:'var(--clay-700)',       ring:'rgba(204,144,73,.28)' },
  rose:       { bg:'var(--rose-50)',       fg:'var(--rose-700)',       ring:'rgba(194,74,74,.28)'  },
  ink:        { bg:'var(--ink-100)',       fg:'var(--ink-800)',        ring:'rgba(60,40,20,.18)'   },
};

const ICON_PATH: Record<ToastIcon, React.ReactNode> = {
  check: I.check,
  x:     I.x,
  info:  I.users,   /* placeholder — uses an existing icon from the set */
  alert: I.x,
};

export default function Toaster() {
  const [list, setList] = useState<ToastMsg[]>([]);
  const timers = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    const onToast = (e: Event) => {
      const ce = e as CustomEvent<ToastMsg>;
      const m  = ce.detail;
      if (!m) return;
      setList(prev => [...prev.slice(-2), m]);  // cap at 3
      const ms = m.ms ?? Math.max(2300, Math.min(4200, 1800 + m.text.length * 32));
      const t = window.setTimeout(() => {
        setList(prev => prev.filter(x => x.id !== m.id));
        timers.current.delete(m.id);
      }, ms);
      timers.current.set(m.id, t);
    };
    const onDismiss = (e: Event) => {
      const ce = e as CustomEvent<number>;
      const id = ce.detail;
      setList(prev => prev.filter(x => x.id !== id));
      const t = timers.current.get(id);
      if (t) { window.clearTimeout(t); timers.current.delete(id); }
    };
    window.addEventListener('app:toast', onToast);
    window.addEventListener('app:toast:dismiss', onDismiss);
    return () => {
      window.removeEventListener('app:toast', onToast);
      window.removeEventListener('app:toast:dismiss', onDismiss);
      timers.current.forEach(t => window.clearTimeout(t));
      timers.current.clear();
    };
  }, []);

  if (list.length === 0) return null;

  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)',
        transform: 'translateX(-50%)',
        zIndex: 220,
        display: 'flex', flexDirection: 'column-reverse', alignItems: 'center',
        gap: 6,
        pointerEvents: 'none',
        maxWidth: '92vw',
      }}>
      {list.map((m, i, arr) => {
        const stackDepth = arr.length - 1 - i;
        const isTop      = stackDepth === 0;
        const tone       = TONE_STYLE[m.tone ?? 'ink'];
        return (
          <ToastPill key={m.id} m={m} tone={tone} stackDepth={stackDepth} isTop={isTop} />
        );
      })}
    </div>
  );
}

function ToastPill({ m, tone, stackDepth, isTop }: {
  m: ToastMsg;
  tone: { bg: string; fg: string; ring: string };
  stackDepth: number;
  isTop: boolean;
}) {
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setVis(true));
    return () => cancelAnimationFrame(r);
  }, []);

  const visTransform =
    `translateY(${vis ? -stackDepth * 6 : 16}px) ` +
    `scale(${vis ? 1 - stackDepth * 0.04 : 0.94})`;

  return (
    <div style={{
      pointerEvents: 'auto',
      background: tone.bg,
      color:      tone.fg,
      border:     `1px solid ${tone.ring}`,
      borderRadius: 14,
      padding: '10px 16px',
      boxShadow: isTop
        ? '0 8px 24px rgba(60,40,20,.14), 0 2px 6px rgba(60,40,20,.08)'
        : '0 4px 12px rgba(60,40,20,.08)',
      fontFamily: 'inherit',
      fontSize: 13.5,
      fontWeight: 600,
      letterSpacing: -.005,
      display: 'flex', alignItems: 'center', gap: 9,
      minHeight: 38,
      transform: visTransform,
      opacity: vis ? (isTop ? 1 : 0.85) : 0,
      filter: vis ? 'blur(0)' : 'blur(2px)',
      transition:
        'transform 360ms cubic-bezier(0.23, 1, 0.32, 1),' +
        ' opacity 240ms ease-out,' +
        ' filter 220ms ease-out',
      willChange: 'transform, opacity',
    }}>
      {m.icon && (
        <span style={{
          width: 22, height: 22, borderRadius: 999,
          background: 'rgba(255,255,255,.65)',
          display: 'grid', placeItems: 'center',
          flexShrink: 0,
        }}>
          <Icon d={ICON_PATH[m.icon]} size={13} stroke={2.4} />
        </span>
      )}
      <span style={{
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        maxWidth: 'calc(92vw - 80px)',
      }}>
        {m.text}
      </span>
      {m.action && (
        <button
          onClick={() => {
            m.action!.onClick();
            // Notify Toaster to remove this toast immediately on action click.
            window.dispatchEvent(new CustomEvent('app:toast:dismiss', { detail: m.id }));
          }}
          style={{
            marginLeft: 4,
            padding: '4px 10px',
            borderRadius: 999,
            border: `1px solid ${tone.ring}`,
            background: 'rgba(255,255,255,.6)',
            color: tone.fg,
            fontFamily: 'inherit',
            fontSize: 12.5,
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}>
          {m.action.label}
        </button>
      )}
    </div>
  );
}
