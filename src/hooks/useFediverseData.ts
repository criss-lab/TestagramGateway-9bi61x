import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export const useFediversePosts = () => {
  return useQuery({
    queryKey: ['fediverse-posts'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('posts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error('Error fetching posts:', error);
        return [];
      }
    },
  });
};

export const useFediverseInstances = () => {
  return useQuery({
    queryKey: ['fediverse-instances'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('instances')
          .select('*')
          .order('user_count', { ascending: false })
          .limit(50);

        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error('Error fetching instances:', error);
        return [];
      }
    },
  });
};

export const useFediverseUsers = () => {
  return useQuery({
    queryKey: ['fediverse-users'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .order('follower_count', { ascending: false })
          .limit(50);

        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error('Error fetching users:', error);
        return [];
      }
    },
  });
};

export const useTrendingHashtags = () => {
  return useQuery({
    queryKey: ['trending-hashtags'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('hashtags')
          .select('*')
          .order('post_count', { ascending: false })
          .limit(20);

        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error('Error fetching hashtags:', error);
        return [];
      }
    },
  });
};
