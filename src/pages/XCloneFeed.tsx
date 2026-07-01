import { useState, useMemo } from 'react';
import {
  Heart, MessageCircle, Repeat2, Share2, RefreshCw, X,
  Send, UserPlus, UserMinus, Hash, TrendingUp, ExternalLink, Globe,
} from 'lucide-react';
import { useRemotePosts } from '@/hooks/useRemotePosts';
import { useRemoteAccounts } from '@/hooks/useRemoteAccounts';
import {
  usePostInteractions, useAccountFollows,
  useLikePost, useRepostPost, useFollowAccount, usePostToFediverse, useReplyPost,
} from '@/hooks/usePostInteractions';
import { formatNumber, timeAgo, cn } from '@/lib/utils';
import type { RemotePost } from '@/types/federation';

function getInstanceDomain(handle: string): string {
  const parts = handle?.split('@');
  return parts?.length >= 3 ? parts[2] : parts?.[1] ?? '';
}

// Twitter-style post card
function TweetCard({ post, interactions, follows }: { post: RemotePost; interactions: any[]; follows: any[] }) {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const likeMut = useLikePost();
  const repostMut = useRepostPost();
  const followMut = useFollowAccount();
  const replyMut = useReplyPost();

  const domain = getInstanceDomain(post.remote_accounts?.handle ?? '');
  const isLiked = interactions.some((i) => i.post_id === post.id && i.action === 'like');
  const isReposted = interactions.some((i) => i.post_id === post.id && i.action === 'repost');
  const isFollowing = follows.some((f) => f.remote_account_id === post.remote_account_id && f.status === 'following');

  function handleShare() {
    if (post.url) navigator.clipboard.writeText(post.url);
    import('sonner').then(({ toast }) => toast.success('Copied!'));
  }

  function handleReplySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim()) return;
    replyMut.mutate({ postId: post.id, content: replyText, targetDomain: domain });
    setReplyText('');
    setShowReply(false);
  }

  return (
    <article className="border-b border-border px-4 py-3 hover:bg-muted/10 transition-colors group">
      <div className="flex gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <img
            src={post.remote_accounts?.avatar_url ?? `https://api.dicebear.com/7.x/identicon/svg?seed=${post.remote_accounts?.handle}`}
            alt=""
            className="w-10 h-10 rounded-full bg-muted object-cover"
          />
        </div>

        <div className="flex-1 min-w-0">
          {/* Name row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-sm text-foreground truncate">{post.remote_accounts?.display_name ?? 'Unknown'}</span>
            <span className="text-muted-foreground text-sm font-mono truncate">{post.remote_accounts?.handle}</span>
            <span className="text-muted-foreground text-sm">·</span>
            <span className="text-muted-foreground text-sm">{post.published_at ? timeAgo(post.published_at) : '—'}</span>
            {/* Follow btn */}
            <button
              onClick={() => followMut.mutate({ accountId: post.remote_account_id ?? '', handle: post.remote_accounts?.handle ?? '', domain, isFollowing })}
              className={cn(
                'ml-1 flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border transition-all opacity-0 group-hover:opacity-100',
                isFollowing
                  ? 'border-border text-muted-foreground hover:border-red-400/30 hover:text-red-400'
                  : 'border-primary text-primary hover:bg-primary/10'
              )}
            >
              {isFollowing ? <><UserMinus className="w-3 h-3" />Following</> : <><UserPlus className="w-3 h-3" />Follow</>}
            </button>
            {post.url && (
              <a href={post.url} target="_blank" rel="noopener noreferrer" className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          {/* Content */}
          <p className="text-sm text-foreground mt-1 leading-relaxed whitespace-pre-wrap">{post.content}</p>

          {/* Tags */}
          {Array.isArray(post.tags) && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {(post.tags as any[]).slice(0, 5).map((tag: any, i: number) => (
                <span key={i} className="text-primary text-sm hover:underline cursor-pointer">
                  #{typeof tag === 'string' ? tag : tag?.name ?? ''}
                </span>
              ))}
            </div>
          )}

          {/* Instance badge */}
          <div className="flex items-center gap-1.5 mt-1.5">
            <Globe className="w-3 h-3 text-muted-foreground/50" />
            <span className="text-[11px] font-mono text-muted-foreground/50">{domain}</span>
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-0 mt-2 -ml-2">
            {/* Reply */}
            <button
              onClick={() => setShowReply((p) => !p)}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-full text-sm text-muted-foreground hover:text-blue-400 hover:bg-blue-400/8 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="text-xs">{formatNumber(post.replies_count)}</span>
            </button>

            {/* Repost */}
            <button
              onClick={() => repostMut.mutate({ postId: post.id, isReposted })}
              disabled={repostMut.isPending}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1.5 rounded-full text-sm transition-colors',
                isReposted ? 'text-emerald-400' : 'text-muted-foreground hover:text-emerald-400 hover:bg-emerald-400/8'
              )}
            >
              <Repeat2 className="w-4 h-4" />
              <span className="text-xs">{formatNumber(post.reposts_count)}</span>
            </button>

            {/* Like */}
            <button
              onClick={() => likeMut.mutate({ postId: post.id, isLiked })}
              disabled={likeMut.isPending}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1.5 rounded-full text-sm transition-colors',
                isLiked ? 'text-pink-400' : 'text-muted-foreground hover:text-pink-400 hover:bg-pink-400/8'
              )}
            >
              <Heart className={cn('w-4 h-4', isLiked && 'fill-current')} />
              <span className="text-xs">{formatNumber(post.likes_count)}</span>
            </button>

            {/* Share */}
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-full text-sm text-muted-foreground hover:text-cyan-400 hover:bg-cyan-400/8 transition-colors"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>

          {/* Inline reply box */}
          {showReply && (
            <form onSubmit={handleReplySubmit} className="mt-2 flex items-start gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[10px] font-bold flex-shrink-0">me</div>
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Post your reply…"
                autoFocus
                className="flex-1 px-3 py-1.5 bg-background border border-border rounded-full text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40"
              />
              <button type="submit" disabled={!replyText.trim() || replyMut.isPending}
                className="px-3 py-1.5 bg-primary text-primary-foreground text-sm font-bold rounded-full hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {replyMut.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Reply'}
              </button>
              <button type="button" onClick={() => setShowReply(false)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
          )}
        </div>
      </div>
    </article>
  );
}

// Compose tweet panel
function ComposeBar() {
  const [content, setContent] = useState('');
  const postMut = usePostToFediverse();

  function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    postMut.mutate({ content, targetDomains: ['mastodon.social', 'fosstodon.org'] });
    setContent('');
  }

  return (
    <form onSubmit={handlePost} className="border-b border-border px-4 py-3">
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold flex-shrink-0">me</div>
        <div className="flex-1 space-y-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's happening on the Fediverse?"
            rows={2}
            maxLength={500}
            className="w-full resize-none bg-transparent text-foreground placeholder:text-muted-foreground text-base focus:outline-none"
          />
          <div className="flex items-center justify-between border-t border-border pt-2">
            <span className="text-sm text-muted-foreground font-mono">{content.length}/500</span>
            <button type="submit" disabled={!content.trim() || postMut.isPending}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground text-sm font-bold rounded-full hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {postMut.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <><Send className="w-3.5 h-3.5" />Post</>}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

type FeedTab = 'for-you' | 'following' | 'trending';

export default function XCloneFeed() {
  const { data: posts, isLoading, refetch, isFetching } = useRemotePosts();
  const { data: accounts } = useRemoteAccounts();
  const { data: interactions = [] } = usePostInteractions();
  const { data: follows = [] } = useAccountFollows();
  const [tab, setTab] = useState<FeedTab>('for-you');

  // Trending tags
  const trendingTags = useMemo(() => {
    const counts: Record<string, number> = {};
    (posts ?? []).forEach((p) => {
      if (!Array.isArray(p.tags)) return;
      (p.tags as any[]).forEach((tag: any) => {
        const name = typeof tag === 'string' ? tag : tag?.name;
        if (name) counts[name] = (counts[name] ?? 0) + 1;
      });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [posts]);

  const followedAccountIds = new Set(follows.filter((f) => f.status === 'following').map((f) => f.remote_account_id));

  const filteredPosts = useMemo(() => {
    if (!posts) return [];
    if (tab === 'following') return posts.filter((p) => followedAccountIds.has(p.remote_account_id ?? ''));
    if (tab === 'trending') return [...posts].sort((a, b) => (b.likes_count + b.reposts_count) - (a.likes_count + a.reposts_count));
    return posts;
  }, [posts, tab, follows]);

  // Who to follow suggestions (not already followed)
  const suggestions = accounts?.filter((a) => !followedAccountIds.has(a.id)).slice(0, 4) ?? [];
  const followMut = useFollowAccount();

  return (
    <div className="max-w-5xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 lg:gap-6">
        {/* Main feed */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden">
          {/* Header */}
          <div className="sticky top-0 bg-card/90 backdrop-blur-sm border-b border-border z-10">
            <div className="px-4 py-3 flex items-center justify-between">
              <h2 className="font-bold text-base text-foreground">Fediverse Feed</h2>
              <button onClick={() => refetch()} disabled={isFetching}
                className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
                <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
              </button>
            </div>
            {/* Tabs */}
            <div className="flex border-b border-border">
              {(['for-you', 'following', 'trending'] as FeedTab[]).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={cn(
                    'flex-1 py-3 text-sm font-medium transition-colors capitalize relative',
                    tab === t ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}>
                  {t.replace('-', ' ')}
                  {tab === t && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-primary rounded-full" />}
                </button>
              ))}
            </div>
          </div>

          {/* Compose */}
          <ComposeBar />

          {/* Posts */}
          {isLoading ? (
            <div className="p-16 flex items-center justify-center gap-2 text-muted-foreground text-sm font-mono">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="p-16 text-center text-sm text-muted-foreground font-mono">
              {tab === 'following' ? 'Follow some accounts to see their posts here.' : 'No posts available.'}
            </div>
          ) : (
            filteredPosts.map((post) => (
              <TweetCard key={post.id} post={post} interactions={interactions} follows={follows} />
            ))
          )}
        </div>

        {/* Right sidebar */}
        <div className="hidden lg:flex flex-col gap-4">
          {/* Trending */}
          {trendingTags.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-sm text-foreground">Trending</h3>
              </div>
              <div className="space-y-2">
                {trendingTags.map(([tag, count], i) => (
                  <div key={tag} className="flex items-center justify-between group cursor-pointer hover:bg-muted/30 px-2 py-1.5 rounded-lg transition-colors -mx-2">
                    <div>
                      <div className="text-[11px] text-muted-foreground font-mono">#{i + 1} · Fediverse</div>
                      <div className="text-sm font-bold text-foreground flex items-center gap-1">
                        <Hash className="w-3 h-3 text-primary" />{tag}
                      </div>
                      <div className="text-[11px] text-muted-foreground">{count} posts</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Who to follow */}
          {suggestions.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-bold text-sm text-foreground mb-3">Who to Follow</h3>
              <div className="space-y-3">
                {suggestions.map((acc) => (
                  <div key={acc.id} className="flex items-center gap-3">
                    <img src={acc.avatar_url ?? `https://api.dicebear.com/7.x/identicon/svg?seed=${acc.handle}`}
                      alt="" className="w-9 h-9 rounded-full bg-muted object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-foreground truncate">{acc.display_name ?? acc.handle.split('@')[1]}</div>
                      <div className="text-[11px] font-mono text-muted-foreground truncate">{acc.handle}</div>
                    </div>
                    <button
                      onClick={() => followMut.mutate({ accountId: acc.id, handle: acc.handle, domain: acc.instance_domain ?? '', isFollowing: false })}
                      disabled={followMut.isPending}
                      className="flex-shrink-0 px-3 py-1 bg-foreground text-background text-xs font-bold rounded-full hover:bg-foreground/80 transition-colors disabled:opacity-50"
                    >
                      Follow
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-1 text-[11px] font-mono text-muted-foreground/40 leading-relaxed">
            <p>Powered by ActivityPub · testagram.site</p>
            <p className="mt-1">Federation Gateway v1.0.0</p>
          </div>
        </div>
      </div>
    </div>
  );
}
