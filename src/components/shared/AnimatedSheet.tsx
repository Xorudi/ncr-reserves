/**
 * AnimatedSheet — iOS-style bottom sheet with slide-up entrance and slide-down exit.
 *
 * Uses ReactDOM.createPortal to render directly in document.body, bypassing any
 * overflow:hidden ancestors (which on iOS Safari clip position:fixed children).
 *
 * Usage:
 *   <AnimatedSheet open={show} onClose={close} zIndex={100}>
 *     <div style={{ borderRadius:'18px 18px 0 0', background:'var(--paper)', ... }}>
 *       ...content...
 *     </div>
 *   </AnimatedSheet>
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  open: boolean;
  onClose: () => void;
  /** z-index of the panel. Backdrop gets zIndex - 1. */
  zIndex?: number;
  children: React.ReactNode;
}

export default function AnimatedSheet({ open, onClose, zIndex = 100, children }: Props) {
  const [mounted, setMounted] = useState(open);
  const [vis, setVis]         = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Double rAF: first frame applies initial CSS (translateY(100%), opacity 0),
      // second frame flips to .vis so the CSS transition fires correctly.
      const r1 = requestAnimationFrame(() => requestAnimationFrame(() => setVis(true)));
      return () => cancelAnimationFrame(r1);
    } else {
      setVis(false);
      const t = setTimeout(() => setMounted(false), 400);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Separate effect: notify chrome (FAB, bottom-nav) about open/close so it
  // can move out of the way. Using a dedicated effect with paired open/close
  // dispatches via cleanup keeps the counter balanced under rapid toggles.
  useEffect(() => {
    if (!open) return;
    window.dispatchEvent(new CustomEvent('app:sheet:opened'));
    return () => { window.dispatchEvent(new CustomEvent('app:sheet:closed')); };
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`sheet-backdrop ${vis ? 'vis' : ''}`}
        style={{ zIndex: zIndex - 1 }}
        onClick={onClose}
      />
      {/* Panel — children supply all visual styles (bg, radius, padding, etc.) */}
      <div
        className={`sheet-panel ${vis ? 'vis' : ''}`}
        style={{ zIndex }}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
