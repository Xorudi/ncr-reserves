import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
        'rounded-full px-3 py-2 text-sm cursor-pointer transition-colors',
        selected
          ? 'bg-warm-800 text-white border border-warm-800'
          : 'border border-warm-200 bg-white text-warm-700'
      )}
    >
      {children}
    </button>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-semibold tracking-widest uppercase text-warm-400 mb-2">{children}</div>;
}

export default function MobileReservationForm() {
  const navigate = useNavigate();
  const { selectedBusiness, selectedDate, addReservation } = useAppStore();

  const [time, setTime] = useState('');
  const [guestCount, setGuestCount] = useState(0);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [source, setSource] = useState<ReservationSource | ''>('');
  const [status, setStatus] = useState<ReservationStatus>('pendent');
  const [tags, setTags] = useState<ReservationTag[]>([]);

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
      date: selectedDate,
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
    navigate('/mobile/avui');
  };

  return (
    <div className="flex flex-col min-h-screen bg-cream-100">
      {/* Header */}
      <header className="bg-white border-b border-warm-200 px-4 h-14 flex items-center justify-between flex-shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-warm-600"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-warm-800 font-semibold text-base">Nova reserva</h1>
        <button
          onClick={handleSubmit}
          disabled={!isValid}
          className={clsx(
            'text-sm font-semibold',
            isValid ? 'text-brand' : 'text-warm-400'
          )}
        >
          Desar
        </button>
      </header>

      {/* Form content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 pb-24">
        {/* Data */}
        <div>
          <Label>Data</Label>
          <button className="border border-warm-200 bg-white rounded-full px-4 py-2 text-sm text-warm-800 font-medium">
            {formatDateChip(selectedDate)}
          </button>
        </div>

        {/* Hora */}
        <div>
          <Label>Hora</Label>
          <div className="flex flex-wrap gap-2">
            {TIME_SLOTS.map(t => (
              <Chip key={t} selected={time === t} onClick={() => setTime(t)}>{t}</Chip>
            ))}
          </div>
        </div>

        {/* Comensals */}
        <div>
          <Label>Comensals</Label>
          <div className="flex flex-wrap gap-2">
            {GUEST_COUNTS.map(n => (
              <Chip key={n} selected={guestCount === n} onClick={() => setGuestCount(n)}>{n}</Chip>
            ))}
          </div>
        </div>

        {/* Nom */}
        <div>
          <Label>Nom</Label>
          <input
            type="text"
            placeholder="Cognoms, nom"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border border-warm-200 rounded-lg px-4 py-3 text-sm text-warm-800 placeholder:text-warm-400 focus:outline-none focus:border-warm-400 bg-white"
          />
        </div>

        {/* Telèfon */}
        <div>
          <Label>Telèfon</Label>
          <input
            type="tel"
            placeholder="+34 6—"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="w-full border border-warm-200 rounded-lg px-4 py-3 text-sm text-warm-800 placeholder:text-warm-400 focus:outline-none focus:border-warm-400 bg-white"
          />
        </div>

        {/* Notes */}
        <div>
          <Label>Notes</Label>
          <textarea
            placeholder="Al·lèrgies, preferències, aniversaris, taula concreta..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            className="w-full border border-warm-200 rounded-lg px-4 py-3 text-sm text-warm-800 placeholder:text-warm-400 focus:outline-none focus:border-warm-400 bg-white resize-none"
          />
        </div>

        {/* Origen */}
        <div>
          <Label>Origen</Label>
          <div className="flex flex-wrap gap-2">
            {SOURCES.map(s => (
              <Chip key={s.value} selected={source === s.value} onClick={() => setSource(s.value)}>{s.label}</Chip>
            ))}
          </div>
        </div>

        {/* Etiquetes */}
        <div>
          <Label>Etiquetes</Label>
          <div className="flex flex-wrap gap-2">
            {TAGS.map(tag => (
              <Chip key={tag.value} selected={tags.includes(tag.value)} onClick={() => toggleTag(tag.value)}>
                {tag.label}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      {/* Submit button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-warm-200 px-4 py-3 pb-[env(safe-area-inset-bottom)]">
        <button
          onClick={handleSubmit}
          disabled={!isValid}
          className={clsx(
            'w-full h-13 py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors',
            isValid
              ? 'bg-brand hover:bg-brand-dark text-white'
              : 'bg-warm-200 text-warm-400 cursor-not-allowed'
          )}
        >
          <Check className="w-4 h-4" />
          Crear reserva
        </button>
      </div>
    </div>
  );
}
