import React from 'react';

export const I = {
  plus:     <path d="M12 5v14M5 12h14" />,
  search:   <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9z" /></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  users:    <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  phone:    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />,
  note:     <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></>,
  check:    <path d="M20 6 9 17l-5-5" />,
  chevL:    <path d="m15 18-6-6 6-6" />,
  chevR:    <path d="m9 18 6-6-6-6" />,
  chevD:    <path d="m6 9 6 6 6-6" />,
  x:        <path d="M18 6 6 18M6 6l12 12" />,
  filter:   <path d="M3 6h18M6 12h12M10 18h4" />,
  bell:     <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>,
  grid:     <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  list:     <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  tableIco: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></>,
  logs:     <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  flame:    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />,
  cake:     <><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" /><path d="M4 16s1.5-2 4-2 3.5 2 4 2 1.5-2 4-2 4 2 4 2M2 21h20M7 8v3M12 8v3M17 8v3" /></>,
  arrowR:   <path d="M5 12h14M12 5l7 7-7 7" />,
  home:     <><path d="M3 12l9-9 9 9" /><path d="M5 10v10a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1V10" /></>,
  sparkle:  <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.64 5.64l2.83 2.83M15.54 15.54l2.83 2.83M5.64 18.36l2.83-2.83M15.54 8.46l2.83-2.83" />,
  eye:      <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>,
  move:     <><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3" /><path d="M2 12h20M12 2v20" /></>,
  merge:    <><path d="M18 21V3M6 3v5a2 2 0 0 0 2 2h4a2 2 0 0 1 2 2v9" /><path d="M6 21l-3-3 3-3" /></>,
  lock:     <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  trash:    <><path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></>,
  pencil:   <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>,
  walkin:   <><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /></>,
  dotsH:    <><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></>,
  bolt:     <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></>,
  upload:   <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" /></>,
  history:  <><path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /></>,
  shield:   <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  refresh:  <><path d="M23 4v6h-6" /><path d="M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></>,
};

interface IconProps { d: React.ReactNode; size?: number; stroke?: number; fill?: string; }
export function Icon({ d, size = 16, stroke = 1.7, fill = 'none' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
         strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {typeof d === 'string' ? <path d={d} /> : d}
    </svg>
  );
}
