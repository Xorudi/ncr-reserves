import { SlidersHorizontal, LayoutGrid, MapPin } from 'lucide-react';
import { Reservation } from '@/types';
import { useAppStore } from '@/store/useAppStore';

interface StatsBarProps {
  reservations: Reservation[];
}

function computePeakSimultaneous(reservations: Reservation[]): number {
  // Count max overlapping reservations at any given hour slot
  const slots: Record<string, number> = {};
  reservations.forEach(r => {
    const [h] = r.time.split(':').map(Number);
    const key = `${h}`;
    slots[key] = (slots[key] || 0) + 1;
  });
  return Math.max(0, ...Object.values(slots));
}

export default function StatsBar({ reservations }: StatsBarProps) {
  const { businesses, selectedBusiness } = useAppStore();
  const biz = businesses.find(b => b.id === selectedBusiness);

  const totalReserves = reservations.length;
  const totalComensals = reservations.reduce((sum, r) => sum + r.guestCount, 0);
  const peak = computePeakSimultaneous(reservations);
  const pendents = reservations.filter(r => r.status === 'pendent').length;
  const capacitatTotal = 60;
  const ocupacio = Math.round((totalComensals / capacitatTotal) * 100);

  return (
    <div className="bg-white border border-warm-200 rounded-xl shadow-card px-5 py-3.5 mb-5 flex items-center justify-between gap-4">
      {/* Business location */}
      <div className="flex items-center gap-2 min-w-0">
        <MapPin className="w-3.5 h-3.5 text-warm-400 flex-shrink-0" />
        <div className="min-w-0">
          <div className="text-warm-800 text-sm font-semibold truncate">{biz?.name}</div>
          <div className="text-warm-400 text-xs truncate">{biz?.address}</div>
        </div>
      </div>

      <div className="h-8 w-px bg-warm-200 flex-shrink-0" />

      {/* Stats */}
      <div className="flex items-center gap-6 flex-1 justify-center">
        <div className="text-center">
          <div className="text-[10px] font-semibold tracking-widest uppercase text-warm-400 mb-0.5">Reserves</div>
          <div className="text-warm-800 text-xl font-semibold leading-none">{totalReserves}</div>
        </div>
        <div className="h-8 w-px bg-warm-200 flex-shrink-0" />
        <div className="text-center">
          <div className="text-[10px] font-semibold tracking-widest uppercase text-warm-400 mb-0.5">Comensals</div>
          <div className="text-warm-800 text-xl font-semibold leading-none">{totalComensals}</div>
        </div>
        <div className="h-8 w-px bg-warm-200 flex-shrink-0" />
        <div className="text-center">
          <div className="text-[10px] font-semibold tracking-widest uppercase text-warm-400 mb-0.5">Pic simultani</div>
          <div className="text-warm-800 text-xl font-semibold leading-none">
            {peak} <span className="text-sm text-warm-400 font-normal">reserves</span>
          </div>
        </div>
        <div className="h-8 w-px bg-warm-200 flex-shrink-0" />
        <div className="text-center">
          <div className="text-[10px] font-semibold tracking-widest uppercase text-warm-400 mb-0.5">Ocupació</div>
          <div className="text-warm-800 text-xl font-semibold leading-none">
            {ocupacio}% <span className="text-sm text-warm-400 font-normal">{totalComensals}/{capacitatTotal}</span>
          </div>
        </div>
      </div>

      <div className="h-8 w-px bg-warm-200 flex-shrink-0" />

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button className="flex items-center gap-1.5 border border-warm-200 hover:border-warm-300 rounded-lg px-3 py-1.5 text-xs text-warm-600 hover:text-warm-800 transition-colors">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filtres
        </button>
        <button className="border border-warm-200 hover:border-warm-300 rounded-lg p-1.5 text-warm-500 hover:text-warm-700 transition-colors">
          <LayoutGrid className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
