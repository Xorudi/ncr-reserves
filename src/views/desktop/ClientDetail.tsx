import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Phone, Send } from 'lucide-react';
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

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { clients, updateClient } = useAppStore();
  const [newComment, setNewComment] = useState('');

  const client = clients.find(c => c.id === id);

  if (!client) {
    return (
      <div className="px-6 py-6">
        <button onClick={() => navigate('/clients')} className="flex items-center gap-1.5 text-warm-500 hover:text-warm-800 text-sm mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Clients
        </button>
        <div className="bg-white rounded-xl border border-warm-200 shadow-card px-8 py-12 text-center">
          <p className="text-warm-500">Client no trobat</p>
        </div>
      </div>
    );
  }

  const sortedVisits = [...client.visitHistory].sort((a, b) => b.date.localeCompare(a.date));

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    const comment = {
      id: `cc-${Date.now()}`,
      text: newComment.trim(),
      authorName: 'Èlia Masdeu',
      date: new Date().toISOString().split('T')[0],
    };
    updateClient(client.id, {
      internalComments: [...client.internalComments, comment],
    });
    setNewComment('');
  };

  return (
    <div className="px-6 py-6">
      {/* Header */}
      <div className="mb-5">
        <button
          onClick={() => navigate('/clients')}
          className="flex items-center gap-1.5 text-warm-500 hover:text-warm-800 text-sm mb-3 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Clients
        </button>

        <div className="flex items-start gap-4">
          <div className={clsx(
            'w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0',
            nameColor(client.fullName)
          )}>
            {nameInitials(client.fullName)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-warm-800 text-2xl font-bold">{client.fullName}</h1>
              {client.tags.map(tag => (
                <span key={tag} className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', TAG_STYLES[tag])}>
                  {tag.charAt(0).toUpperCase() + tag.slice(1)}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Phone className="w-3.5 h-3.5 text-warm-400" />
              <span className="text-warm-500 text-sm">{client.phone}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Split layout */}
      <div className="flex gap-5">
        {/* Left: main info */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Perfil */}
          <div className="bg-white rounded-xl border border-warm-200 shadow-card p-5">
            <h2 className="text-warm-800 font-semibold text-sm mb-4">Perfil</h2>

            {client.allergies.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-red-700 text-sm font-semibold">Al·lèrgies</div>
                  <div className="text-red-600 text-sm">{client.allergies.join(', ')}</div>
                </div>
              </div>
            )}

            {client.importantNotes && (
              <div className="mb-4">
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

            {!client.importantNotes && !client.preferences && client.allergies.length === 0 && (
              <p className="text-warm-400 text-sm">Sense notes de perfil</p>
            )}
          </div>

          {/* Historial de visites */}
          <div className="bg-white rounded-xl border border-warm-200 shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-warm-100">
              <h2 className="text-warm-800 font-semibold text-sm">Historial de visites</h2>
            </div>
            {sortedVisits.length === 0 ? (
              <div className="px-5 py-8 text-center text-warm-400 text-sm">Sense visites registrades</div>
            ) : (
              <>
                <div className="grid grid-cols-[120px_1fr_60px_1fr] gap-4 px-5 py-2.5 bg-warm-100/50">
                  <span className="text-[10px] font-semibold tracking-widest uppercase text-warm-400">Data</span>
                  <span className="text-[10px] font-semibold tracking-widest uppercase text-warm-400">Local</span>
                  <span className="text-[10px] font-semibold tracking-widest uppercase text-warm-400">Pax</span>
                  <span className="text-[10px] font-semibold tracking-widest uppercase text-warm-400">Notes</span>
                </div>
                {sortedVisits.map((visit, idx) => (
                  <div
                    key={visit.reservationId}
                    className={clsx(
                      'grid grid-cols-[120px_1fr_60px_1fr] gap-4 px-5 py-3 items-center',
                      idx < sortedVisits.length - 1 && 'border-b border-warm-100'
                    )}
                  >
                    <span className="text-warm-700 text-sm">{formatVisitDate(visit.date)}</span>
                    <span className="text-warm-600 text-sm">{BUSINESS_NAMES[visit.businessId] || visit.businessId}</span>
                    <span className="text-warm-600 text-sm">{visit.guestCount}</span>
                    <span className="text-warm-500 text-sm">{visit.notes || '—'}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Right: comments */}
        <div className="w-72 flex-shrink-0">
          <div className="bg-white rounded-xl border border-warm-200 shadow-card overflow-hidden">
            <div className="px-4 py-4 border-b border-warm-100">
              <h2 className="text-warm-800 font-semibold text-sm">Comentaris interns</h2>
            </div>

            <div className="divide-y divide-warm-100">
              {client.internalComments.length === 0 ? (
                <div className="px-4 py-6 text-center text-warm-400 text-sm">
                  Sense comentaris
                </div>
              ) : (
                client.internalComments.map(comment => (
                  <div key={comment.id} className="px-4 py-3.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-warm-800 text-xs font-semibold">{comment.authorName}</span>
                      <span className="text-warm-400 text-xs">{formatVisitDate(comment.date)}</span>
                    </div>
                    <p className="text-warm-600 text-sm leading-relaxed">{comment.text}</p>
                  </div>
                ))
              )}
            </div>

            {/* Add comment */}
            <div className="px-4 py-3 border-t border-warm-100">
              <textarea
                placeholder="Afegir comentari intern..."
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                rows={2}
                className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 text-warm-800 placeholder:text-warm-400 focus:outline-none focus:border-warm-300 resize-none mb-2"
              />
              <button
                onClick={handleAddComment}
                disabled={!newComment.trim()}
                className={clsx(
                  'w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors',
                  newComment.trim()
                    ? 'bg-brand hover:bg-brand-dark text-white'
                    : 'bg-warm-100 text-warm-400 cursor-not-allowed'
                )}
              >
                <Send className="w-3.5 h-3.5" />
                Afegir
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="pb-8" />
    </div>
  );
}
