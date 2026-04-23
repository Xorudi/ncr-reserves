import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronRight, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '@/store/useAppStore';
import { ClientTag } from '@/types';
import { formatVisitDate } from '@/utils/dateUtils';

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

const TAG_FILTERS: { value: ClientTag | 'tots'; label: string }[] = [
  { value: 'tots', label: 'Tots' },
  { value: 'vip', label: 'VIP' },
  { value: 'al·lergia', label: 'Al·lèrgia' },
  { value: 'habitual', label: 'Habitual' },
  { value: 'aniversari', label: 'Aniversari' },
];

const TAG_STYLES: Record<ClientTag, string> = {
  'vip': 'bg-amber-100 text-amber-700',
  'aniversari': 'bg-pink-100 text-pink-700',
  'al·lergia': 'bg-red-100 text-red-700',
  'habitual': 'bg-blue-100 text-blue-700',
  'conflictiu': 'bg-red-100 text-red-700',
};

export default function ClientsView() {
  const navigate = useNavigate();
  const { clients } = useAppStore();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<ClientTag | 'tots'>('tots');

  const filtered = clients.filter(c => {
    const matchSearch = c.fullName.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search);
    const matchTag = activeFilter === 'tots' || c.tags.includes(activeFilter as ClientTag);
    return matchSearch && matchTag;
  });

  return (
    <div className="px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h1 className="text-warm-800 text-2xl font-bold">Clients</h1>
          <span className="text-xs bg-warm-200 text-warm-600 rounded-full px-2.5 py-1 font-medium">
            {clients.length}
          </span>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
          <input
            type="text"
            placeholder="Cerca per nom o telèfon..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white border border-warm-200 rounded-lg pl-9 pr-4 py-2 text-sm text-warm-800 placeholder:text-warm-400 focus:outline-none focus:border-warm-300"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {TAG_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setActiveFilter(f.value)}
              className={clsx(
                'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                activeFilter === f.value
                  ? 'bg-warm-800 text-white'
                  : 'border border-warm-200 bg-white text-warm-600 hover:border-warm-400'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-warm-200 shadow-card overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_140px_160px_120px_auto] gap-4 px-5 py-3 border-b border-warm-100">
          <div className="text-[10px] font-semibold tracking-widest uppercase text-warm-400">Client</div>
          <div className="text-[10px] font-semibold tracking-widest uppercase text-warm-400">Telèfon</div>
          <div className="text-[10px] font-semibold tracking-widest uppercase text-warm-400">Etiquetes</div>
          <div className="text-[10px] font-semibold tracking-widest uppercase text-warm-400">Última visita</div>
          <div className="w-6" />
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-warm-400 text-sm">
            Cap client trobat
          </div>
        ) : (
          filtered.map((client, idx) => {
            const lastVisit = client.visitHistory.sort((a, b) => b.date.localeCompare(a.date))[0];
            return (
              <div
                key={client.id}
                onClick={() => navigate(`/clients/${client.id}`)}
                className={clsx(
                  'grid grid-cols-[1fr_140px_160px_120px_auto] gap-4 px-5 py-3.5 items-center cursor-pointer hover:bg-warm-100/40 transition-colors',
                  idx < filtered.length - 1 && 'border-b border-warm-100'
                )}
              >
                {/* Name */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className={clsx(
                    'w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0',
                    nameColor(client.fullName)
                  )}>
                    {nameInitials(client.fullName)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-warm-800 text-sm font-semibold truncate">{client.fullName}</div>
                    {client.allergies.length > 0 && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <AlertTriangle className="w-3 h-3 text-red-500" />
                        <span className="text-red-600 text-xs">{client.allergies.join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Phone */}
                <div className="text-warm-500 text-sm truncate">{client.phone}</div>

                {/* Tags */}
                <div className="flex items-center gap-1 flex-wrap">
                  {client.tags.map(tag => (
                    <span key={tag} className={clsx('text-xs px-1.5 py-0.5 rounded font-medium', TAG_STYLES[tag])}>
                      {tag.charAt(0).toUpperCase() + tag.slice(1)}
                    </span>
                  ))}
                </div>

                {/* Last visit */}
                <div className="text-warm-500 text-sm">
                  {lastVisit ? formatVisitDate(lastVisit.date) : '—'}
                </div>

                {/* Arrow */}
                <ChevronRight className="w-4 h-4 text-warm-400" />
              </div>
            );
          })
        )}
      </div>

      <div className="pb-8" />
    </div>
  );
}
