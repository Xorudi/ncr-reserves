/**
 * WhatsAppButton — one-tap WhatsApp with an optional pre-filled message.
 *
 * Renders nothing when the phone can't be normalized, so call sites can
 * drop it next to "Trucar" without guarding. WhatsApp green is kept as a
 * functional affordance (operators recognize it instantly) but muted to
 * sit within the palette; vespre gets the dark-wash treatment.
 */
import React from 'react';
import { waLink } from '@/utils/whatsapp';
import { useResolvedTheme } from '@/lib/theme';

/** Official WhatsApp glyph (single filled path, scaled to 24-box). */
function WaGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.04 2a9.9 9.9 0 0 0-8.57 14.86L2 22l5.3-1.39A9.9 9.9 0 1 0 12.04 2Zm0 18.1a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.14.82.84-3.07-.2-.31a8.2 8.2 0 1 1 6.98 3.89Zm4.5-6.14c-.25-.12-1.46-.72-1.69-.8-.22-.08-.39-.12-.55.12-.17.25-.64.8-.78.97-.14.16-.29.18-.53.06-.25-.12-1.04-.38-1.98-1.22a7.4 7.4 0 0 1-1.37-1.7c-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.55-1.33-.76-1.82-.2-.48-.4-.41-.55-.42h-.47c-.16 0-.43.06-.66.31-.22.25-.86.84-.86 2.05 0 1.2.88 2.37 1 2.53.12.17 1.73 2.64 4.18 3.7.58.25 1.04.4 1.4.52.59.18 1.12.16 1.54.1.47-.07 1.46-.6 1.66-1.18.2-.57.2-1.06.14-1.17-.06-.1-.22-.16-.47-.28Z" />
    </svg>
  );
}

export default function WhatsAppButton({ phone, message, label = 'WhatsApp', flex, compact }: {
  phone: string | undefined | null;
  message?: string;
  label?: string;
  /** Pass a flex value to share a row with sibling buttons. */
  flex?: number;
  /** Icon-leaning small variant for tight rows. */
  compact?: boolean;
}) {
  const theme = useResolvedTheme();
  const href = waLink(phone, message);
  if (!href) return null;

  const day = theme === 'llum';
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="tac-btn"
      style={{
        flex,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: compact ? '7px 12px' : '10px 12px',
        borderRadius: compact ? 8 : 11,
        fontSize: compact ? 12.5 : 13, fontWeight: 650,
        textDecoration: 'none',
        // Muted WhatsApp green — recognition without neon.
        background: day
          ? 'linear-gradient(180deg, #e4f3e4, #d4ead3)'
          : 'linear-gradient(180deg, #1f3a26, #19301f)',
        border: day ? '1px solid rgba(37,140,80,.28)' : '1px solid rgba(98,212,134,.30)',
        color: day ? '#1c7a44' : '#7ad99c',
        boxShadow: 'var(--shadow-inset-top), 0 1px 2px rgba(0,0,0,.10)',
      }}
    >
      <WaGlyph size={compact ? 13 : 15} />
      {label}
    </a>
  );
}
