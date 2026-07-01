import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { DeliveryQueueItem } from '@/types/federation';

export function useDeliveryQueue(statusFilter?: string) {
  return useQuery({
    queryKey: ['delivery_queue', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('delivery_queue')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as DeliveryQueueItem[];
    },
  });
}
