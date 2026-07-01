import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { RemoteAccount } from '@/types/federation';

export function useRemoteAccounts() {
  return useQuery({
    queryKey: ['remote_accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('remote_accounts')
        .select('*')
        .order('followers_count', { ascending: false });
      if (error) throw error;
      return data as RemoteAccount[];
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
