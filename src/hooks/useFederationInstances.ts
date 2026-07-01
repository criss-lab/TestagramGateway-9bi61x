import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { FederationInstance } from '@/types/federation';

export function useFederationInstances() {
  return useQuery({
    queryKey: ['federation_instances'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('federation_instances')
        .select('*')
        .order('account_count', { ascending: false });
      if (error) throw error;
      return data as FederationInstance[];
    },
    // Auto-refresh every 30 seconds
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });
}
