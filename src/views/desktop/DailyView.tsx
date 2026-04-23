import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { SERVICE_BLOCKS } from '@/data/mockData';
import StatsBar from '@/components/desktop/StatsBar';
import ServiceBlock from '@/components/desktop/ServiceBlock';
import { addDays, getDayHeaderLabel, getDaySubLabel, isToday } from '@/utils/dateUtils';

export default function DailyView() {
  const { selectedBusiness, selectedDate, setSelectedDate, reservations, businesses } = useAppStore();

  const biz = businesses.find(b => b.id === selectedBusiness);
  const dayReservations = reservations.filter(
    r => r.businessId === selectedBusiness && r.date === selectedDate
  );

  const dayLabel = getDayHeaderLabel(selectedDate);
  const subLabel = getDaySubLabel(selectedDate);

  return (
    <div className="px-6 py-6">
      {/* Date header */}
      <div className="mb-5">
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => setSelectedDate(addDays(selectedDate, -1))}
            className="w-7 h-7 rounded-lg border border-warm-200 hover:border-warm-300 bg-white flex items-center justify-center text-warm-500 hover:text-warm-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div>
            <div className="flex items-baseline gap-2">
              {isToday(selectedDate) && (
                <span className="text-warm-400 text-sm font-medium">Avui ·</span>
              )}
              <h1 className="text-warm-800 text-2xl font-bold capitalize">{dayLabel.replace('Avui · ', '')}</h1>
              <span className="text-warm-500 text-xl">{subLabel}</span>
            </div>
            <div className="text-warm-400 text-xs mt-0.5">
              {biz?.name} · {biz?.address}
            </div>
          </div>

          <button
            onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            className="w-7 h-7 rounded-lg border border-warm-200 hover:border-warm-300 bg-white flex items-center justify-center text-warm-500 hover:text-warm-800 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <StatsBar reservations={dayReservations} />

      {/* Service blocks */}
      {SERVICE_BLOCKS.map(block => {
        const blockReservations = dayReservations.filter(r => r.serviceBlock === block.id);
        return (
          <ServiceBlock
            key={block.id}
            serviceBlock={block}
            reservations={blockReservations}
          />
        );
      })}

      {dayReservations.length === 0 && (
        <div className="bg-white rounded-xl border border-warm-200 shadow-card px-8 py-12 text-center">
          <div className="text-warm-400 text-sm">Sense reserves per aquest dia</div>
          <div className="text-warm-400 text-xs mt-1">Canvia la data o crea una nova reserva</div>
        </div>
      )}

      <div className="pb-8" />
    </div>
  );
}
