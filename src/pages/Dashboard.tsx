import { Globe, ArrowDownCircle, Send, RefreshCw, Activity, AlertTriangle, Zap, ShieldCheck, Server } from 'lucide-react';
import StatCard from '@/components/features/StatCard';
import ArchitectureDiagram from '@/components/features/ArchitectureDiagram';
import ActivityFeed from '@/components/features/ActivityFeed';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useActivityLogs } from '@/hooks/useActivityLogs';
import { useFederationInstances } from '@/hooks/useFederationInstances';
import { formatNumber, timeAgo } from '@/lib/utils';
import StatusBadge from '@/components/features/StatusBadge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

function useAPStats() {
  return useQuery({
    queryKey: ['ap_stats'],
    queryFn: async () => {
      const [actors, activities, objects, keys, blocked, wfCache] = await Promise.all([
        supabase.from('actors').select('*', { count: 'exact', head: true }),
        supabase.from('activities').select('*', { count: 'exact', head: true }),
        supabase.from('objects').select('*', { count: 'exact', head: true }),
        supabase.from('public_keys').select('*', { count: 'exact', head: true }),
        supabase.from('blocked_instances').select('*', { count: 'exact', head: true }),
        supabase.from('webfinger_cache').select('*', { count: 'exact', head: true }),
      ]);
      return {
        actors: actors.count ?? 0,
        activities: activities.count ?? 0,
        objects: objects.count ?? 0,
        publicKeys: keys.count ?? 0,
        blockedInstances: blocked.count ?? 0,
        webfingerCache: wfCache.count ?? 0,
      };
    },
    refetchInterval: 60_000,
  });
}

const ENDPOINTS = [
  { path: '/.well-known/webfinger', label: 'WebFinger', method: 'GET', color: 'text-cyan-400 bg-cyan-400/8 border-cyan-400/20' },
  { path: '/users/testagram', label: 'Actor API', method: 'GET', color: 'text-violet-400 bg-violet-400/8 border-violet-400/20' },
  { path: '/inbox', label: 'Shared Inbox', method: 'POST', color: 'text-emerald-400 bg-emerald-400/8 border-emerald-400/20' },
  { path: '/outbox', label: 'Outbox', method: 'GET', color: 'text-amber-400 bg-amber-400/8 border-amber-400/20' },
  { path: '/.well-known/nodeinfo', label: 'NodeInfo', method: 'GET', color: 'text-pink-400 bg-pink-400/8 border-pink-400/20' },
  { path: '/health', label: 'Health', method: 'GET', color: 'text-blue-400 bg-blue-400/8 border-blue-400/20' },
];

export default function Dashboard() {
  const { data: stats, isLoading } = useDashboardStats();
  const { data: apStats } = useAPStats();
  const { data: logs } = useActivityLogs(12);
  const { data: instances } = useFederationInstances();

  const activeInstances = instances?.filter((i) => i.status === 'active').length ?? 0;
  const unhealthyInstances = instances?.filter((i) => i.status !== 'active').length ?? 0;
  const totalAccounts = instances?.reduce((s, i) => s + i.account_count, 0) ?? 0;

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Health banner */}
      {unhealthyInstances > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-400/8 border border-amber-400/20 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-300">
            {unhealthyInstances} instance{unhealthyInstances > 1 ? 's are' : ' is'} unreachable or suspended —{' '}
            <a href="/instances" className="underline underline-offset-2 hover:text-amber-200 transition-colors">
              view Instances
            </a>
          </p>
        </div>
      )}

      {/* Federation stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Active Instances" value={isLoading ? '—' : `${activeInstances}/${instances?.length ?? 0}`}
          icon={Globe} color="cyan" description={`${formatNumber(totalAccounts)} total accounts`} />
        <StatCard label="AP Activities" value={isLoading ? '—' : formatNumber(apStats?.activities ?? 0)}
          icon={Activity} color="violet" description={`${apStats?.actors ?? 0} local actors`} />
        <StatCard label="AP Objects" value={isLoading ? '—' : formatNumber(apStats?.objects ?? 0)}
          icon={ArrowDownCircle} color="emerald" description={`${apStats?.publicKeys ?? 0} public keys cached`} />
        <StatCard label="Delivery Queue" value={isLoading ? '—' : formatNumber(stats?.queueTotal ?? 0)}
          icon={Send} color={stats?.queueFailed ? 'red' : 'amber'}
          badge={stats?.queueFailed ? `${stats.queueFailed} failed` : undefined}
          description={`${stats?.queuePending ?? 0} pending · ${stats?.queueFailed ?? 0} failed`} />
      </div>

      {/* AP Endpoint status bar */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-mono">AP Endpoints · testagram.site</span>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-mono text-emerald-400">all systems operational</span>
          </div>
        </div>
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
          {ENDPOINTS.map((ep) => (
            <div key={ep.path} className={`rounded-lg border px-2.5 py-2 ${ep.color}`}>
              <div className={`text-[10px] font-mono font-semibold ${ep.color.split(' ')[0]}`}>{ep.label}</div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[9px] font-mono text-muted-foreground/50 uppercase">{ep.method}</span>
              </div>
              <div className="text-[9px] font-mono text-muted-foreground/40 mt-0.5 truncate">{ep.path}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Architecture diagram */}
      <ArchitectureDiagram />

      {/* Bottom split */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Activity log */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Recent Federation Activity</h2>
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">{logs?.length ?? 0} events</span>
          </div>
          <ActivityFeed logs={logs ?? []} />
        </div>

        {/* Instance health panel */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Server className="w-3.5 h-3.5 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Instance Health</h2>
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">{instances?.length ?? 0} registered</span>
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="divide-y divide-border">
              {instances?.slice(0, 8).map((inst) => (
                <div key={inst.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono text-foreground truncate">{inst.domain}</div>
                    <div className="text-[10px] text-muted-foreground font-mono mt-0.5 flex items-center gap-1.5">
                      <span className="capitalize">{inst.software}</span>
                      <span className="opacity-30">·</span>
                      <span>{formatNumber(inst.account_count)} accts</span>
                      {inst.last_seen_at && (
                        <><span className="opacity-30">·</span><span>{timeAgo(inst.last_seen_at)}</span></>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={inst.status} pulse={inst.status === 'active'} />
                </div>
              ))}
              {!instances?.length && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground font-mono flex items-center justify-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading…
                </div>
              )}
            </div>
            {(instances?.length ?? 0) > 8 && (
              <div className="px-4 py-2 border-t border-border bg-muted/20">
                <a href="/instances" className="text-[11px] font-mono text-primary hover:underline">
                  View all {instances?.length} instances →
                </a>
              </div>
            )}
          </div>

          {/* AP micro-stats */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="bg-card border border-border rounded-lg px-3 py-2">
              <div className="text-[10px] text-muted-foreground font-mono">WebFinger Cache</div>
              <div className="text-sm font-bold font-mono text-cyan-300 mt-0.5">{apStats?.webfingerCache ?? '—'}</div>
            </div>
            <div className="bg-card border border-border rounded-lg px-3 py-2">
              <div className="text-[10px] text-muted-foreground font-mono">Blocked Instances</div>
              <div className="text-sm font-bold font-mono text-red-300 mt-0.5">{apStats?.blockedInstances ?? '—'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
