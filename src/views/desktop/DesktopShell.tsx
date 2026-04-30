import React, { useState } from 'react';
import { LeftSidebar } from '@/components/desktop/LeftSidebar';
import { RightPanel } from '@/components/desktop/RightPanel';
import DailyView from './DailyView';
import ReservationForm from './ReservationForm';
import FloorPlanView from './FloorPlanView';
import WalkinView from './WalkinView';
import ClientsView from './ClientsView';
import StaffView from './StaffView';
import CalendarView from './CalendarView';
import SettingsView from './SettingsView';
import { ConfirmReservationModal, CancelReservationModal, WaitlistModal, BlockTableModal, MergeTablesModal } from '@/components/desktop/Modals';
import { useAppStore } from '@/store/useAppStore';
import { BUSINESSES, getStats } from '@/data/mockData';

export default function DesktopShell() {
  const {
    selectedBusiness, setSelectedBusiness,
    selectedReservation, setSelectedReservation,
    showWalkin, setShowWalkin,
    confirmModalRes, setConfirmModalRes,
    cancelModalRes, setCancelModalRes,
    showWaitlist, setShowWaitlist,
    blockModalTable, setBlockModalTable,
    mergeModalTable, setMergeModalTable,
  } = useAppStore();

  const [page, setPage] = useState<string>('today');
  const [showForm, setShowForm] = useState(false);

  const biz   = BUSINESSES.find(b => b.id === selectedBusiness)!;
  const stats = getStats(selectedBusiness);

  function handleNavigate(p: string) {
    setPage(p);
    setSelectedReservation(null);
    setShowForm(false);
    setShowWalkin(false);
  }

  function renderMain() {
    if (showWalkin)          return <WalkinView onClose={() => setShowWalkin(false)} />;
    if (showForm)            return <ReservationForm onClose={() => setShowForm(false)} />;
    if (page === 'floor')    return <FloorPlanView />;
    if (page === 'clients')  return <ClientsView />;
    if (page === 'staff')    return <StaffView />;
    if (page === 'calendar') return <CalendarView />;
    if (page === 'settings') return <SettingsView />;
    return <DailyView />;
  }

  const hideRightPanel = showWalkin || showForm
    || page === 'clients' || page === 'floor'
    || page === 'staff'
    || (page === 'calendar' && !selectedReservation)
    || page === 'settings';

  return (
    <div style={{ display:'flex', height:'100dvh', background:'var(--cream)', overflow:'hidden' }}>
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
      {!hideRightPanel && (
        <RightPanel
          biz={biz}
          selectedRes={selectedReservation}
          onClose={() => setSelectedReservation(null)}
        />
      )}

      {/* Modals */}
      <ConfirmReservationModal
        open={confirmModalRes !== null}
        res={confirmModalRes}
        onClose={() => setConfirmModalRes(null)}
        onConfirm={() => setConfirmModalRes(null)}
      />
      <CancelReservationModal
        open={cancelModalRes !== null}
        res={cancelModalRes}
        onClose={() => setCancelModalRes(null)}
        onConfirm={() => setCancelModalRes(null)}
      />
      <WaitlistModal
        open={showWaitlist}
        onClose={() => setShowWaitlist(false)}
      />
      <BlockTableModal
        open={blockModalTable !== null}
        table={blockModalTable}
        onClose={() => setBlockModalTable(null)}
        onConfirm={() => setBlockModalTable(null)}
      />
      <MergeTablesModal
        open={mergeModalTable !== null}
        primary={mergeModalTable}
        onClose={() => setMergeModalTable(null)}
        onConfirm={() => setMergeModalTable(null)}
      />
    </div>
  );
}
