import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const GUEST_HANDLE = '@you@testagram.site';

export interface PostInteraction {
  id: string;
  user_id: string | null;
  post_id: string;
  action: 'like' | 'repost' | 'share' | 'reply';
  reply_content: string | null;
  created_at: string;
}

export interface AccountFollow {
  id: string;
  follower_handle: string;
  remote_account_id: string;
  status: 'following' | 'unfollowed' | 'pending';
  created_at: string;
}

// Fetch all interactions so we can show which posts the local user has liked/reposted
export function usePostInteractions() {
  return useQuery({
    queryKey: ['post_interactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('post_interactions')
        .select('*');
      if (error) throw error;
      return data as PostInteraction[];
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

// Fetch all account follows
export function useAccountFollows() {
  return useQuery({
    queryKey: ['account_follows'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('account_follows')
        .select('*');
      if (error) throw error;
      return data as AccountFollow[];
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

// Toggle like on a post
export function useLikePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, isLiked }: { postId: string; isLiked: boolean }) => {
      if (isLiked) {
        const { error } = await supabase
          .from('post_interactions')
          .delete()
          .eq('post_id', postId)
          .eq('action', 'like');
        if (error) throw error;
        // Decrement count
        await supabase.rpc('decrement_post_likes' as any, { post_id: postId }).catch(() => null);
        // Fallback: direct update
        const { data: post } = await supabase.from('remote_posts').select('likes_count').eq('id', postId).single();
        if (post) await supabase.from('remote_posts').update({ likes_count: Math.max(0, post.likes_count - 1) }).eq('id', postId);
      } else {
        const { error } = await supabase
          .from('post_interactions')
          .insert({ post_id: postId, action: 'like' });
        if (error && !error.message.includes('duplicate')) throw error;
        const { data: post } = await supabase.from('remote_posts').select('likes_count').eq('id', postId).single();
        if (post) await supabase.from('remote_posts').update({ likes_count: post.likes_count + 1 }).eq('id', postId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post_interactions'] });
      queryClient.invalidateQueries({ queryKey: ['remote_posts'] });
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// Toggle repost
export function useRepostPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, isReposted }: { postId: string; isReposted: boolean }) => {
      if (isReposted) {
        await supabase.from('post_interactions').delete().eq('post_id', postId).eq('action', 'repost');
        const { data: post } = await supabase.from('remote_posts').select('reposts_count').eq('id', postId).single();
        if (post) await supabase.from('remote_posts').update({ reposts_count: Math.max(0, post.reposts_count - 1) }).eq('id', postId);
      } else {
        const { error } = await supabase.from('post_interactions').insert({ post_id: postId, action: 'repost' });
        if (error && !error.message.includes('duplicate')) throw error;
        const { data: post } = await supabase.from('remote_posts').select('reposts_count').eq('id', postId).single();
        if (post) await supabase.from('remote_posts').update({ reposts_count: post.reposts_count + 1 }).eq('id', postId);
        // Queue AP Announce activity
        await supabase.from('delivery_queue').insert({
          activity_type: 'Announce',
          activity_data: { '@context': 'https://www.w3.org/ns/activitystreams', type: 'Announce', actor: `https://testagram.site/users/me`, object: postId },
          target_inbox: 'https://mastodon.social/inbox',
          target_domain: 'mastodon.social',
          status: 'pending',
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post_interactions'] });
      queryClient.invalidateQueries({ queryKey: ['remote_posts'] });
      queryClient.invalidateQueries({ queryKey: ['delivery_queue'] });
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// Reply to a post
export function useReplyPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, content, targetDomain }: { postId: string; content: string; targetDomain?: string }) => {
      await supabase.from('post_interactions').insert({ post_id: postId, action: 'reply', reply_content: content });
      // Increment reply count
      const { data: post } = await supabase.from('remote_posts').select('replies_count').eq('id', postId).single();
      if (post) await supabase.from('remote_posts').update({ replies_count: post.replies_count + 1 }).eq('id', postId);
      // Queue AP Create activity for the reply
      const domain = targetDomain ?? 'mastodon.social';
      await supabase.from('delivery_queue').insert({
        activity_type: 'Create',
        activity_data: {
          '@context': 'https://www.w3.org/ns/activitystreams',
          type: 'Create',
          actor: `https://testagram.site/users/me`,
          object: { type: 'Note', inReplyTo: postId, content, attributedTo: `https://testagram.site/users/me` },
        },
        target_inbox: `https://${domain}/inbox`,
        target_domain: domain,
        status: 'pending',
      });
      await supabase.from('activity_logs').insert({
        event_type: 'reply_sent', module: 'export',
        description: `Replied to post on ${domain}: "${content.slice(0, 60)}…"`,
        status: 'success',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post_interactions'] });
      queryClient.invalidateQueries({ queryKey: ['remote_posts'] });
      queryClient.invalidateQueries({ queryKey: ['delivery_queue'] });
      queryClient.invalidateQueries({ queryKey: ['activity_logs'] });
      toast.success('Reply queued for delivery via ActivityPub.');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// Follow/unfollow a remote account
export function useFollowAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ accountId, handle, domain, isFollowing }: { accountId: string; handle: string; domain: string; isFollowing: boolean }) => {
      if (isFollowing) {
        await supabase.from('account_follows')
          .update({ status: 'unfollowed' })
          .eq('remote_account_id', accountId)
          .eq('follower_handle', GUEST_HANDLE);
        // Queue AP Undo Follow
        await supabase.from('delivery_queue').insert({
          activity_type: 'Undo',
          activity_data: { '@context': 'https://www.w3.org/ns/activitystreams', type: 'Undo', actor: `https://testagram.site/users/me`, object: { type: 'Follow', object: `https://${domain}/users/${handle.split('@')[1]}` } },
          target_inbox: `https://${domain}/inbox`,
          target_domain: domain,
          status: 'pending',
        });
        toast.success(`Unfollowed ${handle}`);
      } else {
        await supabase.from('account_follows').upsert({
          follower_handle: GUEST_HANDLE,
          remote_account_id: accountId,
          status: 'following',
        }, { onConflict: 'follower_handle,remote_account_id' });
        // Queue AP Follow activity
        await supabase.from('delivery_queue').insert({
          activity_type: 'Follow',
          activity_data: { '@context': 'https://www.w3.org/ns/activitystreams', type: 'Follow', actor: `https://testagram.site/users/me`, object: `https://${domain}/users/${handle.split('@')[1]}` },
          target_inbox: `https://${domain}/inbox`,
          target_domain: domain,
          status: 'pending',
        });
        await supabase.from('activity_logs').insert({
          event_type: 'follow_sent', module: 'sync',
          description: `Sent Follow to ${handle} via ActivityPub`,
          status: 'success',
        });
        toast.success(`Following ${handle} — Follow activity queued.`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account_follows'] });
      queryClient.invalidateQueries({ queryKey: ['delivery_queue'] });
      queryClient.invalidateQueries({ queryKey: ['activity_logs'] });
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// Post a new Note to the Fediverse (queues Create activity)
export function usePostToFediverse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ content, targetDomains }: { content: string; targetDomains: string[] }) => {
      const domains = targetDomains.length ? targetDomains : ['mastodon.social', 'fosstodon.org'];
      // Insert all deliveries
      await Promise.all(domains.map((domain) =>
        supabase.from('delivery_queue').insert({
          activity_type: 'Create',
          activity_data: {
            '@context': 'https://www.w3.org/ns/activitystreams',
            type: 'Create',
            id: `https://testagram.site/activities/create/${Date.now()}`,
            actor: `https://testagram.site/users/me`,
            to: ['https://www.w3.org/ns/activitystreams#Public'],
            object: {
              type: 'Note',
              id: `https://testagram.site/posts/${Date.now()}`,
              attributedTo: `https://testagram.site/users/me`,
              content,
              published: new Date().toISOString(),
              to: ['https://www.w3.org/ns/activitystreams#Public'],
            },
          },
          target_inbox: `https://${domain}/inbox`,
          target_domain: domain,
          status: 'pending',
        })
      ));
      await supabase.from('activity_logs').insert({
        event_type: 'post_published', module: 'export',
        description: `Posted to Fediverse: "${content.slice(0, 80)}…" → ${domains.join(', ')}`,
        status: 'success',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery_queue'] });
      queryClient.invalidateQueries({ queryKey: ['activity_logs'] });
      toast.success('Post queued for delivery to the Fediverse!');
    },
    onError: (e: any) => toast.error(e.message),
  });
}
