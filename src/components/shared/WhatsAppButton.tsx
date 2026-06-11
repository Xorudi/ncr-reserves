/**
 * WhatsAppButton — one-tap WhatsApp with a template picker.
 *
 * With `templates`, tapping opens a small chooser (portaled above every
 * sheet, z 400) listing the ready messages for this context; picking one
 * opens wa.me with the text prefilled — the operator can still edit it
 * inside WhatsApp before sending. With a single `message` (or nothing)
 * it links straight through.
 *
 * Renders nothing when the phone can't be normalized, so call sites can
 * drop it next to "Trucar" without guarding. WhatsApp green is kept as a
 * functional affordance but muted to sit within the palette.
 */
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { waLink, type WaTemplate } from '@/utils/whatsapp';
import { useResolvedTheme } from '@/lib/theme';

/** Official WhatsApp glyph (single filled path, scaled to 24-box). */
function WaGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.04 2a9.9 9.9 0 0 0-8.57 14.86L2 22l5.3-1.39A9.9 9.9 0 1 0 12.04 2Zm0 18.1a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.14.82.84-3.07-.2-.31a8.2 8.2 0 1 1 6.98 3.89Zm4.5-6.14c-.25-.12-1.46-.72-1.69-.8-.22-.08-.39-.12-.55.12-.17.25-.64.8-.78.97-.14.16-.29.18-.53.06-.25-.12-1.04-.38-1.98-1.22a7.4 7.4 0 0 1-1.37-1.7c-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.55-1.33-.76-1.82-.2-.48-.4-.41-.55-.42h-.47c-.16 0-.43.06-.66.31-.22.25-.86.84-.86 2.05 0 1.2.88 2.37 1 2.53.12.17 1.73 2.64 4.18 3.7.58.25 1.04.4 1.4.52.59.18 1.12.16 1.54.1.47-.07 1.46-.6 1.66-1.18.2-.57.2-1.06.14-1.17-.06-.1-.22-.16-.47-.28Z" />
    </svg>
  );
}

export default function WhatsAppButton({ phone, message, templates, label = 'WhatsApp', flex, compact }: {
  phone: string | undefined | null;
  /** Single fixed message (no picker). Ignored when `templates` is set. */
  message?: string;
  /** Multiple ready messages — tapping opens the picker. */
  templates?: WaTemplate[];
  label?: string;
  /** Pass a flex value to share a row with sibling buttons. */
  flex?: number;
  /** Icon-leaning small variant for tight rows. */
  compact?: boolean;
}) {
  const theme = useResolvedTheme();
  const [pickerOpen, setPickerOpen] = useState(false);
  const direct = waLink(phone, message);
  if (!direct) return null;

  const day = theme === 'llum';
  const baseStyle: React.CSSProperties = {
    flex,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: compact ? '7px 12px' : '10px 12px',
    borderRadius: compact ? 8 : 11,
    fontSize: compact ? 12.5 : 13, fontWeight: 650,
    textDecoration: 'none',
    cursor: 'pointer', fontFamily: 'inherit',
    // Muted WhatsApp green — recognition without neon.
    background: day
      ? 'linear-gradient(180deg, #e4f3e4, #d4ead3)'
      : 'linear-gradient(180deg, #1f3a26, #19301f)',
    border: day ? '1px solid rgba(37,140,80,.28)' : '1px solid rgba(98,212,134,.30)',
    color: day ? '#1c7a44' : '#7ad99c',
    boxShadow: 'var(--shadow-inset-top), 0 1px 2px rgba(0,0,0,.10)',
  };

  const hasPicker = !!templates && templates.length > 0;

  function send(text: string) {
    const href = waLink(phone, text || undefined);
    if (href) window.open(href, '_blank', 'noopener,noreferrer');
    setPickerOpen(false);
  }

  if (!hasPicker) {
    return (
      <a href={direct} target="_blank" rel="noopener noreferrer" className="tac-btn" style={baseStyle}>
        <WaGlyph size={compact ? 13 : 15} />
        {label}
      </a>
    );
  }

  return (
    <>
      <button type="button" className="tac-btn" style={baseStyle}
        onClick={() => setPickerOpen(true)}>
        <WaGlyph size={compact ? 13 : 15} />
        {label}
      </button>

      {pickerOpen && createPortal(
        <>
          {/* Backdrop above every sheet (TableSelector tops out at 301) */}
          <div onClick={() => setPickerOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,.45)' }} />
          <div style={{
            position: 'fixed', left: '50%', top: '50%', zIndex: 401,
            transform: 'translate(-50%, -50%)',
            width: 'min(360px, calc(100vw - 40px))',
            background: 'var(--surface-floating)',
            borderRadius: 16, padding: '16px 14px 14px',
            boxShadow: 'var(--shadow-2xl), var(--shadow-ring)',
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: .14,
              color: 'var(--ink-500)', textTransform: 'uppercase',
              fontFamily: 'var(--font-mono)', marginBottom: 10, padding: '0 4px',
            }}>
              Missatge per WhatsApp
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {templates!.map(t => (
                <button key={t.id} type="button" className="tac-btn"
                  onClick={() => send(t.text)}
                  style={{
                    textAlign: 'left', padding: '10px 12px', borderRadius: 10,
                    fontFamily: 'inherit', width: '100%',
                    display: 'flex', flexDirection: 'column', gap: 3,
                  }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-900)' }}>
                    {t.label}
                  </span>
                  {t.text && (
                    <span style={{
                      fontSize: 11.5, color: 'var(--ink-500)', lineHeight: 1.35,
                      overflow: 'hidden', textOverflow: 'ellipsis',
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical' as const,
                    }}>
                      {t.text}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setPickerOpen(false)} className="tac-btn tac-btn--ghost"
              style={{
                marginTop: 8, width: '100%', padding: '9px', borderRadius: 10,
                fontSize: 12.5, fontWeight: 600, color: 'var(--ink-500)', fontFamily: 'inherit',
              }}>
              Cancel·lar
            </button>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
