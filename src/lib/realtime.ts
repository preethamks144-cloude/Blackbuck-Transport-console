import { useEffect, useState } from 'react';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type RealtimeStatus = 'connecting' | 'live' | 'reconnecting';

export type RealtimeTable = 'loads' | 'drivers' | 'trips' | 'invoices' | 'payments' | 'subscriptions' | 'notifications';

type ChangeHandler = (table: RealtimeTable) => void;

/**
 * Subscribes to Postgres change events for the app tables.
 * Returns whether the socket is currently synced, plus the latest change event
 * (table + timestamp) so pages can show a "just updated" pulse.
 * Reconnects automatically via the supabase-js channel state machine.
 */
export function useRealtime(onChange: ChangeHandler) {
  const [status, setStatus] = useState<RealtimeStatus>('connecting');
  const [lastEvent, setLastEvent] = useState<{ table: RealtimeTable; at: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const channels: RealtimeChannel[] = [];

    const tables: RealtimeTable[] = ['loads', 'drivers', 'trips', 'invoices', 'payments', 'subscriptions', 'notifications'];

    for (const table of tables) {
      const channel = supabase
        .channel(`realtime-${table}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
            if (cancelled) return;
            setLastEvent({ table, at: Date.now() });
            onChange(table);
          },
        )
        .subscribe((state) => {
          if (cancelled) return;
          if (state === 'SUBSCRIBED') setStatus('live');
          else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') setStatus('reconnecting');
          else if (state === 'CLOSED') setStatus('reconnecting');
        });
      channels.push(channel);
    }

    return () => {
      cancelled = true;
      for (const channel of channels) void supabase.removeChannel(channel);
    };
    // onChange must be stable (useCallback) to avoid resubscribing every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, lastEvent };
}
