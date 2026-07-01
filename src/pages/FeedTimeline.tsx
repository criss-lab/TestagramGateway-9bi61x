import { useState, useMemo } from 'react';
import {
  Heart, MessageCircle, Repeat2, RefreshCw, ExternalLink,
  Filter, Globe, TrendingUp, Share2, UserPlus, UserMinus,
  Hash, Send, X, Clock, Wifi, AlertCircle,
} from 'lucide-react';
import { useFederationInstances } from '@/hooks/useFederationInstances';
import {
  usePostInteractions, useAccountFollows,
  useLikePost, useRepostPost, useReplyPost, useFollowAccount, usePostToFediverse,
} from '@/hooks/usePostInteractions';
import { formatNumber, timeAgo, cn } from '@/lib/utils';
import StatusBadge from '@/components/features/StatusBadge';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface LivePost {
  id: string;
  uri: string;
  content: string;
  created_at: string;
  url: string | null;
  replies_count: number;
  reblogs_count: number;
  favourites_count: number;
  visibility: string;
  language: string | null;
  in_reply_to_id: string | null;
  reblog: LivePost | null;
  tags: Array<{ name: string; url: string }>;
  media_attachments: Array<{ type: string; url: string; preview_url: string }>;
  account: {
    id: string;
    username: string;
    acct: string;
    display_name: string;
    avatar: string;
    url: string;
    followers_count: number;
    statuses_count: number;
  };
}

type SortMode = 'recent' | 'popular' | 'replies';

const MASTODON_INSTANCES = [
  'mastodon.social', 'fosstodon.org', 'mastodon.online', 'infosec.exchange',
  'mstdn.social', 'chaos.social', 'techhub.social', 'indieweb.social',
];

const INSTANCE_COLORS: Record<string, string> = {
  'mastodon.social': 'text-violet-400 border-violet-400/20 bg-violet-400/10',
  'fosstodon.org':   'text-emerald-400 border-emerald-400/20 bg-emerald-400/10',
  'mastodon.online': 'text-indigo-400 border-indigo-400/20 bg-indigo-400/10',
  'infosec.exchange':'text-red-400 border-red-400/20 bg-red-400/10',
  'mstdn.social':    'text-blue-400 border-blue-400/20 bg-blue-400/10',
  'chaos.social':    'text-orange-400 border-orange-400/20 bg-orange-400/10',
  'techhub.social':  'text-cyan-400 border-cyan-400/20 bg-cyan-400/10',
  'indieweb.social': 'text-teal-400 border-teal-400/20 bg-teal-400/10',
};

// ─── Live fetch from Mastodon public API (no storage) ──────────────────────────
async function fetchPublicTimeline(domain: string, limit = 20): Promise<LivePost[]> {
  const res = await fetch(
    `https://${domain}/api/v1/timelines/public?limit=${limit}&local=false`,
    { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) throw new Error(`${domain}: HTTP ${res.status}`);
  return res.json();
}

// ─── ComposePanel ──────────────────────────────────────────────────────────────
function ComposePanel({ onClose }: { onClose: () => void }) {
  const [content, setContent] = useState('');
  const [domains, setDomains] = useState('mastodon.social,fosstodon.org');
  const postMut = usePostToFediverse();

  function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    postMut.mutate({
      content,
      targetDomains: domains.split(',').map((d) => d.trim()).filter(Boolean),
    });
    setContent('');
    onClose();
  }

  return (
    <form onSubmit={handlePost} className="bg-card border border-primary/25 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-primary">Post to Fediverse · testagram.site</span>
        <button type="button" onClick={onClose}><X className="w-4 h-4 text-muted-foreground hover:text-foreground" /></button>
      </div>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center font-mono text-primary text-xs font-bold flex-shrink-0">me</div>
        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} maxLength={500}
          placeholder="What's on your mind? (ActivityPub Note · Create activity)"
          className="flex-1 resize-none bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40" />
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="text-[11px] text-muted-foreground font-mono mb-1 block">Target instances</label>
          <input value={domains} onChange={(e) => setDomains(e.target.value)}
            className="w-full px-2.5 py-1 bg-background border border-border rounded text-xs font-mono text-foreground focus:outline-none focus:border-primary/40" />
        </div>
        <div className="text-[11px] font-mono text-muted-foreground self-end pb-1">{content.length}/500</div>
        <button type="submit" disabled={!content.trim() || postMut.isPending}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 self-end">
          {postMut.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}Post
        </button>
      </div>
    </form>
  );
}

// ─── Reply Modal ───────────────────────────────────────────────────────────────
function ReplyModal({ post, domain, onClose }: { post: LivePost; domain: string; onClose: () => void }) {
  const [content, setContent] = useState('');
  const replyMut = useReplyPost();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    replyMut.mutate({ postId: post.id, content, targetDomain: domain });
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl w-full max-w-lg p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Reply via ActivityPub</span>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="bg-muted/30 border border-border rounded-lg p-3 border-l-2 border-l-primary/40">
          <div className="text-[11px] font-mono text-primary mb-1">@{post.account.acct}</div>
          <p className="text-xs text-muted-foreground line-clamp-3" dangerouslySetInnerHTML={{ __html: post.content }} />
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} maxLength={500} autoFocus
            placeholder={`Replying to @${post.account.acct}…`}
            className="w-full resize-none bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-muted-foreground">Delivers to <span className="text-foreground">{domain}</span></span>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs border border-border rounded text-muted-foreground hover:bg-muted/60">Cancel</button>
              <button type="submit" disabled={!content.trim() || replyMut.isPending}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded hover:bg-primary/90 disabled:opacity-50">
                {replyMut.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}Reply
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Live Post Card ────────────────────────────────────────────────────────────
function LivePostCard({ post, domain, interactions, follows }: {
  post: LivePost; domain: string; interactions: any[]; follows: any[];
}) {
  const [showReply, setShowReply] = useState(false);
  const likeMut = useLikePost();
  const repostMut = useRepostPost();
  const followMut = useFollowAccount();

  const isLiked = interactions.some((i) => i.post_id === post.id && i.action === 'like');
  const isReposted = interactions.some((i) => i.post_id === post.id && i.action === 'repost');
  const isFollowing = follows.some((f) => f.remote_account_id === post.account.id && f.status === 'following');
  const instanceColor = INSTANCE_COLORS[domain] ?? 'text-cyan-400 border-cyan-400/20 bg-cyan-400/10';
  const engagement = post.favourites_count + post.replies_count + post.reblogs_count;
  const isTrending = engagement > 100;

  function handleShare() {
    if (post.url) {
      navigator.clipboard.writeText(post.url);
      import('sonner').then(({ toast }) => toast.success('Post URL copied!'));
    }
  }

  const plainContent = post.content.replace(/<[^>]+>/g, '').trim();

  return (
    <>
      <div className={cn(
        'bg-card border rounded-xl p-4 hover:border-primary/20 transition-all group',
        isLiked ? 'border-pink-400/20' : isReposted ? 'border-emerald-400/20' : 'border-border'
      )}>
        {post.reblog && (
          <div className="flex items-center gap-1.5 mb-2 text-[11px] font-mono text-emerald-400">
            <Repeat2 className="w-3 h-3" /><span>Boosted</span>
          </div>
        )}

        <div className="flex items-start gap-3">
          <div className="relative flex-shrink-0">
            <img src={post.account.avatar} alt="" className="w-10 h-10 rounded-full bg-muted object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="text-sm font-semibold text-foreground">{post.account.display_name || post.account.username}</span>
              <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded border', instanceColor)}>{domain}</span>
              <StatusBadge status={post.visibility} />
              {isTrending && <span className="text-[10px] font-mono text-amber-400 bg-amber-400/8 border border-amber-400/20 px-1.5 py-0.5 rounded">🔥 trending</span>}
              <div className="ml-auto flex items-center gap-1.5">
                <span className="text-[11px] font-mono text-muted-foreground">{timeAgo(post.created_at)}</span>
                {post.url && (
                  <a href={post.url} target="_blank" rel="noopener noreferrer"
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

            {/* Handle + follow */}
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-[11px] font-mono text-muted-foreground">@{post.account.acct}</span>
              <button
                onClick={() => followMut.mutate({
                  accountId: post.account.id,
                  handle: `@${post.account.acct}`,
                  domain,
                  isFollowing,
                })}
                disabled={followMut.isPending}
                className={cn(
                  'flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border transition-all opacity-0 group-hover:opacity-100',
                  isFollowing
                    ? 'text-muted-foreground border-border hover:text-red-400 hover:border-red-400/20'
                    : 'text-primary border-primary/20 bg-primary/8 hover:bg-primary/15'
                )}>
                {isFollowing ? <><UserMinus className="w-3 h-3" />Unfollow</> : <><UserPlus className="w-3 h-3" />Follow</>}
              </button>
            </div>

            {/* Content */}
            <div className="text-sm text-foreground leading-relaxed"
              dangerouslySetInnerHTML={{ __html: post.content }} />

            {/* Media */}
            {post.media_attachments?.length > 0 && (
              <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg overflow-hidden">
                {post.media_attachments.slice(0, 4).map((m, i) => (
                  m.type === 'image' ? (
                    <img key={i} src={m.preview_url} alt="" className="w-full h-28 object-cover bg-muted" />
                  ) : (
                    <div key={i} className="h-28 bg-muted/60 border border-border rounded flex items-center justify-center text-xs font-mono text-muted-foreground">{m.type}</div>
                  )
                ))}
              </div>
            )}

            {/* Tags */}
            {post.tags?.length > 0 && (
              <div className="mt-2 flex gap-1 flex-wrap">
                {post.tags.slice(0, 6).map((tag) => (
                  <span key={tag.name} className="flex items-center gap-0.5 text-[10px] font-mono text-primary/70 bg-primary/8 border border-primary/15 px-1.5 py-0.5 rounded">
                    <Hash className="w-2.5 h-2.5" />{tag.name}
                  </span>
                ))}
              </div>
            )}

            {/* Action bar */}
            <div className="flex items-center gap-1 mt-3 pt-2.5 border-t border-border/50">
              <button onClick={() => likeMut.mutate({ postId: post.id, isLiked })} disabled={likeMut.isPending}
                className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-mono transition-all border',
                  isLiked ? 'text-pink-400 bg-pink-400/10 border-pink-400/20' : 'text-muted-foreground hover:text-pink-400 hover:bg-pink-400/8 border-transparent')}>
                <Heart className={cn('w-3.5 h-3.5', isLiked && 'fill-current')} />
                {formatNumber(post.favourites_count)}
              </button>
              <button onClick={() => setShowReply(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-mono text-muted-foreground hover:text-violet-400 hover:bg-violet-400/8 border border-transparent transition-all">
                <MessageCircle className="w-3.5 h-3.5" />{formatNumber(post.replies_count)}
              </button>
              <button onClick={() => repostMut.mutate({ postId: post.id, isReposted })} disabled={repostMut.isPending}
                className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-mono border transition-all',
                  isReposted ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' : 'text-muted-foreground hover:text-emerald-400 hover:bg-emerald-400/8 border-transparent')}>
                <Repeat2 className="w-3.5 h-3.5" />{formatNumber(post.reblogs_count)}
              </button>
              <button onClick={handleShare}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-mono text-muted-foreground hover:text-cyan-400 hover:bg-cyan-400/8 border border-transparent transition-all">
                <Share2 className="w-3.5 h-3.5" />Share
              </button>
              <div className="ml-auto flex items-center gap-1.5">
                <Wifi className="w-3 h-3 text-emerald-400/50" />
                <span className="text-[9px] font-mono text-muted-foreground/30 uppercase">live · not stored</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {showReply && <ReplyModal post={post} domain={domain} onClose={() => setShowReply(false)} />}
    </>
  );
}

// ─── Main Timeline ─────────────────────────────────────────────────────────────
export default function FeedTimeline() {
  const { data: registeredInstances } = useFederationInstances();
  const { data: interactions = [] } = usePostInteractions();
  const { data: follows = [] } = useAccountFollows();

  const [selectedInstance, setSelectedInstance] = useState(MASTODON_INSTANCES[0]);
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [tagFilter, setTagFilter] = useState('');
  const [showCompose, setShowCompose] = useState(false);
  const [posts, setPosts] = useState<LivePost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<string | null>(null);

  const activeInstances = useMemo(() => {
    const registered = new Set(registeredInstances?.filter(i => i.status === 'active').map(i => i.domain) ?? []);
    return MASTODON_INSTANCES.filter(d => !registered.size || registered.has(d) || MASTODON_INSTANCES.includes(d));
  }, [registeredInstances]);

  async function loadPosts() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPublicTimeline(selectedInstance, 30);
      setPosts(data);
      setLastFetched(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load timeline');
    } finally {
      setLoading(false);
    }
  }

  // Auto-load when instance changes
  useMemo(() => { loadPosts(); }, [selectedInstance]);

  const trendingTags = useMemo(() => {
    const counts: Record<string, number> = {};
    posts.forEach((p) => p.tags?.forEach((t) => {
      counts[t.name] = (counts[t.name] ?? 0) + 1;
    }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([tag, count]) => ({ tag, count }));
  }, [posts]);

  const filtered = useMemo(() => {
    return posts
      .filter((p) => {
        if (tagFilter && !p.tags?.some((t) => t.name.toLowerCase() === tagFilter.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortMode === 'popular') return (b.favourites_count + b.reblogs_count) - (a.favourites_count + a.reblogs_count);
        if (sortMode === 'replies') return b.replies_count - a.replies_count;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [posts, tagFilter, sortMode]);

  const totalEngagement = posts.reduce((s, p) => s + p.favourites_count + p.replies_count + p.reblogs_count, 0);

  return (
    <div className="max-w-4xl space-y-4">
      {/* Live indicator */}
      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-400/5 border border-emerald-400/15 rounded-lg">
        <Wifi className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
        <span className="text-[11px] font-mono text-emerald-400">Live federation feed — content fetched directly, never stored · testagram.site</span>
        {lastFetched && <span className="ml-auto text-[10px] font-mono text-muted-foreground/50">fetched {lastFetched}</span>}
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl px-4 py-2.5 flex items-center gap-3">
          <Globe className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          <div>
            <div className="text-xs text-muted-foreground">Live Posts</div>
            <div className="text-sm font-bold font-mono text-cyan-300">{formatNumber(posts.length)}</div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl px-4 py-2.5 flex items-center gap-3">
          <TrendingUp className="w-4 h-4 text-violet-400 flex-shrink-0" />
          <div>
            <div className="text-xs text-muted-foreground">Engagement</div>
            <div className="text-sm font-bold font-mono text-violet-300">{formatNumber(totalEngagement)}</div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl px-4 py-2.5 flex items-center gap-3">
          <Clock className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <div>
            <div className="text-xs text-muted-foreground">Source</div>
            <div className="text-sm font-bold font-mono text-emerald-300 truncate">{selectedInstance}</div>
          </div>
        </div>
      </div>

      {/* Compose */}
      <button onClick={() => setShowCompose((p) => !p)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-xl text-muted-foreground hover:border-primary/30 hover:text-foreground transition-all text-sm">
        <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-bold font-mono flex-shrink-0">me</div>
        <span>Post an ActivityPub Note to the Fediverse…</span>
        <Send className="w-4 h-4 ml-auto text-primary" />
      </button>
      {showCompose && <ComposePanel onClose={() => setShowCompose(false)} />}

      {/* Trending */}
      {trendingTags.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-mono">Trending on {selectedInstance}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tagFilter && (
              <button onClick={() => setTagFilter('')}
                className="flex items-center gap-1 text-[11px] font-mono px-2 py-1 bg-red-400/10 border border-red-400/20 text-red-400 rounded hover:bg-red-400/20 transition-colors">
                <X className="w-3 h-3" />Clear
              </button>
            )}
            {trendingTags.map(({ tag, count }) => (
              <button key={tag} onClick={() => setTagFilter(tagFilter === tag ? '' : tag)}
                className={cn('flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 rounded border transition-all',
                  tagFilter === tag ? 'bg-primary/15 border-primary/30 text-primary' : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground')}>
                <Hash className="w-3 h-3" />{tag}
                <span className="text-[10px] opacity-60 ml-0.5">{count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <select value={selectedInstance} onChange={(e) => setSelectedInstance(e.target.value)}
          className="px-2.5 py-1.5 bg-card border border-border rounded-lg text-xs font-mono text-foreground focus:outline-none focus:border-primary/40">
          {MASTODON_INSTANCES.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <div className="flex items-center gap-1 ml-auto">
          {(['recent', 'popular', 'replies'] as SortMode[]).map((s) => (
            <button key={s} onClick={() => setSortMode(s)}
              className={cn('px-2.5 py-1 rounded-lg text-xs font-mono border transition-all capitalize',
                sortMode === s ? 'bg-primary/10 text-primary border-primary/25' : 'text-muted-foreground border-border hover:text-foreground hover:bg-muted/60')}>
              {s}
            </button>
          ))}
        </div>
        <button onClick={loadPosts} disabled={loading}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono text-muted-foreground border border-border rounded-lg hover:text-foreground hover:bg-muted/60 transition-colors">
          <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-400/8 border border-red-400/20 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300 font-mono">{error}</p>
          <button onClick={loadPosts} className="ml-auto text-xs font-mono text-red-400 hover:text-red-300 underline">Retry</button>
        </div>
      )}

      {/* Timeline */}
      {loading ? (
        <div className="bg-card border border-border rounded-xl p-16 flex items-center justify-center gap-2 text-muted-foreground text-sm font-mono">
          <RefreshCw className="w-4 h-4 animate-spin" />Fetching live posts from {selectedInstance}…
        </div>
      ) : filtered.length === 0 && !error ? (
        <div className="bg-card border border-border rounded-xl p-16 text-center text-sm text-muted-foreground font-mono">
          {tagFilter ? `No posts with #${tagFilter} from ${selectedInstance}` : 'No posts found. Try refreshing.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((post) => (
            <LivePostCard key={post.id} post={post} domain={selectedInstance} interactions={interactions} follows={follows} />
          ))}
        </div>
      )}
    </div>
  );
}
