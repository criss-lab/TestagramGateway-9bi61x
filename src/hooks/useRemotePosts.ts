import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { RemotePost } from '@/types/federation';

export function useRemotePosts(limit = 100) {
  return useQuery({
    queryKey: ['remote_posts', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('remote_posts')
        .select('*, remote_accounts(handle, display_name, avatar_url, instance_domain)')
        .order('published_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as RemotePost[];
    },
    // Auto-refresh every 60 seconds to pull in new posts
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
