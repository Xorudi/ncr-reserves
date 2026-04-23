import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, AlertTriangle, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '@/store/useAppStore';
import { ClientTag } from '@/types';

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

const TAG_STYLES: Record<ClientTag, string> = {
  'vip': 'bg-amber-100 text-amber-700',
  'aniversari': 'bg-pink-100 text-pink-700',
  'al·lergia': 'bg-red-100 text-red-700',
  'habitual': 'bg-blue-100 text-blue-700',
  'conflictiu': 'bg-red-100 text-red-700',
};

const FILTER_OPTIONS: { value: ClientTag | 'tots'; label: string }[] = [
  { value: 'tots', label: 'Tots' },
  { value: 'vip', label: 'VIP' },
  { value: 'al·lergia', label: 'Al·lèrgia' },
  { value: 'habitual', label: 'Habitual' },
];

export default function MobileClientsView() {
  const navigate = useNavigate();
  const { clients } = useAppStore();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<ClientTag | 'tots'>('tots');

  const filtered = clients.filter(c => {
    const matchSearch = c.fullName.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search);
    const matchTag = activeFilter === 'tots' || c.tags.includes(activeFilter as ClientTag);
    return matchSearch && matchTag;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Sticky search + filters */}
      <div className="sticky top-0 bg-cream-100 px-4 pt-4 pb-2 z-10">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
          <input
            type="text"
            placeholder="Cerca clients..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white border border-warm-200 rounded-xl pl-9 pr-4 py-2.5 text-sm text-warm-800 placeholder:text-warm-400 focus:outline-none focus:border-warm-300"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTER_OPTIONS.map(f => (
            <button
              key={f.value}
              onClick={() => setActiveFilter(f.value)}
              className={clsx(
                'flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                activeFilter === f.value
                  ? 'bg-warm-800 text-white'
                  : 'border border-warm-200 bg-white text-warm-600'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Client list */}
      <div className="flex-1 px-4 pb-4 space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-warm-200 px-4 py-10 text-center mt-4">
            <p className="text-warm-400 text-sm">Cap client trobat</p>
          </div>
        ) : (
          filtered.map(client => (
            <div
              key={client.id}
              onClick={() => navigate(`/mobile/clients/${client.id}`)}
              className="bg-white rounded-xl border border-warm-200 shadow-card px-4 py-3 flex items-center gap-3 cursor-pointer active:bg-warm-100/40 transition-colors"
            >
              <div className={clsx(
                'w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0',
                nameColor(client.fullName)
              )}>
                {nameInitials(client.fullName)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                  <span className="text-warm-800 text-sm font-semibold truncate">{client.fullName}</span>
                  {client.allergies.length > 0 && (
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-warm-400 text-xs">{client.phone}</span>
                  {client.tags.map(tag => (
                    <span key={tag} className={clsx('text-[10px] px-1.5 py-0.5 rounded font-medium', TAG_STYLES[tag])}>
                      {tag.charAt(0).toUpperCase() + tag.slice(1)}
                    </span>
                  ))}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-warm-400 flex-shrink-0" />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
