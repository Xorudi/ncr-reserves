/**
 * SyncBadge — small cloud-sync status indicator.
 * Shows a coloured dot + short text. Fades out 4 s after "synced".
 * Used in desktop header and mobile top-bar.
 */
import React, { useEffect, useState } from 'react';
import { getSyncStatus, onSyncStatus } from '@/lib/cloudSync';
import { supabase } from '@/lib/supabase';

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

const LABEL: Record<SyncStatus, string> = {
  idle:    '',
  syncing: 'Sincronitzant…',
  synced:  'Sincronitzat',
  offline: 'Sense connexió',
  error:   'Error de sync',
};

const DOT: Record<SyncStatus, string> = {
  idle:    'bg-gray-300',
  syncing: 'bg-blue-400 animate-pulse',
  synced:  'bg-green-400',
  offline: 'bg-yellow-400',
  error:   'bg-red-400',
};

export default function SyncBadge() {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus);
  const [visible, setVisible] = useState(false);

  // Cloud not configured → render nothing
  if (!supabase) return null;

  useEffect(() => {
    let hideTimer = 0;
    const off = onSyncStatus((s) => {
      setStatus(s);
      setVisible(s !== 'idle');
      // Auto-hide "synced" after 4 s
      window.clearTimeout(hideTimer);
      if (s === 'synced') {
        hideTimer = window.setTimeout(() => setVisible(false), 4000);
      }
    });
    return () => { off(); window.clearTimeout(hideTimer); };
  }, []);

  if (!visible || status === 'idle') return null;

  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/80
                    dark:bg-gray-800/80 shadow-sm text-xs text-gray-600 dark:text-gray-300
                    border border-gray-200 dark:border-gray-700 select-none">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${DOT[status]}`} />
      <span>{LABEL[status]}</span>
    </div>
  );
}
