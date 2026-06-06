/**
 * ResListSkeleton — shimmer placeholder for the reservation list shown ONLY
 * during a genuine first-load (cloud syncing, no cached rows yet). Mimics the
 * ResRow layout (accent bar · time · name line · status pill) so the real
 * content lands in the same place — no layout jump. Reads as "loading, not
 * empty/broken", which the bare empty-state would otherwise imply on a fresh
 * device.
 *
 * Pure CSS shimmer (background-position sweep); honours prefers-reduced-motion
 * (falls back to a static tint). Disabled cost: nothing renders once data
 * arrives.
 */
export default function ResListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-hidden="true" style={{ paddingTop: 4 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="skel-row"
          style={{
            width: 'calc(100% - 16px)', margin: '0 8px 5px',
            borderRadius: 12, padding: '12px 14px',
            background: 'var(--surface-elevated)',
            boxShadow: 'var(--shadow-sm), var(--shadow-ring), var(--shadow-inset-top)',
            display: 'flex', gap: 12, alignItems: 'center',
            // Fade later rows so the list "dissolves" downward — premium touch.
            opacity: 1 - i * 0.14,
          }}
        >
          <span className="skel-box" style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <span className="skel-box" style={{ width: '52%', height: 12, borderRadius: 6 }} />
            <span className="skel-box" style={{ width: '34%', height: 10, borderRadius: 6 }} />
          </div>
          <span className="skel-box" style={{ width: 64, height: 24, borderRadius: 999, flexShrink: 0 }} />
        </div>
      ))}
    </div>
  );
}
