/**
 * BriefingSheet — slide-up "Briefing del servei" panel.
 *
 * Opens from the microcopy line under the date or from the hero's
 * "Veure detall →" CTA when the headline doesn't carry a specific
 * action. Reads the same ambient + insights data the rest of the AI
 * layer uses; renders it as a calm narrative + risks + suggested
 * actions list.
 *
 * Visual tone: paper card surface, serif sentences, mono uppercase
 * eyebrows, accent line on action buttons. No emoji floods, no
 * SaaS dashboard colours.
 */

import { useMemo } from 'react';
import AnimatedSheet from './AnimatedSheet';
import { useAppStore } from '@/store/useAppStore';
import { useAmbientState, type AmbientState } from '@/hooks/useAmbientState';
import { generateBriefing, type SuggestedAction } from '@/utils/briefing';
import type { WeatherForecast } from '@/lib/weather';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Forecast cached by the shell — passed in so we don't re-fetch. */
  forecast: WeatherForecast | null;
  /** Tab setter to navigate to floor plan / reservations on suggested actions. */
  onNavigateTab?: (tab: 'reservations' | 'tables' | 'walkin' | 'clients' | 'more') => void;
  /** Optional ambient state override; otherwise computed inline. */
  ambientOverride?: AmbientState;
}

const LEVEL_LABEL: Record<AmbientState['level'], string> = {
  calm:   'Servei tranquil',
  normal: 'Ritme habitual',
  busy:   'Servei amb càrrega',
  peak:   'Pic de servei',
};

const LEVEL_TINT: Record<AmbientState['level'], { bg: string; fg: string; ring: string }> = {
  calm:   { bg: 'rgba(116,133,74,.10)', fg: 'var(--olive-700)',      ring: 'rgba(116,133,74,.22)' },
  normal: { bg: 'rgba(60,40,20,.06)',   fg: 'var(--ink-700)',        ring: 'rgba(60,40,20,.10)'   },
  busy:   { bg: 'rgba(176,118,54,.10)', fg: 'var(--clay-700)',       ring: 'rgba(176,118,54,.22)' },
  peak:   { bg: 'rgba(168,74,42,.10)',  fg: 'var(--terracotta-700)', ring: 'rgba(168,74,42,.22)'  },
};

const TONE_ACCENT: Record<SuggestedAction['tone'], string> = {
  olive:      'var(--olive-500)',
  clay:       'var(--clay-500)',
  terracotta: 'var(--terracotta-500)',
  ink:        'var(--ink-300)',
};

export default function BriefingSheet({ open, onClose, forecast, onNavigateTab, ambientOverride }: Props) {
  const {
    selectedBusiness, selectedDate, reservations, customers, waitlist,
    setShowWaitlist,
  } = useAppStore();

  // Use the override if provided (shell already has one); otherwise
  // compute locally so the sheet works in isolation.
  const inlineAmbient = useAmbientState({
    selectedDate, bizId: selectedBusiness, reservations, waitlist, forecast,
  });
  const ambient = ambientOverride ?? inlineAmbient;

  const briefing = useMemo(() => generateBriefing({
    selectedDate, bizId: selectedBusiness,
    reservations, customers, waitlist, forecast, ambient,
  }), [selectedDate, selectedBusiness, reservations, customers, waitlist, forecast, ambient]);

  function runAction(a: SuggestedAction) {
    switch (a.kind) {
      case 'open-waitlist':
        setShowWaitlist(true);
        onClose();
        break;
      case 'open-weather':
        window.dispatchEvent(new CustomEvent('app:open-weather'));
        onClose();
        break;
      case 'open-floor-plan':
        onNavigateTab?.('tables');
        onClose();
        break;
      case 'show-pending':
        // Jump to Reserves tab — the pendents card on OpsLeftPanel + the
        // status badges on rows make the filter visually obvious. We
        // don't apply a real filter here to avoid hidden state surprises.
        onNavigateTab?.('reservations');
        onClose();
        break;
      case 'show-large-groups':
        window.dispatchEvent(new CustomEvent('app:show-large-groups'));
        onClose();
        break;
      case 'show-vip':
        window.dispatchEvent(new CustomEvent('app:show-vip'));
        onClose();
        break;
      case 'show-hour':
        if (a.meta && typeof a.meta.hour === 'number') {
          window.dispatchEvent(new CustomEvent('app:scroll-to-hour', { detail: { hour: a.meta.hour } }));
        }
        onClose();
        break;
    }
  }

  const tint = LEVEL_TINT[briefing.level];

  return (
    <AnimatedSheet open={open} onClose={onClose} desktopMaxWidth={640}>
      <div style={{
        padding: '20px 22px 24px',
        display: 'flex', flexDirection: 'column', gap: 18,
        // Keep the sheet on paper — same surface as the rest of the
        // ambient-aware UI.
        background: 'var(--surface-elevated)',
        color: 'var(--ink-900)',
      }}>
        {/* Header — eyebrow + title + level chip */}
        <header style={{
          display: 'flex', alignItems: 'flex-start', gap: 12,
          paddingBottom: 6,
          borderBottom: '1px solid rgba(60,40,20,.06)',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: .14,
              color: tint.fg, textTransform: 'uppercase',
              fontFamily: 'var(--font-mono)',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              marginBottom: 4,
            }}>
              <span aria-hidden style={{
                display: 'inline-block', width: 5, height: 5, borderRadius: 999,
                background: tint.fg, boxShadow: `0 0 0 3px ${tint.bg}`,
              }} />
              Briefing del servei
            </div>
            <div style={{
              fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 500,
              letterSpacing: -.012, color: 'var(--ink-900)',
            }}>
              {LEVEL_LABEL[briefing.level]}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Tancar"
            className="tac-btn tac-btn--ghost"
            style={{
              flexShrink: 0, width: 36, height: 36,
              display: 'grid', placeItems: 'center', borderRadius: 10,
              fontSize: 20, color: 'var(--ink-500)', lineHeight: 1,
            }}
          >
            ×
          </button>
        </header>

        {/* Summary — narrative sentences */}
        {briefing.summary.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {briefing.summary.map((s, i) => (
              <p key={i} style={{
                margin: 0,
                fontFamily: 'var(--font-serif)', fontSize: 15,
                lineHeight: 1.55, color: 'var(--ink-800)', letterSpacing: -.003,
              }}>
                {s}
              </p>
            ))}
          </section>
        )}

        {/* Risks */}
        {briefing.risks.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: .14,
              color: 'var(--ink-500)', textTransform: 'uppercase',
              fontFamily: 'var(--font-mono)',
            }}>
              Punts d'atenció
            </div>
            <ul style={{
              margin: 0, padding: 0, listStyle: 'none',
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              {briefing.risks.map(r => {
                const accent =
                  r.tone === 'alert'   ? 'var(--terracotta-600)' :
                  r.tone === 'warning' ? 'var(--clay-600)' :
                                          'var(--ink-400)';
                return (
                  <li key={r.id} style={{
                    position: 'relative',
                    padding: '8px 12px 8px 16px',
                    borderRadius: 10,
                    background: r.tone === 'alert'
                      ? 'rgba(168,74,42,.05)'
                      : r.tone === 'warning'
                        ? 'rgba(176,118,54,.05)'
                        : 'rgba(60,40,20,.03)',
                    fontSize: 13, lineHeight: 1.4,
                    color: 'var(--ink-800)',
                  }}>
                    <span aria-hidden style={{
                      position: 'absolute', left: 0, top: 8, bottom: 8,
                      width: 3, background: accent, borderRadius: 999,
                    }} />
                    {r.text}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Suggested actions */}
        {briefing.actions.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: .14,
              color: 'var(--ink-500)', textTransform: 'uppercase',
              fontFamily: 'var(--font-mono)',
            }}>
              Accions suggerides
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {briefing.actions.map(a => (
                <button
                  key={a.id}
                  onClick={() => runAction(a)}
                  className="tac-btn"
                  style={{
                    position: 'relative',
                    width: '100%', textAlign: 'left',
                    padding: '12px 14px 12px 18px',
                    borderRadius: 12,
                    background: 'var(--surface-elevated)',
                    boxShadow: '0 0 0 1px rgba(60,40,20,.08) inset, 0 1px 0 rgba(255,255,255,.5) inset',
                    fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}
                >
                  <span aria-hidden style={{
                    position: 'absolute', left: 0, top: 10, bottom: 10,
                    width: 3, background: TONE_ACCENT[a.tone], borderRadius: 999,
                  }} />
                  <span style={{
                    flex: 1,
                    fontSize: 13.5, fontWeight: 600, color: 'var(--ink-900)',
                    letterSpacing: -.003,
                  }}>
                    {a.label}
                  </span>
                  <span aria-hidden style={{
                    color: 'var(--ink-500)', fontSize: 14, fontWeight: 600,
                  }}>
                    →
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Empty fallback — should be rare; engine usually produces at least one line */}
        {briefing.summary.length === 0 && briefing.risks.length === 0 && briefing.actions.length === 0 && (
          <p style={{
            margin: 0, fontFamily: 'var(--font-serif)', fontSize: 14,
            lineHeight: 1.5, color: 'var(--ink-500)',
          }}>
            Sense context destacat per aquest dia. Revisa reserves i prepara la sala amb tranquil·litat.
          </p>
        )}
      </div>
    </AnimatedSheet>
  );
}
