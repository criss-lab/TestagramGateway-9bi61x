import { useState } from 'react';
import { Users, FileText, Heart, MessageCircle, Repeat2, RefreshCw, Search, ExternalLink, UserPlus, Globe } from 'lucide-react';
import { useRemoteAccounts } from '@/hooks/useRemoteAccounts';
import { useRemotePosts } from '@/hooks/useRemotePosts';
import { formatNumber, timeAgo, truncate, cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

type Tab = 'accounts' | 'posts';

const SOFTWARE_COLORS: Record<string, string> = {
  'mastodon.social':  'text-violet-400',
  'pixelfed.social':  'text-pink-400',
  'fosstodon.org':    'text-emerald-400',
  'chaos.social':     'text-orange-400',
  'peertube.social':  'text-amber-400',
};

export default function ImportFeed() {
  const [tab, setTab] = useState<Tab>('accounts');
  const [search, setSearch] = useState('');
  const [instanceFilter, setInstanceFilter] = useState('all');
  const [visFilter, setVisFilter] = useState('all');
  const [importing, setImporting] = useState(false);
  const [handleInput, setHandleInput] = useState('');
  const [showImportForm, setShowImportForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: accounts, isLoading: loadingAccounts } = useRemoteAccounts();
  const { data: posts, isLoading: loadingPosts } = useRemotePosts();

  // Unique instances for filter
  const instanceOptions = [...new Set((accounts ?? []).map((a) => a.instance_domain).filter(Boolean))] as string[];

  const filteredAccounts = (accounts ?? []).filter((a) => {
    const q = search.toLowerCase();
    const matchSearch = !q || a.handle.toLowerCase().includes(q) || (a.display_name ?? '').toLowerCase().includes(q);
    const matchInstance = instanceFilter === 'all' || a.instance_domain === instanceFilter;
    return matchSearch && matchInstance;
  });

  const filteredPosts = (posts ?? []).filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = !q || (p.content ?? '').toLowerCase().includes(q) || (p.remote_accounts?.handle ?? '').toLowerCase().includes(q);
    const matchVis = visFilter === 'all' || p.visibility === visFilter;
    return matchSearch && matchVis;
  });

  async function handleImportAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!handleInput.trim()) return;
    setImporting(true);

    // Parse @user@domain or user@domain
    const raw = handleInput.trim().replace(/^@/, '');
    const parts = raw.split('@');
    if (parts.length !== 2) {
      toast.error('Use the format @user@domain or user@domain');
      setImporting(false);
      return;
    }
    const [username, domain] = parts;
    const actorId = `https://${domain}/users/${username}`;
    const handle = `@${username}@${domain}`;

    // Ensure instance exists
    await supabase.from('federation_instances').upsert({ domain, status: 'active', inbox_url: `https://${domain}/inbox`, shared_inbox_url: `https://${domain}/inbox` }, { onConflict: 'domain', ignoreDuplicates: true });

    const { error } = await supabase.from('remote_accounts').upsert({
      actor_id: actorId, handle, instance_domain: domain,
      last_fetched_at: new Date().toISOString(),
    }, { onConflict: 'actor_id', ignoreDuplicates: true });

    if (error) { toast.error(error.message); setImporting(false); return; }

    await supabase.from('activity_logs').insert({
      event_type: 'account_imported', module: 'import',
      description: `Manually imported account: ${handle}`, status: 'success',
    });

    toast.success(`${handle} added to tracked accounts.`);
    queryClient.invalidateQueries({ queryKey: ['remote_accounts'] });
    queryClient.invalidateQueries({ queryKey: ['activity_logs'] });
    queryClient.invalidateQueries({ queryKey: ['federation_instances'] });
    setHandleInput('');
    setShowImportForm(false);
    setImporting(false);
  }

  async function handleRefreshAccount(accountId: string, handle: string) {
    const { error } = await supabase.from('remote_accounts')
      .update({ last_fetched_at: new Date().toISOString() })
      .eq('id', accountId);
    if (!error) {
      toast.success(`${handle} sync timestamp updated.`);
      queryClient.invalidateQueries({ queryKey: ['remote_accounts'] });
    }
  }

  return (
    <div className="max-w-6xl space-y-4">
      {/* Tabs + actions toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-muted/40 border border-border rounded-lg p-1">
          {(['accounts', 'posts'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all',
                tab === t ? 'bg-card text-foreground border border-border shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              {t === 'accounts' ? <Users className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
              <span className="capitalize">{t}</span>
              <span className="text-[10px] font-mono bg-muted px-1.5 rounded">
                {t === 'accounts' ? (accounts?.length ?? '…') : (posts?.length ?? '…')}
              </span>
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-48 max-w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === 'accounts' ? 'Search handle or name…' : 'Search content…'}
            className="w-full pl-8 pr-3 py-1.5 bg-card border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 font-mono" />
        </div>

        {tab === 'accounts' && instanceOptions.length > 0 && (
          <select value={instanceFilter} onChange={(e) => setInstanceFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-card border border-border rounded-md text-xs font-mono text-foreground focus:outline-none focus:border-primary/40">
            <option value="all">All instances</option>
            {instanceOptions.map((inst) => <option key={inst} value={inst}>{inst}</option>)}
          </select>
        )}

        {tab === 'posts' && (
          <select value={visFilter} onChange={(e) => setVisFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-card border border-border rounded-md text-xs font-mono text-foreground focus:outline-none focus:border-primary/40">
            <option value="all">All visibility</option>
            <option value="public">Public</option>
            <option value="unlisted">Unlisted</option>
            <option value="private">Private</option>
          </select>
        )}

        {tab === 'accounts' && (
          <button onClick={() => setShowImportForm((p) => !p)}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-violet-400/10 border border-violet-400/25 text-violet-400 text-xs rounded-md hover:bg-violet-400/20 transition-colors font-medium">
            <UserPlus className="w-3.5 h-3.5" />
            Track Account
          </button>
        )}
      </div>

      {/* Import account form */}
      {showImportForm && tab === 'accounts' && (
        <form onSubmit={handleImportAccount} className="bg-card border border-violet-400/20 rounded-lg p-4">
          <div className="text-xs font-semibold text-violet-400 mb-3 font-mono">Track Fediverse Account</div>
          <div className="flex items-center gap-3">
            <input required value={handleInput} onChange={(e) => setHandleInput(e.target.value)}
              placeholder="@alice@mastodon.social"
              className="flex-1 px-3 py-1.5 bg-background border border-border rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-violet-400/40 font-mono" />
            <button type="submit" disabled={importing}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-violet-400/15 border border-violet-400/30 text-violet-400 text-xs rounded font-semibold hover:bg-violet-400/25 transition-colors disabled:opacity-50">
              {importing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
              {importing ? 'Tracking…' : 'Track'}
            </button>
            <button type="button" onClick={() => setShowImportForm(false)}
              className="px-3 py-1.5 text-xs text-muted-foreground border border-border rounded hover:bg-muted/60 transition-colors">Cancel</button>
          </div>
          <p className="text-[11px] text-muted-foreground font-mono mt-2">Format: @username@instance.tld — e.g. @alice@mastodon.social</p>
        </form>
      )}

      {/* Accounts grid */}
      {tab === 'accounts' && (
        <div>
          {loadingAccounts ? (
            <div className="p-10 text-center text-sm text-muted-foreground font-mono flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground font-mono">No accounts match your search.</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredAccounts.map((acc) => (
                <div key={acc.id} className="bg-card border border-border rounded-lg p-4 hover:border-violet-400/20 transition-colors group">
                  <div className="flex items-start gap-3">
                    <img src={acc.avatar_url ?? `https://api.dicebear.com/7.x/identicon/svg?seed=${acc.handle}`}
                      alt={acc.display_name ?? acc.handle}
                      className="w-10 h-10 rounded-full bg-muted flex-shrink-0 object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-foreground truncate">{acc.display_name ?? acc.handle.split('@')[1]}</div>
                      <div className={cn('text-[11px] font-mono truncate', SOFTWARE_COLORS[acc.instance_domain ?? ''] ?? 'text-primary')}>
                        {acc.handle}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button onClick={() => handleRefreshAccount(acc.id, acc.handle)}
                        className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Mark synced">
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      <a href={`https://${acc.instance_domain}/@${acc.handle.split('@')[1]}`} target="_blank" rel="noopener noreferrer"
                        className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                  {acc.bio && (
                    <p className="text-xs text-muted-foreground mt-2.5 leading-relaxed line-clamp-2">{truncate(acc.bio, 120)}</p>
                  )}
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
                    <div className="text-center">
                      <div className="text-xs font-mono font-semibold text-foreground">{formatNumber(acc.followers_count)}</div>
                      <div className="text-[10px] text-muted-foreground">followers</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-mono font-semibold text-foreground">{formatNumber(acc.following_count)}</div>
                      <div className="text-[10px] text-muted-foreground">following</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-mono font-semibold text-foreground">{formatNumber(acc.posts_count)}</div>
                      <div className="text-[10px] text-muted-foreground">posts</div>
                    </div>
                    <div className="ml-auto flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
                      <Globe className="w-3 h-3" />
                      {acc.instance_domain ?? '—'}
                    </div>
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground/50 mt-1.5">
                    Synced {acc.last_fetched_at ? timeAgo(acc.last_fetched_at) : 'never'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Posts feed */}
      {tab === 'posts' && (
        <div className="bg-card border border-border rounded-lg divide-y divide-border overflow-hidden">
          {loadingPosts ? (
            <div className="p-10 text-center text-sm text-muted-foreground font-mono flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground font-mono">No posts match your search.</div>
          ) : (
            filteredPosts.map((post) => (
              <div key={post.id} className="p-4 hover:bg-muted/20 transition-colors group">
                <div className="flex items-center gap-2 mb-2.5">
                  <img src={post.remote_accounts?.avatar_url ?? `https://api.dicebear.com/7.x/identicon/svg?seed=${post.remote_accounts?.handle}`}
                    alt="" className="w-8 h-8 rounded-full bg-muted flex-shrink-0 object-cover" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-foreground">{post.remote_accounts?.display_name ?? 'Unknown'}</span>
                    <span className="text-[11px] font-mono text-muted-foreground ml-1.5">{post.remote_accounts?.handle}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border capitalize">
                      {post.visibility}
                    </span>
                    <span className="text-[11px] font-mono text-muted-foreground">{post.published_at ? timeAgo(post.published_at) : '—'}</span>
                    {post.url && (
                      <a href={post.url} target="_blank" rel="noopener noreferrer"
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
                <p className="text-sm text-foreground leading-relaxed">{post.content}</p>
                {post.in_reply_to && (
                  <div className="mt-2 text-[11px] font-mono text-muted-foreground">
                    ↩ Reply to <span className="text-primary">{truncate(post.in_reply_to, 60)}</span>
                  </div>
                )}
                <div className="flex items-center gap-5 mt-3">
                  <span className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
                    <Heart className="w-3.5 h-3.5" /> {formatNumber(post.likes_count)}
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
                    <MessageCircle className="w-3.5 h-3.5" /> {formatNumber(post.replies_count)}
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
                    <Repeat2 className="w-3.5 h-3.5" /> {formatNumber(post.reposts_count)}
                  </span>
                  <span className="ml-auto text-[10px] font-mono text-muted-foreground/40 uppercase">{post.content_type}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
