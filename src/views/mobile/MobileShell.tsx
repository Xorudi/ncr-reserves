import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Home, Calendar, Users, Bell, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { BusinessId } from '@/types';
import TodayView from './TodayView';
import MobileReservationForm from './MobileReservationForm';
import MobileClientsView from './MobileClientsView';
import MobileClientDetail from './MobileClientDetail';
import { formatDateShort } from '@/utils/dateUtils';

function MobileAlertsView() {
  const { alerts, selectedBusiness, selectedDate } = useAppStore();
  const dayAlerts = alerts.filter(a => a.businessId === selectedBusiness && a.date === selectedDate);
  return (
    <div className="px-4 py-4">
      <h1 className="text-warm-800 text-xl font-bold mb-4">Alertes</h1>
      {dayAlerts.length === 0 ? (
        <p className="text-warm-400 text-sm">Sense alertes per avui</p>
      ) : (
        <div className="space-y-3">
          {dayAlerts.map(a => (
            <div key={a.id} className="bg-white rounded-xl border border-warm-200 shadow-card px-4 py-3">
              <div className="text-warm-800 text-sm font-semibold">{a.title}</div>
              <div className="text-warm-500 text-xs mt-1">{a.description}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MobileShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { businesses, selectedBusiness, setSelectedBusiness, selectedDate } = useAppStore();
  const [bizMenuOpen, setBizMenuOpen] = useState(false);

  const biz = businesses.find(b => b.id === selectedBusiness);

  const tabs = [
    { path: '/mobile/avui', label: 'Avui', icon: Home },
    { path: '/mobile/reserves', label: 'Reserves', icon: Calendar },
    { path: '/mobile/clients', label: 'Clients', icon: Users },
    { path: '/mobile/alertes', label: 'Alertes', icon: Bell },
  ];

  const isTabActive = (path: string) => {
    if (path === '/mobile/avui') return location.pathname === '/mobile' || location.pathname === '/mobile/avui';
    return location.pathname.startsWith(path);
  };

  const showBottomNav = !location.pathname.includes('/nova') && !location.pathname.includes('/editar');

  return (
    <div className="flex flex-col h-screen bg-cream-100 overflow-hidden">
      {/* Top header */}
      <header className="bg-white border-b border-warm-200 px-4 pt-safe-top flex items-center justify-between h-14 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-warm-800 flex items-center justify-center">
          <span className="text-white font-bold text-sm">N</span>
        </div>

        {/* Business switcher */}
        <button
          onClick={() => setBizMenuOpen(v => !v)}
          className="flex items-center gap-1.5 text-warm-800 font-semibold text-sm"
        >
          <div className={clsx('w-5 h-5 rounded text-white text-[10px] font-bold flex items-center justify-center', biz?.color)}>
            {biz?.initials}
          </div>
          {biz?.name}
          <ChevronDown className="w-3.5 h-3.5 text-warm-400" />
        </button>

        <div className="text-warm-500 text-xs">{formatDateShort(selectedDate)}</div>
      </header>

      {/* Business dropdown */}
      {bizMenuOpen && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setBizMenuOpen(false)} />
          <div className="absolute top-14 left-0 right-0 bg-white border-b border-warm-200 z-30 py-2">
            {businesses.map(b => (
              <button
                key={b.id}
                onClick={() => { setSelectedBusiness(b.id as BusinessId); setBizMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-warm-100 transition-colors"
              >
                <div className={clsx('w-7 h-7 rounded-lg text-white text-xs font-bold flex items-center justify-center', b.color)}>
                  {b.initials}
                </div>
                <div className="text-left">
                  <div className={clsx('text-sm font-semibold', selectedBusiness === b.id ? 'text-brand' : 'text-warm-800')}>
                    {b.name}
                  </div>
                  <div className="text-warm-400 text-xs">{b.type}</div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto min-w-0">
        <Routes>
          <Route path="/" element={<Navigate to="/mobile/avui" />} />
          <Route path="/avui" element={<TodayView />} />
          <Route path="/reserves" element={<TodayView />} />
          <Route path="/reserves/nova" element={<MobileReservationForm />} />
          <Route path="/clients" element={<MobileClientsView />} />
          <Route path="/clients/:id" element={<MobileClientDetail />} />
          <Route path="/alertes" element={<MobileAlertsView />} />
          <Route path="*" element={<Navigate to="/mobile/avui" />} />
        </Routes>
      </main>

      {/* Bottom navigation */}
      {showBottomNav && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-warm-200 flex pb-[env(safe-area-inset-bottom)] flex-shrink-0 z-10">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = isTabActive(tab.path);
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className="flex-1 flex flex-col items-center py-2.5 gap-0.5"
              >
                <Icon className={clsx('w-5 h-5', active ? 'text-brand' : 'text-warm-400')} />
                <span className={clsx('text-[10px] font-medium', active ? 'text-brand' : 'text-warm-400')}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Bottom nav spacer */}
      {showBottomNav && <div className="h-16 flex-shrink-0" />}
    </div>
  );
}
