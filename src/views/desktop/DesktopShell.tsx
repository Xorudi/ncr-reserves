import React, { useState } from 'react';
import { LeftSidebar } from '@/components/desktop/LeftSidebar';
import { RightPanel } from '@/components/desktop/RightPanel';
import DailyView from './DailyView';
import ReservationForm from './ReservationForm';
import FloorPlanView from './FloorPlanView';
import WalkinView from './WalkinView';
import ClientsView from './ClientsView';
import { useAppStore } from '@/store/useAppStore';
import { BUSINESSES, getStats } from '@/data/mockData';

export default function DesktopShell() {
  const {
    selectedBusiness, setSelectedBusiness,
    selectedReservation, setSelectedReservation,
    showWalkin, setShowWalkin,
  } = useAppStore();

  const [page, setPage] = useState<'today'|'floor'|'clients'|'history'>('today');
  const [showForm, setShowForm] = useState(false);

  const biz   = BUSINESSES.find(b => b.id === selectedBusiness)!;
  const stats = getStats(selectedBusiness);

  function handleNavigate(p: string) {
    setPage(p as any);
    setSelectedReservation(null);
    setShowForm(false);
    setShowWalkin(false);
  }

  function renderMain() {
    if (showWalkin)   return <WalkinView onClose={() => setShowWalkin(false)} />;
    if (showForm)     return <ReservationForm onClose={() => setShowForm(false)} />;
    if (page === 'floor')   return <FloorPlanView />;
    if (page === 'clients') return <ClientsView />;
    return <DailyView />;
  }

  return (
    <div style={{ display:'flex', height:'100vh', background:'var(--cream)', overflow:'hidden' }}>
      <LeftSidebar
        activeBizId={selectedBusiness}
        onChangeBiz={id => { setSelectedBusiness(id); setPage('today'); setShowForm(false); setShowWalkin(false); }}
        stats={stats}
        activePage={showWalkin ? 'today' : showForm ? 'today' : page}
        onNavigate={handleNavigate}
        onNewReservation={() => { setShowForm(true); setShowWalkin(false); setPage('today'); }}
        onWalkin={() => { setShowWalkin(true); setShowForm(false); setPage('today'); }}
      />

      <main style={{ flex:1, display:'flex', height:'100%', overflow:'hidden' }}>
        {renderMain()}
      </main>

      {/* Right panel — only on daily/today when not in walkin/form */}
      {!showWalkin && !showForm && page !== 'clients' && page !== 'floor' && (
        <RightPanel
          biz={biz}
          selectedRes={selectedReservation}
          onClose={() => setSelectedReservation(null)}
        />
      )}
    </div>
  );
}
