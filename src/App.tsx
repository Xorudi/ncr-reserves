import { BrowserRouter, Routes, Route } from 'react-router-dom';
import DesktopShell from '@/views/desktop/DesktopShell';
import MobileShell from '@/views/mobile/MobileShell';
import { useEffect, useState } from 'react';

function AppRouter() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/mobile/*" element={<MobileShell />} />
        <Route path="/*" element={isMobile ? <MobileShell /> : <DesktopShell />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return <AppRouter />;
}
