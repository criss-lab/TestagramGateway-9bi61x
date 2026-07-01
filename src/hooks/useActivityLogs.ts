import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ActivityLog } from '@/types/federation';

export function useActivityLogs(limit = 20, moduleFilter?: string) {
  return useQuery({
    queryKey: ['activity_logs', limit, moduleFilter],
    queryFn: async () => {
      let query = supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (moduleFilter && moduleFilter !== 'all') {
        query = query.eq('module', moduleFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ActivityLog[];
    },
  });
}
