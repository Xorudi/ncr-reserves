/**
 * AnimatedSheet — iOS-style bottom sheet with slide-up entrance and slide-down exit.
 *
 * Usage:
 *   <AnimatedSheet open={show} onClose={close} zIndex={100}>
 *     <div style={{ borderRadius:'18px 18px 0 0', background:'var(--paper)', ... }}>
 *       ...content...
 *     </div>
 *   </AnimatedSheet>
 *
 * The component manages its own mount/unmount lifecycle so both enter and
 * exit animations play fully before the DOM node disappears.
 */

import React, { useState, useEffect } from 'react';

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
      const r1 = requestAnimationFrame(() => {
        const r2 = requestAnimationFrame(() => setVis(true));
        return () => cancelAnimationFrame(r2);
      });
      return () => cancelAnimationFrame(r1);
    } else {
      setVis(false);
      // Keep mounted long enough for the exit transition to finish (--dur-sheet-exit ≈ 270ms)
      const t = setTimeout(() => setMounted(false), 310);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!mounted) return null;

  return (
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
    </>
  );
}
