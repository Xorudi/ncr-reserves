import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '@/store/useAppStore';
import { ClientTag } from '@/types';
import { formatVisitDate } from '@/utils/dateUtils';

const TAG_STYLES: Record<ClientTag, string> = {
  'vip': 'bg-amber-100 text-amber-700',
  'aniversari': 'bg-pink-100 text-pink-700',
  'al·lergia': 'bg-red-100 text-red-700',
  'habitual': 'bg-blue-100 text-blue-700',
  'conflictiu': 'bg-red-100 text-red-700',
};

const BUSINESS_NAMES: Record<string, string> = {
  'el-ganxo': 'El Ganxo',
  'la-pista': 'La Pista',
  'lesquitx': "L'Esquitx",
};

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

export default function MobileClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { clients } = useAppStore();

  const client = clients.find(c => c.id === id);

  if (!client) {
    return (
      <div className="px-4 py-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-warm-600 mb-4">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <p className="text-warm-400 text-center py-8">Client no trobat</p>
      </div>
    );
  }

  const sortedVisits = [...client.visitHistory].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="bg-white border-b border-warm-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-warm-600">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className={clsx(
          'w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0',
          nameColor(client.fullName)
        )}>
          {nameInitials(client.fullName)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-warm-800 font-semibold text-base truncate">{client.fullName}</div>
          <div className="text-warm-500 text-xs">{client.phone}</div>
        </div>
        <a href={`tel:${client.phone}`} className="w-9 h-9 rounded-full bg-warm-100 flex items-center justify-center flex-shrink-0">
          <Phone className="w-4 h-4 text-warm-600" />
        </a>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Tags */}
        {client.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {client.tags.map(tag => (
              <span key={tag} className={clsx('text-xs px-2.5 py-1 rounded-full font-medium', TAG_STYLES[tag])}>
                {tag.charAt(0).toUpperCase() + tag.slice(1)}
              </span>
            ))}
          </div>
        )}

        {/* Allergies */}
        {client.allergies.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-red-700 text-sm font-semibold mb-1">Al·lèrgies</div>
              <div className="text-red-600 text-sm">{client.allergies.join(', ')}</div>
            </div>
          </div>
        )}

        {/* Notes & Preferences */}
        {(client.importantNotes || client.preferences) && (
          <div className="bg-white rounded-xl border border-warm-200 shadow-card p-4 space-y-3">
            {client.importantNotes && (
              <div>
                <div className="text-[10px] font-semibold tracking-widest uppercase text-warm-400 mb-1">Notes importants</div>
                <p className="text-warm-700 text-sm leading-relaxed">{client.importantNotes}</p>
              </div>
            )}
            {client.preferences && (
              <div>
                <div className="text-[10px] font-semibold tracking-widest uppercase text-warm-400 mb-1">Preferències</div>
                <p className="text-warm-700 text-sm leading-relaxed">{client.preferences}</p>
              </div>
            )}
          </div>
        )}

        {/* Visit history */}
        <div className="bg-white rounded-xl border border-warm-200 shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-warm-100">
            <h2 className="text-warm-800 font-semibold text-sm">Historial de visites</h2>
          </div>
          {sortedVisits.length === 0 ? (
            <div className="px-4 py-6 text-center text-warm-400 text-sm">Sense visites registrades</div>
          ) : (
            <div className="divide-y divide-warm-100">
              {sortedVisits.map(visit => (
                <div key={visit.reservationId} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-warm-800 text-sm font-medium">{formatVisitDate(visit.date)}</span>
                    <span className="text-warm-500 text-xs">{visit.guestCount} pax</span>
                  </div>
                  <div className="text-warm-400 text-xs">{BUSINESS_NAMES[visit.businessId] || visit.businessId}</div>
                  {visit.notes && <div className="text-warm-500 text-xs mt-0.5">{visit.notes}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Internal comments */}
        {client.internalComments.length > 0 && (
          <div className="bg-white rounded-xl border border-warm-200 shadow-card overflow-hidden">
            <div className="px-4 py-3 border-b border-warm-100">
              <h2 className="text-warm-800 font-semibold text-sm">Comentaris interns</h2>
            </div>
            <div className="divide-y divide-warm-100">
              {client.internalComments.map(comment => (
                <div key={comment.id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-warm-800 text-xs font-semibold">{comment.authorName}</span>
                    <span className="text-warm-400 text-xs">{formatVisitDate(comment.date)}</span>
                  </div>
                  <p className="text-warm-600 text-sm leading-relaxed">{comment.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
