import { Zap, Clock, Star, MessageSquare, CalendarDays } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { AlertType } from '@/types';
import { formatTimeAgo } from '@/utils/dateUtils';

function AlertIcon({ type }: { type: AlertType }) {
  if (type === 'peak') return <Zap className="w-4 h-4 text-brand flex-shrink-0" />;
  if (type === 'pending') return <Clock className="w-4 h-4 text-status-pending flex-shrink-0" />;
  if (type === 'special') return <Star className="w-4 h-4 text-purple-500 flex-shrink-0" />;
  return <Zap className="w-4 h-4 text-warm-400 flex-shrink-0" />;
}

export default function RightPanel() {
  const { selectedBusiness, selectedDate, alerts, shiftNotes, events } = useAppStore();

  const dayAlerts = alerts.filter(a => a.businessId === selectedBusiness && a.date === selectedDate);
  const dayNotes = shiftNotes.filter(n => n.businessId === selectedBusiness && n.date === selectedDate);
  const upcomingEvents = events.filter(e => e.businessId === selectedBusiness && e.date >= selectedDate);

  return (
    <aside className="w-[280px] min-w-[280px] border-l border-warm-200 bg-cream-100 flex flex-col h-full overflow-y-auto py-5 px-4">
      {/* Header */}
      <div className="mb-4">
        <div className="text-[10px] font-semibold tracking-widest uppercase text-warm-400 mb-0.5">Context del dia</div>
        <div className="text-warm-800 font-semibold text-sm">Alertes i notes</div>
      </div>

      {/* Alertes */}
      <section className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-semibold tracking-widest uppercase text-warm-400">Alertes</span>
          {dayAlerts.length > 0 && (
            <span className="text-xs bg-brand/10 text-brand rounded-full px-1.5 py-0.5 font-medium">
              {dayAlerts.length}
            </span>
          )}
        </div>

        {dayAlerts.length === 0 ? (
          <p className="text-warm-400 text-xs px-1">Sense alertes per avui</p>
        ) : (
          <div className="bg-white rounded-xl border border-warm-200 shadow-card overflow-hidden">
            {dayAlerts.map((alert, idx) => (
              <div
                key={alert.id}
                className={`flex gap-3 px-3.5 py-3 ${idx < dayAlerts.length - 1 ? 'border-b border-warm-100' : ''}`}
              >
                <div className="mt-0.5">
                  <AlertIcon type={alert.type} />
                </div>
                <div className="min-w-0">
                  <div className="text-warm-800 text-xs font-semibold leading-snug">{alert.title}</div>
                  <div className="text-warm-500 text-xs leading-snug mt-0.5">{alert.description}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Notes del torn */}
      <section className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-semibold tracking-widest uppercase text-warm-400">Notes del torn</span>
          {dayNotes.length > 0 && (
            <span className="text-xs bg-warm-200 text-warm-600 rounded-full px-1.5 py-0.5 font-medium">
              {dayNotes.length}
            </span>
          )}
        </div>

        {dayNotes.length === 0 ? (
          <p className="text-warm-400 text-xs px-1">Sense notes per avui</p>
        ) : (
          <div className="space-y-2">
            {dayNotes.map((note) => (
              <div key={note.id} className="bg-white rounded-xl border border-warm-200 shadow-card px-3.5 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-warm-200 flex items-center justify-center">
                      <span className="text-warm-600 text-[9px] font-bold">{note.authorName[0]}</span>
                    </div>
                    <span className="text-warm-800 text-xs font-semibold">{note.authorName}</span>
                    <span className="text-warm-400 text-xs">· {note.authorRole}</span>
                  </div>
                  <span className="text-warm-400 text-xs">{formatTimeAgo(note.minutesAgo)}</span>
                </div>
                <p className="text-warm-600 text-xs leading-relaxed">{note.text}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Esdeveniments */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-semibold tracking-widest uppercase text-warm-400">Esdeveniments</span>
        </div>

        {upcomingEvents.length === 0 ? (
          <p className="text-warm-400 text-xs px-1">Sense esdeveniments propers</p>
        ) : (
          <div className="space-y-2">
            {upcomingEvents.map((event) => (
              <div key={event.id} className="bg-white rounded-xl border border-warm-200 shadow-card px-3.5 py-3 flex gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <CalendarDays className="w-4 h-4 text-warm-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-warm-400 text-[10px] font-semibold tracking-wider uppercase mb-0.5">{event.dayLabel}</div>
                  <div className="text-warm-800 text-xs font-semibold leading-snug">{event.title}</div>
                  <div className="text-warm-500 text-xs leading-snug mt-0.5">{event.description}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Add note button */}
      <div className="mt-auto pt-4">
        <button className="w-full border border-warm-200 hover:border-warm-300 bg-white rounded-lg px-3 py-2 text-xs text-warm-500 hover:text-warm-700 flex items-center gap-2 transition-colors">
          <MessageSquare className="w-3.5 h-3.5" />
          Afegir nota de torn
        </button>
      </div>
    </aside>
  );
}
