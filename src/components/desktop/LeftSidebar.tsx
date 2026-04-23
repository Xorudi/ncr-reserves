import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Home, Calendar, LayoutGrid, Users, Clock, Settings, Plus } from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '@/store/useAppStore';
import { BusinessId } from '@/types';

export default function LeftSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { businesses, selectedBusiness, setSelectedBusiness } = useAppStore();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const selectedBiz = businesses.find(b => b.id === selectedBusiness);

  return (
    <aside className="w-[220px] min-w-[220px] flex flex-col h-full border-r border-warm-200 bg-cream-100 py-4 px-3">
      {/* Brand header */}
      <div className="flex items-center gap-2.5 px-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-warm-800 flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">N</span>
        </div>
        <div className="min-w-0">
          <div className="text-warm-800 font-semibold text-sm leading-tight">NCR Reserves</div>
          <div className="text-warm-400 text-xs leading-tight">Gestió interna</div>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative mb-4 px-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-warm-400" />
        <input
          type="text"
          placeholder="Cerca reserves..."
          className="w-full bg-white border border-warm-200 rounded-lg pl-8 pr-8 py-1.5 text-xs text-warm-600 placeholder:text-warm-400 focus:outline-none focus:border-warm-300"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-400 text-xs font-medium">⌘K</span>
      </div>

      {/* Businesses section */}
      <div className="px-2 mb-1">
        <span className="text-warm-400 text-[10px] font-semibold tracking-widest uppercase">Negocis</span>
      </div>
      <div className="mb-3 space-y-0.5">
        {businesses.map((biz) => (
          <button
            key={biz.id}
            onClick={() => setSelectedBusiness(biz.id as BusinessId)}
            className={clsx(
              'w-full rounded-lg px-2 py-2 flex items-center gap-2.5 cursor-pointer transition-colors text-left',
              selectedBusiness === biz.id ? 'bg-warm-100' : 'hover:bg-warm-100/60'
            )}
          >
            <div className={clsx('w-7 h-7 rounded-lg text-white text-xs font-bold flex items-center justify-center flex-shrink-0', biz.color)}>
              {biz.initials}
            </div>
            <span className={clsx('text-sm flex-1 min-w-0 truncate', selectedBusiness === biz.id ? 'text-warm-800 font-medium' : 'text-warm-600')}>
              {biz.name}
            </span>
            {biz.reservationCount > 0 && (
              <span className="text-xs bg-warm-200 text-warm-600 rounded-full px-1.5 py-0.5 font-medium flex-shrink-0">
                {biz.reservationCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Nova reserva button */}
      <div className="px-1 mb-4">
        <button
          onClick={() => navigate('/reserves/nova')}
          className="w-full bg-brand hover:bg-brand-dark text-white font-medium text-sm rounded-lg px-3 py-2 flex items-center justify-between transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            Nova reserva
          </span>
          <span className="text-white/60 text-xs font-normal">N</span>
        </button>
      </div>

      {/* Separator */}
      <div className="border-t border-warm-200 mx-1 mb-3" />

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-1">
        <button
          onClick={() => navigate('/')}
          className={clsx(
            'w-full rounded-lg px-3 py-2 text-sm flex items-center justify-between cursor-pointer transition-colors',
            isActive('/') && location.pathname === '/' ? 'bg-warm-100 text-warm-800 font-medium' : 'text-warm-600 hover:bg-warm-100/60 hover:text-warm-800'
          )}
        >
          <span className="flex items-center gap-2.5">
            <Home className="w-4 h-4" />
            Avui
          </span>
          {selectedBiz && selectedBiz.reservationCount > 0 && (
            <span className="text-xs bg-brand/10 text-brand rounded-full px-1.5 py-0.5 font-medium">
              {selectedBiz.reservationCount}
            </span>
          )}
        </button>

        <button
          onClick={() => navigate('/reserves')}
          className={clsx(
            'w-full rounded-lg px-3 py-2 text-sm flex items-center gap-2.5 cursor-pointer transition-colors',
            isActive('/reserves') ? 'bg-warm-100 text-warm-800 font-medium' : 'text-warm-600 hover:bg-warm-100/60 hover:text-warm-800'
          )}
        >
          <Calendar className="w-4 h-4" />
          Totes les reserves
        </button>

        <button
          className="w-full rounded-lg px-3 py-2 text-sm flex items-center justify-between cursor-pointer text-warm-600 hover:bg-warm-100/60 hover:text-warm-800 transition-colors"
        >
          <span className="flex items-center gap-2.5">
            <LayoutGrid className="w-4 h-4" />
            Plànol de taules
          </span>
          <span className="text-xs bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 font-medium">AVIAT</span>
        </button>

        <button
          onClick={() => navigate('/clients')}
          className={clsx(
            'w-full rounded-lg px-3 py-2 text-sm flex items-center gap-2.5 cursor-pointer transition-colors',
            isActive('/clients') ? 'bg-warm-100 text-warm-800 font-medium' : 'text-warm-600 hover:bg-warm-100/60 hover:text-warm-800'
          )}
        >
          <Users className="w-4 h-4" />
          Clients
        </button>

        <button
          onClick={() => navigate('/historial')}
          className={clsx(
            'w-full rounded-lg px-3 py-2 text-sm flex items-center gap-2.5 cursor-pointer transition-colors',
            isActive('/historial') ? 'bg-warm-100 text-warm-800 font-medium' : 'text-warm-600 hover:bg-warm-100/60 hover:text-warm-800'
          )}
        >
          <Clock className="w-4 h-4" />
          Historial
        </button>
      </nav>

      {/* User footer */}
      <div className="border-t border-warm-200 mx-1 pt-3 mt-2">
        <div className="flex items-center gap-2.5 px-2">
          <div className="w-8 h-8 rounded-full bg-warm-200 flex items-center justify-center flex-shrink-0">
            <span className="text-warm-700 text-xs font-semibold">EM</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-warm-800 text-xs font-semibold truncate">Èlia Masdeu</div>
            <div className="text-warm-400 text-[10px] truncate">Encarregada · torn migdia</div>
          </div>
          <button className="text-warm-400 hover:text-warm-600 transition-colors flex-shrink-0">
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
