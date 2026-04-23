import { useState } from 'react';
import { Sun, Moon, ChevronDown, ChevronUp, BarChart2 } from 'lucide-react';
import clsx from 'clsx';
import { Reservation } from '@/types';
import ReservationRow from './ReservationRow';

interface ServiceBlockDef {
  id: string;
  name: string;
  timeRange: string;
}

interface Props {
  serviceBlock: ServiceBlockDef;
  reservations: Reservation[];
}

export default function ServiceBlock({ serviceBlock, reservations }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const sorted = [...reservations].sort((a, b) => a.time.localeCompare(b.time));

  const totalReserves = reservations.length;
  const totalComensals = reservations.reduce((sum, r) => sum + r.guestCount, 0);
  const aServei = reservations.filter(r => r.status === 'a-taula').length;
  const pendents = reservations.filter(r => r.status === 'pendent').length;

  const isMigdia = serviceBlock.id === 'migdia';

  return (
    <div className="bg-white rounded-xl shadow-card border border-warm-200 mb-4 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-warm-100/30 transition-colors"
        onClick={() => setCollapsed(v => !v)}
      >
        <div className={clsx(
          'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
          isMigdia ? 'bg-amber-100' : 'bg-indigo-100'
        )}>
          {isMigdia
            ? <Sun className="w-4 h-4 text-amber-600" />
            : <Moon className="w-4 h-4 text-indigo-600" />
          }
        </div>

        <div className="flex-1 flex items-center gap-3 flex-wrap">
          <span className="text-warm-800 font-semibold text-sm">{serviceBlock.name}</span>
          <span className="text-warm-400 text-xs">{serviceBlock.timeRange}</span>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs bg-warm-100 text-warm-600 rounded-full px-2 py-0.5 font-medium">
              {totalReserves} reserves
            </span>
            <span className="text-xs bg-warm-100 text-warm-600 rounded-full px-2 py-0.5 font-medium">
              {totalComensals} comensals
            </span>
            {aServei > 0 && (
              <span className="text-xs bg-brand/10 text-brand rounded-full px-2 py-0.5 font-medium">
                {aServei} a servei
              </span>
            )}
            {pendents > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 font-medium">
                {pendents} pendents
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            className="text-warm-400 hover:text-warm-600 p-1"
            onClick={e => e.stopPropagation()}
          >
            <BarChart2 className="w-4 h-4" />
          </button>
          {collapsed
            ? <ChevronDown className="w-4 h-4 text-warm-400" />
            : <ChevronUp className="w-4 h-4 text-warm-400" />
          }
        </div>
      </div>

      {/* Reservations list */}
      {!collapsed && (
        <div className="border-t border-warm-100">
          {sorted.length === 0 ? (
            <div className="px-5 py-6 text-center text-warm-400 text-sm">
              Sense reserves per aquest servei
            </div>
          ) : (
            sorted.map((r, idx) => (
              <ReservationRow
                key={r.id}
                reservation={r}
                isLast={idx === sorted.length - 1}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
