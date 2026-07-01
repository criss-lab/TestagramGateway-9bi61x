import { useState } from 'react';
import { RefreshCw, Users, Clock, CheckCircle2, Globe, Search, ExternalLink, RotateCcw } from 'lucide-react';
import ActivityFeed from '@/components/features/ActivityFeed';
import { useRemoteAccounts } from '@/hooks/useRemoteAccounts';
import { useActivityLogs } from '@/hooks/useActivityLogs';
import { formatNumber, timeAgo, cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function SyncStatus() {
  const { data: accounts, isLoading } = useRemoteAccounts();
  const { data: syncLogs } = useActivityLogs(20, 'sync');
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const recentlySynced = accounts?.filter(
    (a) => a.last_fetched_at && Date.now() - new Date(a.last_fetched_at).getTime() < 3_600_000
  ).length ?? 0;

  const pending = (accounts?.length ?? 0) - recentlySynced;

  const filteredAccounts = (accounts ?? []).filter((a) => {
    const q = search.toLowerCase();
    return !q || a.handle.toLowerCase().includes(q) || (a.display_name ?? '').toLowerCase().includes(q) || (a.instance_domain ?? '').toLowerCase().includes(q);
  });

  async function handleSync(accountId: string, handle: string) {
    setSyncingId(accountId);
    const { error } = await supabase.from('remote_accounts')
      .update({ last_fetched_at: new Date().toISOString() })
      .eq('id', accountId);

    if (!error) {
      await supabase.from('activity_logs').insert({
        event_type: 'account_synced', module: 'sync',
        description: `Manually triggered sync for ${handle}`, status: 'success',
      });
      toast.success(`${handle} sync timestamp updated.`);
      queryClient.invalidateQueries({ queryKey: ['remote_accounts'] });
      queryClient.invalidateQueries({ queryKey: ['activity_logs'] });
    } else {
      toast.error(error.message);
    }
    setSyncingId(null);
  }

  async function handleSyncAll() {
    const now = new Date().toISOString();
    const { error } = await supabase.from('remote_accounts').update({ last_fetched_at: now });
    if (!error) {
      await supabase.from('activity_logs').insert({
        event_type: 'bulk_sync', module: 'sync',
        description: `Bulk sync triggered for all ${accounts?.length ?? 0} tracked accounts`, status: 'success',
      });
      toast.success(`All ${accounts?.length ?? 0} accounts marked as synced.`);
      queryClient.invalidateQueries({ queryKey: ['remote_accounts'] });
      queryClient.invalidateQueries({ queryKey: ['activity_logs'] });
    } else {
      toast.error(error.message);
    }
  }

  return (
    <div className="max-w-6xl space-y-6">
      {/* Overview stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-400/10 flex items-center justify-center flex-shrink-0">
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-cyan-300">{formatNumber(accounts?.length ?? 0)}</div>
            <div className="text-xs text-muted-foreground">Tracked accounts</div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-400/10 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-emerald-300">{recentlySynced}</div>
            <div className="text-xs text-muted-foreground">Synced last hour</div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-400/10 flex items-center justify-center flex-shrink-0">
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-amber-300">{pending}</div>
            <div className="text-xs text-muted-foreground">Pending re-sync</div>
          </div>
        </div>
      </div>

      {/* Account sync table */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-sm font-semibold text-foreground">Account Sync State</h2>
          <div className="relative flex-1 max-w-60">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter accounts…"
              className="w-full pl-8 pr-3 py-1 bg-card border border-border rounded text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 font-mono" />
          </div>
          <button onClick={handleSyncAll}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-cyan-400/10 border border-cyan-400/25 text-cyan-400 text-xs rounded-md hover:bg-cyan-400/20 transition-colors font-medium">
            <RotateCcw className="w-3.5 h-3.5" />
            Sync All
          </button>
        </div>
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="p-10 text-center text-sm text-muted-foreground font-mono flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Account</th>
                    <th className="text-left px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Instance</th>
                    <th className="text-right px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Followers</th>
                    <th className="text-right px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Posts</th>
                    <th className="text-left px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Last Synced</th>
                    <th className="text-left px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Health</th>
                    <th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredAccounts.map((acc) => {
                    const age = acc.last_fetched_at ? Date.now() - new Date(acc.last_fetched_at).getTime() : Infinity;
                    const health = age < 3_600_000 ? 'fresh' : age < 86_400_000 ? 'stale' : 'outdated';
                    const healthColor = { fresh: 'text-emerald-400', stale: 'text-amber-400', outdated: 'text-red-400' }[health];
                    return (
                      <tr key={acc.id} className="hover:bg-muted/20 transition-colors group">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <img src={acc.avatar_url ?? `https://api.dicebear.com/7.x/identicon/svg?seed=${acc.handle}`}
                              alt="" className="w-7 h-7 rounded-full bg-muted flex-shrink-0 object-cover" />
                            <div>
                              <div className="text-xs font-semibold text-foreground">{acc.display_name ?? '—'}</div>
                              <div className="text-[11px] font-mono text-primary">{acc.handle}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Globe className="w-3 h-3 text-muted-foreground" />
                            <span className="font-mono text-xs text-muted-foreground">{acc.instance_domain ?? '—'}</span>
                            {acc.instance_domain && (
                              <a href={`https://${acc.instance_domain}`} target="_blank" rel="noopener noreferrer"
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary">
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">{formatNumber(acc.followers_count)}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">{formatNumber(acc.posts_count)}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {acc.last_fetched_at ? timeAgo(acc.last_fetched_at) : 'never'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('text-[11px] font-mono font-medium', healthColor)}>{health}</span>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => handleSync(acc.id, acc.handle)}
                            disabled={syncingId === acc.id}
                            className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono rounded border border-border text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/8 transition-colors disabled:opacity-50">
                            <RefreshCw className={cn('w-3 h-3', syncingId === acc.id && 'animate-spin')} />
                            Sync
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredAccounts.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground font-mono">
                        {search ? 'No accounts match your search.' : 'No accounts tracked yet.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Sync activity logs */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Sync Activity</h2>
        <ActivityFeed logs={syncLogs ?? []} />
      </div>
    </div>
  );
}
