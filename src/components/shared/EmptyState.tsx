/**
 * EmptyState — shared editorial empty state.
 *
 * The reservations list pioneered the pattern (breathing glow + serif
 * line + quiet sub); every other screen had its own ad-hoc italic or
 * emoji. This unifies them: one component, same voice everywhere.
 *
 * Uses the global .empty-glow / .empty-breath / .empty-text-in keyframes
 * from index.css (already prefers-reduced-motion aware via the global
 * animation rules).
 */
import React from 'react';

export default function EmptyState({ icon, title, sub, glow, pad = 44 }: {
  /** Optional glyph above the title (emoji or small SVG). */
  icon?: React.ReactNode;
  title: string;
  sub?: string;
  /** Glow tint behind the content. Defaults to a soft olive calm. */
  glow?: string;
  /** Vertical padding — smaller for inline list slots, larger for full screens. */
  pad?: number;
}) {
  const g = glow ?? 'rgba(116,133,74,.20)';
  return (
    <div style={{
      position: 'relative', textAlign: 'center',
      padding: `${pad}px 20px`,
      color: 'var(--ink-500)', overflow: 'hidden',
    }}>
      <div className="empty-glow"
        style={{
          background: `radial-gradient(circle, ${g} 0%, transparent 70%)`,
          marginTop: -100, marginRight: -100,
        }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        {icon && (
          <span className="empty-breath" style={{ display: 'inline-block', fontSize: 26, lineHeight: 1 }}>
            {icon}
          </span>
        )}
        <div className="empty-text-in" style={{
          fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 500,
          color: 'var(--ink-800)', marginTop: icon ? 12 : 0,
          letterSpacing: -.005, lineHeight: 1.3,
        }}>
          {title}
        </div>
        {sub && (
          <div className="empty-text-in-2" style={{
            fontSize: 12.5, color: 'var(--ink-500)',
            maxWidth: 280, margin: '6px auto 0', lineHeight: 1.45,
          }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}
