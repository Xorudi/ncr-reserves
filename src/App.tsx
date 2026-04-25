import React, { useEffect, useState } from 'react';
import DesktopShell from '@/views/desktop/DesktopShell';
import MobileShell from '@/views/mobile/MobileShell';

function AppRouter() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return isMobile ? <MobileShell /> : <DesktopShell />;
}

export default function App() {
  return <AppRouter />;
}
