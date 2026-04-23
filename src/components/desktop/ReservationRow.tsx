import { useState } from 'react';
import { Users, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { Reservation } from '@/types';
import StatusBadge from '@/components/shared/StatusBadge';
import { useAppStore } from '@/store/useAppStore';

function nameInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function nameColor(name: string): string {
  const colors = [
    'bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-teal-500',
    'bg-rose-500', 'bg-orange-500', 'bg-indigo-500', 'bg-cyan-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffff;
  return colors[hash % colors.length];
}

const TAG_LABELS: Record<string, { label: string; className: string }> = {
  'vip': { label: 'VIP', className: 'bg-amber-100 text-amber-700' },
  'aniversari': { label: 'Aniversari', className: 'bg-pink-100 text-pink-700' },
  'al·lergia': { label: 'Al·lèrgia', className: 'bg-red-100 text-red-700' },
  'habitual': { label: 'Habitual', className: 'bg-blue-100 text-blue-700' },
  'terrassa': { label: 'Terrassa', className: 'bg-green-100 text-green-700' },
};

interface Props {
  reservation: Reservation;
  isLast?: boolean;
}

export default function ReservationRow({ reservation, isLast }: Props) {
  const { updateReservation } = useAppStore();
  const [menuOpen, setMenuOpen] = useState(false);

  const statusActions: Array<{ label: string; status: Reservation['status'] }> = [
    { label: 'Confirmar', status: 'confirmada' },
    { label: 'A taula', status: 'a-taula' },
    { label: 'Cancel·lar', status: 'cancel·lada' },
    { label: 'No show', status: 'no-show' },
  ];

  return (
    <div className={clsx(
      'flex items-center gap-3 px-5 py-3 hover:bg-warm-100/40 transition-colors group relative',
      !isLast && 'border-b border-warm-100'
    )}>
      {/* Time */}
      <div className="w-12 flex-shrink-0 text-right">
        <span className="text-warm-800 text-sm font-semibold">{reservation.time}</span>
      </div>

      {/* Avatar */}
      <div className={clsx(
        'w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0',
        nameColor(reservation.customerName)
      )}>
        {nameInitials(reservation.customerName)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-warm-800 text-sm font-semibold truncate">{reservation.customerName}</span>
          {reservation.tags.map(tag => {
            const t = TAG_LABELS[tag];
            if (!t) return null;
            return (
              <span key={tag} className={clsx('text-xs px-1.5 py-0.5 rounded font-medium', t.className)}>
                {t.label}
              </span>
            );
          })}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {reservation.tableInfo && (
            <span className="text-warm-400 text-xs">{reservation.tableInfo}</span>
          )}
          {reservation.notes && (
            <span className="text-warm-400 text-xs truncate">{reservation.notes}</span>
          )}
        </div>
      </div>

      {/* Pax */}
      <div className="flex items-center gap-1 text-warm-500 flex-shrink-0">
        <Users className="w-3.5 h-3.5" />
        <span className="text-sm font-medium">{reservation.guestCount}</span>
      </div>

      {/* Status */}
      <div className="flex-shrink-0 relative">
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="flex items-center gap-0.5"
        >
          <StatusBadge status={reservation.status} />
          <ChevronDown className="w-3 h-3 text-warm-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-full mt-1 bg-white border border-warm-200 rounded-lg shadow-panel z-20 py-1 min-w-[130px]">
              {statusActions.map(action => (
                <button
                  key={action.status}
                  onClick={() => { updateReservation(reservation.id, { status: action.status }); setMenuOpen(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs text-warm-700 hover:bg-warm-100 transition-colors"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
