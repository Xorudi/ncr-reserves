import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Users, Plus, X } from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '@/store/useAppStore';
import { SERVICE_BLOCKS } from '@/data/mockData';
import { Reservation } from '@/types';
import StatusBadge from '@/components/shared/StatusBadge';
import { addDays, getDayHeaderLabel, getDaySubLabel } from '@/utils/dateUtils';

function nameInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const TAG_LABELS: Record<string, string> = {
  'vip': 'VIP',
  'aniversari': 'Aniversari',
  'al·lergia': 'Al·lèrgia',
  'habitual': 'Habitual',
  'terrassa': 'Terrassa',
};

function ReservationCard({ reservation, onTap }: { reservation: Reservation; onTap: () => void }) {
  return (
    <div
      onClick={onTap}
      className="bg-white rounded-xl border border-warm-200 shadow-card px-4 py-3 cursor-pointer active:bg-warm-100/40 transition-colors"
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-warm-800 text-sm font-bold">{reservation.time}</span>
        <StatusBadge status={reservation.status} />
      </div>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-warm-800 text-sm font-semibold truncate">{reservation.customerName}</div>
          {reservation.notes && (
            <div className="text-warm-500 text-xs mt-0.5 truncate">{reservation.notes}</div>
          )}
          {reservation.tags.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {reservation.tags.map(tag => (
                <span key={tag} className="text-[10px] bg-warm-100 text-warm-600 rounded px-1.5 py-0.5">
                  {TAG_LABELS[tag] || tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 text-warm-500 flex-shrink-0">
          <Users className="w-3.5 h-3.5" />
          <span className="text-sm font-medium">{reservation.guestCount}</span>
        </div>
      </div>
    </div>
  );
}

function DetailSheet({ reservation, onClose }: { reservation: Reservation; onClose: () => void }) {
  const { updateReservation } = useAppStore();
  const navigate = useNavigate();

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-30" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-40 pb-[env(safe-area-inset-bottom)]">
        <div className="px-4 pt-3 pb-1 flex items-center justify-between">
          <div className="w-10 h-1 bg-warm-200 rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
          <div className="w-6" />
          <button onClick={onClose} className="ml-auto">
            <X className="w-5 h-5 text-warm-500" />
          </button>
        </div>
        <div className="px-4 pb-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-warm-800 text-lg font-bold">{reservation.customerName}</h2>
              <div className="text-warm-500 text-sm">{reservation.time} · {reservation.guestCount} pax</div>
              {reservation.phone && <div className="text-warm-500 text-sm">{reservation.phone}</div>}
            </div>
            <StatusBadge status={reservation.status} />
          </div>

          {reservation.notes && (
            <div className="bg-warm-100 rounded-lg px-3 py-2 mb-3">
              <p className="text-warm-700 text-sm">{reservation.notes}</p>
            </div>
          )}

          {reservation.tags.length > 0 && (
            <div className="flex gap-1.5 mb-4 flex-wrap">
              {reservation.tags.map(tag => (
                <span key={tag} className="text-xs bg-warm-100 text-warm-600 rounded-full px-2 py-0.5">
                  {TAG_LABELS[tag] || tag}
                </span>
              ))}
            </div>
          )}

          {/* Quick actions */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => { updateReservation(reservation.id, { status: 'confirmada' }); onClose(); }}
              className="flex-1 py-2 rounded-lg border border-status-confirmed text-status-confirmed text-sm font-medium"
            >
              Confirmar
            </button>
            <button
              onClick={() => { updateReservation(reservation.id, { status: 'a-taula' }); onClose(); }}
              className="flex-1 py-2 rounded-lg bg-brand text-white text-sm font-medium"
            >
              A taula
            </button>
            <button
              onClick={() => { updateReservation(reservation.id, { status: 'cancel·lada' }); onClose(); }}
              className="flex-1 py-2 rounded-lg border border-warm-200 text-warm-500 text-sm font-medium"
            >
              Cancel·lar
            </button>
          </div>

          <button
            onClick={() => navigate(`/reserves/${reservation.id}/editar`)}
            className="w-full py-2 rounded-lg border border-warm-200 text-warm-700 text-sm font-medium"
          >
            Editar reserva
          </button>
        </div>
      </div>
    </>
  );
}

export default function TodayView() {
  const navigate = useNavigate();
  const { selectedBusiness, selectedDate, setSelectedDate, reservations, alerts } = useAppStore();
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [alertDismissed, setAlertDismissed] = useState(false);

  const dayReservations = reservations.filter(
    r => r.businessId === selectedBusiness && r.date === selectedDate
  );
  const dayAlerts = alerts.filter(a => a.businessId === selectedBusiness && a.date === selectedDate);

  const totalComensals = dayReservations.reduce((s, r) => s + r.guestCount, 0);
  const pendents = dayReservations.filter(r => r.status === 'pendent').length;

  const dayLabel = getDayHeaderLabel(selectedDate);
  const subLabel = getDaySubLabel(selectedDate);

  return (
    <div className="px-4 py-4 pb-4">
      {/* Alert banner */}
      {!alertDismissed && dayAlerts.length > 0 && (
        <div className="bg-brand/10 border border-brand/20 rounded-xl px-3 py-2.5 mb-4 flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <span className="text-brand text-xs font-semibold">{dayAlerts.length} alerta{dayAlerts.length > 1 ? 'es' : ''} · </span>
            <span className="text-brand/80 text-xs">{dayAlerts[0].title}</span>
          </div>
          <button onClick={() => setAlertDismissed(true)} className="flex-shrink-0">
            <X className="w-4 h-4 text-brand/60" />
          </button>
        </div>
      )}

      {/* Date strip */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setSelectedDate(addDays(selectedDate, -1))}
          className="w-8 h-8 flex items-center justify-center text-warm-500"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <div className="text-warm-800 font-bold capitalize">{dayLabel.replace('Avui · ', '')}</div>
          <div className="text-warm-500 text-sm">{subLabel}</div>
        </div>
        <button
          onClick={() => setSelectedDate(addDays(selectedDate, 1))}
          className="w-8 h-8 flex items-center justify-center text-warm-500"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Stats row */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {[
          { label: 'Reserves', value: dayReservations.length },
          { label: 'Comensals', value: totalComensals },
          { label: 'Pendents', value: pendents },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl border border-warm-200 shadow-card px-3 py-2.5 flex-shrink-0 text-center min-w-[80px]">
            <div className="text-warm-800 text-lg font-bold leading-none">{stat.value}</div>
            <div className="text-warm-400 text-[10px] mt-0.5 font-medium uppercase tracking-wide">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Service blocks */}
      {SERVICE_BLOCKS.map(block => {
        const blockReservations = dayReservations
          .filter(r => r.serviceBlock === block.id)
          .sort((a, b) => a.time.localeCompare(b.time));

        if (blockReservations.length === 0) return null;

        return (
          <div key={block.id} className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-warm-800 text-sm font-semibold">{block.name}</span>
                <span className="text-warm-400 text-xs ml-2">{block.timeRange}</span>
              </div>
              <span className="text-xs text-warm-500">{blockReservations.length} reserves</span>
            </div>
            <div className="space-y-2">
              {blockReservations.map(r => (
                <ReservationCard
                  key={r.id}
                  reservation={r}
                  onTap={() => setSelectedReservation(r)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {dayReservations.length === 0 && (
        <div className="bg-white rounded-xl border border-warm-200 shadow-card px-4 py-10 text-center">
          <p className="text-warm-400 text-sm">Sense reserves per avui</p>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => navigate('/mobile/reserves/nova')}
        className="fixed bottom-20 right-4 w-14 h-14 bg-brand hover:bg-brand-dark text-white rounded-full shadow-panel flex items-center justify-center z-20 transition-colors"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Detail sheet */}
      {selectedReservation && (
        <DetailSheet
          reservation={selectedReservation}
          onClose={() => setSelectedReservation(null)}
        />
      )}
    </div>
  );
}
