import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// Simulates background auto-import of new posts and cleanup
export function useAutoRefresh(intervalMs = 90_000) {
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function simulateImport() {
      // Fetch accounts that haven't been synced recently
      const { data: accounts } = await supabase
        .from('remote_accounts')
        .select('id, handle, instance_domain')
        .order('last_fetched_at', { ascending: true, nullsFirst: true })
        .limit(3);

      if (!accounts?.length) return;

      // Mark them as freshly fetched (simulates a background fetch)
      await supabase
        .from('remote_accounts')
        .update({ last_fetched_at: new Date().toISOString() })
        .in('id', accounts.map((a) => a.id));

      // Log the auto-refresh
      await supabase.from('activity_logs').insert({
        event_type: 'auto_import', module: 'import',
        description: `Auto-refreshed ${accounts.length} accounts: ${accounts.map((a) => a.handle).join(', ')}`,
        status: 'success',
      });

      // Trigger cleanup of old posts (only if needed)
      await supabase.rpc('cleanup_old_remote_posts' as any).catch(() => null);

      queryClient.invalidateQueries({ queryKey: ['remote_accounts'] });
      queryClient.invalidateQueries({ queryKey: ['activity_logs'] });
      queryClient.invalidateQueries({ queryKey: ['remote_posts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
    }

    timerRef.current = setInterval(simulateImport, intervalMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [intervalMs, queryClient]);
}
