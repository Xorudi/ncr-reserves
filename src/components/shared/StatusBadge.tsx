import clsx from 'clsx';
import { ReservationStatus } from '@/types';

const STATUS_CONFIG: Record<ReservationStatus, { label: string; className: string; dot?: boolean }> = {
  'a-taula': { label: 'A taula', className: 'bg-brand text-white' },
  'confirmada': { label: 'Confirmada', className: 'text-status-confirmed', dot: true },
  'pendent': { label: 'Pendent', className: 'text-status-pending', dot: true },
  'cancel·lada': { label: 'Cancel·lada', className: 'text-warm-400', dot: true },
  'no-show': { label: 'No show', className: 'text-warm-400', dot: true },
};

export default function StatusBadge({ status }: { status: ReservationStatus }) {
  const config = STATUS_CONFIG[status];
  if (!config) return null;
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full',
      config.className,
      config.dot ? 'bg-transparent' : ''
    )}>
      {config.dot && <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />}
      {config.label}
    </span>
  );
}
