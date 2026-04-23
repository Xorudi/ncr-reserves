import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '@/store/useAppStore';
import { ReservationSource, ReservationStatus, ReservationTag } from '@/types';
import { formatDateChip } from '@/utils/dateUtils';

const TIME_SLOTS = ['13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '20:30', '21:00', '21:30', '22:00', '22:30'];
const GUEST_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12];
const SOURCES: { value: ReservationSource; label: string }[] = [
  { value: 'telefon', label: 'Telèfon' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'walk-in', label: 'Walk-in' },
  { value: 'web', label: 'Web' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'thefork', label: 'TheFork' },
];
const STATUSES: { value: ReservationStatus; label: string; dotClass: string }[] = [
  { value: 'pendent', label: 'Pendent', dotClass: 'bg-status-pending' },
  { value: 'confirmada', label: 'Confirmada', dotClass: 'bg-status-confirmed' },
  { value: 'a-taula', label: 'A taula', dotClass: 'bg-brand' },
];
const TAGS: { value: ReservationTag; label: string }[] = [
  { value: 'vip', label: 'VIP' },
  { value: 'aniversari', label: 'Aniversari' },
  { value: 'al·lergia', label: 'Al·lèrgia' },
  { value: 'habitual', label: 'Habitual' },
  { value: 'terrassa', label: 'Terrassa' },
];

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'rounded-full px-3 py-1.5 text-sm cursor-pointer transition-colors',
        selected
          ? 'bg-warm-800 text-white border border-warm-800'
          : 'border border-warm-200 bg-white text-warm-700 hover:border-warm-400'
      )}
    >
      {children}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold tracking-widest uppercase text-warm-400 mb-2">{children}</div>
  );
}

export default function ReservationForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { selectedBusiness, selectedDate, addReservation, reservations, businesses } = useAppStore();

  const existingReservation = id ? reservations.find(r => r.id === id) : undefined;
  const biz = businesses.find(b => b.id === selectedBusiness);

  const [date, setDate] = useState(existingReservation?.date ?? selectedDate);
  const [time, setTime] = useState(existingReservation?.time ?? '');
  const [guestCount, setGuestCount] = useState(existingReservation?.guestCount ?? 0);
  const [name, setName] = useState(existingReservation?.customerName ?? '');
  const [phone, setPhone] = useState(existingReservation?.phone ?? '');
  const [notes, setNotes] = useState(existingReservation?.notes ?? '');
  const [source, setSource] = useState<ReservationSource | ''>(existingReservation?.source ?? '');
  const [status, setStatus] = useState<ReservationStatus>(existingReservation?.status ?? 'pendent');
  const [tags, setTags] = useState<ReservationTag[]>(existingReservation?.tags ?? []);

  const isValid = name.trim().length > 0 && guestCount > 0;

  const toggleTag = (tag: ReservationTag) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleSubmit = () => {
    if (!isValid) return;
    const serviceBlock = time >= '19:00' ? 'nit' : 'migdia';
    addReservation({
      id: `r-${Date.now()}`,
      businessId: selectedBusiness,
      date,
      time: time || '13:00',
      serviceBlock,
      guestCount,
      customerName: name,
      phone: phone || undefined,
      notes,
      status,
      source: source || undefined,
      tags,
    });
    navigate('/');
  };

  return (
    <div className="min-h-full px-6 py-6">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-warm-500 hover:text-warm-800 text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Tornar
        </button>
        <div className="text-warm-400 text-xs font-medium tracking-wide uppercase">
          {id ? 'Editar reserva' : 'Nova reserva'} · {biz?.name}
        </div>
        <div className="text-warm-400 text-xs">
          Tab per avançar · ✓ per desar
        </div>
      </div>

      {/* Form card */}
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-panel border border-warm-200 p-8">
        <h1 className="text-warm-800 text-2xl font-bold mb-7">
          {id ? 'Editar reserva' : 'Crear reserva'}
        </h1>

        <div className="space-y-6">
          {/* Data */}
          <div>
            <SectionLabel>Data</SectionLabel>
            <button
              type="button"
              className="border border-warm-200 bg-white hover:border-warm-300 rounded-full px-4 py-2 text-sm text-warm-800 font-medium transition-colors"
            >
              {formatDateChip(date)}
            </button>
          </div>

          {/* Hora */}
          <div>
            <SectionLabel>Hora</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {TIME_SLOTS.map(t => (
                <Chip key={t} selected={time === t} onClick={() => setTime(t)}>
                  {t}
                </Chip>
              ))}
            </div>
          </div>

          {/* Comensals */}
          <div>
            <SectionLabel>Comensals</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {GUEST_COUNTS.map(n => (
                <Chip key={n} selected={guestCount === n} onClick={() => setGuestCount(n)}>
                  {n}
                </Chip>
              ))}
              <Chip selected={guestCount > 12} onClick={() => setGuestCount(15)}>Més...</Chip>
            </div>
          </div>

          {/* Nom */}
          <div>
            <SectionLabel>Nom</SectionLabel>
            <input
              type="text"
              placeholder="Cognoms, nom"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border border-warm-200 rounded-lg px-4 py-2.5 text-sm text-warm-800 placeholder:text-warm-400 focus:outline-none focus:border-warm-400 transition-colors"
            />
          </div>

          {/* Telèfon */}
          <div>
            <SectionLabel>Telèfon</SectionLabel>
            <input
              type="tel"
              placeholder="+34 6—"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full border border-warm-200 rounded-lg px-4 py-2.5 text-sm text-warm-800 placeholder:text-warm-400 focus:outline-none focus:border-warm-400 transition-colors"
            />
          </div>

          {/* Notes */}
          <div>
            <SectionLabel>Notes</SectionLabel>
            <textarea
              placeholder="Al·lèrgies, preferències, aniversaris, taula concreta..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="w-full border border-warm-200 rounded-lg px-4 py-2.5 text-sm text-warm-800 placeholder:text-warm-400 focus:outline-none focus:border-warm-400 transition-colors resize-none"
            />
          </div>

          {/* Origen */}
          <div>
            <SectionLabel>Origen</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {SOURCES.map(s => (
                <Chip key={s.value} selected={source === s.value} onClick={() => setSource(s.value)}>
                  {s.label}
                </Chip>
              ))}
            </div>
          </div>

          {/* Estat inicial */}
          <div>
            <SectionLabel>Estat inicial</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStatus(s.value)}
                  className={clsx(
                    'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm cursor-pointer transition-colors',
                    status === s.value
                      ? 'bg-warm-800 text-white border border-warm-800'
                      : 'border border-warm-200 bg-white text-warm-700 hover:border-warm-400'
                  )}
                >
                  <span className={clsx('w-1.5 h-1.5 rounded-full', s.dotClass)} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Etiquetes */}
          <div>
            <SectionLabel>Etiquetes</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {TAGS.map(tag => (
                <Chip key={tag.value} selected={tags.includes(tag.value)} onClick={() => toggleTag(tag.value)}>
                  {tag.label}
                </Chip>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-warm-100">
          <span className="text-warm-400 text-xs">
            {!isValid ? 'Completa nom i comensals' : 'Llest per desar'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 text-sm text-warm-600 hover:text-warm-800 transition-colors"
            >
              Cancel·lar
            </button>
            <button
              onClick={() => {}}
              className="px-4 py-2 text-sm border border-warm-200 rounded-lg text-warm-700 hover:border-warm-400 transition-colors"
            >
              Desar esborrany
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isValid}
              className={clsx(
                'flex items-center gap-1.5 px-5 py-2 text-sm font-medium rounded-lg transition-colors',
                isValid
                  ? 'bg-brand hover:bg-brand-dark text-white'
                  : 'bg-warm-200 text-warm-400 cursor-not-allowed'
              )}
            >
              <Check className="w-4 h-4" />
              {id ? 'Desar canvis' : 'Crear reserva'}
            </button>
          </div>
        </div>
      </div>

      <div className="pb-8" />
    </div>
  );
}
