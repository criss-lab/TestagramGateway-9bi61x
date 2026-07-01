import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { DashboardStats } from '@/types/federation';

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard_stats'],
    queryFn: async () => {
      const [instances, accounts, posts, queueAll, queuePending, queueFailed] =
        await Promise.all([
          supabase.from('federation_instances').select('*', { count: 'exact', head: true }),
          supabase.from('remote_accounts').select('*', { count: 'exact', head: true }),
          supabase.from('remote_posts').select('*', { count: 'exact', head: true }),
          supabase.from('delivery_queue').select('*', { count: 'exact', head: true }),
          supabase
            .from('delivery_queue')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending'),
          supabase
            .from('delivery_queue')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'failed'),
        ]);

      return {
        instances: instances.count ?? 0,
        accounts: accounts.count ?? 0,
        posts: posts.count ?? 0,
        queueTotal: queueAll.count ?? 0,
        queuePending: queuePending.count ?? 0,
        queueFailed: queueFailed.count ?? 0,
      } as DashboardStats;
    },
  });
}
