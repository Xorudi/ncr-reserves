/**
 * Desktop CalendarView — thin wrapper over the canonical mobile CalendarScreen.
 *
 * Keeping a single calendar implementation (in views/mobile/CalendarScreen) is
 * the explicit decision from the app audit: the mobile version is the source
 * of truth, and the desktop just gets the same upgrade for free.
 */
import React from 'react';
import CalendarScreen from '@/views/mobile/CalendarScreen';

export default function CalendarView() {
  // On desktop, the back button is a no-op (sidebar is always visible).
  // Clicking a reservation simply sets selectedReservation in the store,
  // which causes DesktopShell to mount the RightPanel alongside the
  // calendar — no tab switching needed.
  return (
    <CalendarScreen
      onBack={() => { /* sidebar is always present */ }}
      onSwitchToReserves={() => { /* selectedReservation already set; RightPanel renders it */ }}
    />
  );
}
