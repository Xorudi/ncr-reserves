import { Routes, Route, Navigate } from 'react-router-dom';
import LeftSidebar from '@/components/desktop/LeftSidebar';
import RightPanel from '@/components/desktop/RightPanel';
import DailyView from './DailyView';
import ReservationForm from './ReservationForm';
import ClientsView from './ClientsView';
import ClientDetail from './ClientDetail';

export default function DesktopShell() {
  return (
    <div className="flex h-screen bg-cream-100 overflow-hidden">
      <LeftSidebar />
      <main className="flex-1 overflow-y-auto min-w-0">
        <Routes>
          <Route path="/" element={<DailyView />} />
          <Route path="/reserves/nova" element={<ReservationForm />} />
          <Route path="/reserves/:id/editar" element={<ReservationForm />} />
          <Route path="/reserves" element={<DailyView />} />
          <Route path="/clients" element={<ClientsView />} />
          <Route path="/clients/:id" element={<ClientDetail />} />
          <Route path="/historial" element={<div className="p-8 text-warm-500 text-sm">Historial pròximament</div>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
      <RightPanel />
    </div>
  );
}
