/**
 * AnimatedSheet — adaptive sheet primitive.
 *
 *   • iPad / touch / phone → iOS-style bottom drawer that slides up from
 *     the bottom edge, full viewport width, with the heavy drawer
 *     easing curve (ease-drawer at 380 ms).
 *
 *   • Non-touch PC desktop  → centered floating modal capped at a
 *     sensible max-width (default 620 px) with a soft descent: scale
 *     0.96 + translateY(-12px) → 1, ease-out at 220 ms. Modals carry
 *     no thumb metaphor — slide-up from the bottom on a 1920 × 1080
 *     mouse session overwhelms the rail layout.
 *
 * Rendered via createPortal into document.body to bypass any
 * overflow:hidden ancestors (iOS Safari clips position:fixed children
 * inside overflow-hidden scrollers).
 *
 * Events: dispatches `app:sheet:opened` / `app:sheet:closed` on the
 * window for FAB + bottom-nav suppression (kept intact).
 *
 * Usage:
 *   <AnimatedSheet open={show} onClose={close} zIndex={100} desktopMaxWidth={620}>
 *     <div style={{ borderRadius:'18px 18px 0 0', background:'var(--paper)', … }}>
 *       …content…
 *     </div>
 *   </AnimatedSheet>
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useDevice } from '@/hooks/useDevice';
import { Z_INDEX } from '@/lib/zIndex';

interface Props {
  open: boolean;
  onClose: () => void;
  /** z-index of the panel. Backdrop gets zIndex - 1. Defaults to Z_INDEX.sheet. */
  zIndex?: number;
  /**
   * Max-width when rendered as a centered modal on non-touch desktop.
   * Defaults to 620 px (good for forms and detail views). Pass 540 for
   * compact forms or 720 for content-heavy sheets (search, weather).
   */
  desktopMaxWidth?: number;
  children: React.ReactNode;
}

export default function AnimatedSheet({
  open,
  onClose,
  zIndex = Z_INDEX.sheet,
  desktopMaxWidth = 620,
  children,
}: Props) {
  const [mounted, setMounted] = useState(open);
  const [vis, setVis]         = useState(false);

  const { isLargeScreen, isTouch, isDesktop } = useDevice();

  /**
   * Modal mode: a non-touch PC browser ≥1100 px wide. The sheet becomes
   * a centered, capped-width floating card instead of a bottom drawer.
   * Touch kiosks (isTouch + isLargeScreen) keep the bottom-sheet
   * behaviour because a thumb-driven user still benefits from the
   * familiar bottom-anchor gesture, even on a large monitor.
   */
  const modalMode = isDesktop && !isTouch;

  /** Legacy width-cap for touch kiosks. Only applies in bottom-sheet
   *  mode to keep PAX grids and form fields tap-sized on a 1920 px
   *  touchscreen monitor. */
  const capContent = isLargeScreen && isTouch;

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Double rAF: first frame applies initial CSS (translateY/scale + opacity 0),
      // second frame flips to .vis so the CSS transition fires correctly.
      const r1 = requestAnimationFrame(() => requestAnimationFrame(() => setVis(true)));
      return () => cancelAnimationFrame(r1);
    } else {
      setVis(false);
      const t = setTimeout(() => setMounted(false), 400);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Notify chrome (FAB, bottom-nav) about open/close so it can move out
  // of the way. Paired open/close dispatches via cleanup keep the
  // counter balanced under rapid toggles.
  useEffect(() => {
    if (!open) return;
    window.dispatchEvent(new CustomEvent('app:sheet:opened'));
    return () => { window.dispatchEvent(new CustomEvent('app:sheet:closed')); };
  }, [open]);

  // ESC key support — only when in modal mode (touch users have no kbd).
  useEffect(() => {
    if (!open || !modalMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, modalMode, onClose]);

  if (!mounted) return null;

  // sheet-content inline styles vary by mode:
  //   modal      → cap width to desktopMaxWidth, all corners rounded
  //   touch kiosk → cap width to 880 px so PAX grids stay tap-sized
  //   otherwise  → fill (default)
  const contentStyle: React.CSSProperties | undefined = modalMode
    ? { maxWidth: desktopMaxWidth, marginLeft: 'auto', marginRight: 'auto' }
    : capContent
      ? { maxWidth: 880, marginLeft: 'auto', marginRight: 'auto' }
      : undefined;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`sheet-backdrop ${vis ? 'vis' : ''}`}
        style={{ zIndex: zIndex - 1 }}
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel — data-mode switches the CSS variant. Children supply
          their own background/padding; we just position and clip them. */}
      <div
        className={`sheet-panel ${vis ? 'vis' : ''}`}
        data-mode={modalMode ? 'modal' : 'sheet'}
        style={{ zIndex }}
        role="dialog"
        aria-modal="true"
      >
        <div className="sheet-content" style={contentStyle}>
          {children}
        </div>
      </div>
    </>,
    document.body,
  );
}
