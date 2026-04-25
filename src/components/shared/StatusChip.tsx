import React from 'react';
import { STATE_LABELS } from '@/data/mockData';

interface Props { state: string; size?: 'sm' | 'md'; }

export function StatusChip({ state, size = 'md' }: Props) {
  const small = size === 'sm' ? { padding: '1px 7px', fontSize: 11 } : {};
  return (
    <span className={`chip state-${state}`} style={small}>
      <span className="dot" />
      {STATE_LABELS[state] ?? state}
    </span>
  );
}

export function Tag({ kind }: { kind: string }) {
  const map: Record<string, string> = { vip:'VIP', birthday:'Aniversari', allergy:"Al·lèrgia", regular:'Habitual', terrassa:'Terrassa' };
  return <span className={`tag ${kind}`}>{map[kind] ?? kind}</span>;
}
