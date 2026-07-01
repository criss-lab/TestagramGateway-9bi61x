/**
 * Activity Stream View
 * Browse all ActivityPub activities stored in the `activities` table
 * with JSON detail, filtering, search, and per-activity actions
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity, RefreshCw, Search, Filter, ChevronDown, ChevronRight,
  CheckCircle, XCircle, Clock, ArrowDown, ArrowUp, Copy, Eye,
  Zap, Globe, AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn, timeAgo, truncate } from '@/lib/utils';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────
interface APActivity {
  id: string;
  activity_uri: string | null;
  activity_type: string;
  actor_uri: string;
  object_uri: string | null;
  object_data: Record<string, unknown>;
  target_uri: string | null;
  direction: 'inbound' | 'outbound';
  processed: boolean;
  raw_payload: Record<string, unknown>;
  signature_verified: boolean;
  created_at: string;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useActivities(filters: { type?: string; direction?: string; processed?: string; search: string }) {
  return useQuery({
    queryKey: ['activities', filters],
    queryFn: async () => {
      let q = supabase
        .from('activities')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (filters.type && filters.type !== 'all') q = q.eq('activity_type', filters.type);
      if (filters.direction && filters.direction !== 'all') q = q.eq('direction', filters.direction);
      if (filters.processed === 'true') q = q.eq('processed', true);
      if (filters.processed === 'false') q = q.eq('processed', false);
      const { data, error } = await q;
      if (error) throw error;
      let rows = data as APActivity[];
      if (filters.search) {
        const s = filters.search.toLowerCase();
        rows = rows.filter(
          (a) =>
            a.actor_uri?.toLowerCase().includes(s) ||
            a.activity_type?.toLowerCase().includes(s) ||
            a.object_uri?.toLowerCase().includes(s) ||
            JSON.stringify(a.raw_payload).toLowerCase().includes(s)
        );
      }
      return rows;
    },
    refetchInterval: 15_000,
  });
}

// ─── Activity type color map ──────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  Create:   'text-emerald-400 bg-emerald-400/10 border-emerald-400/25',
  Follow:   'text-cyan-400 bg-cyan-400/10 border-cyan-400/25',
  Like:     'text-pink-400 bg-pink-400/10 border-pink-400/25',
  Announce: 'text-amber-400 bg-amber-400/10 border-amber-400/25',
  Undo:     'text-orange-400 bg-orange-400/10 border-orange-400/25',
  Delete:   'text-red-400 bg-red-400/10 border-red-400/25',
  Accept:   'text-teal-400 bg-teal-400/10 border-teal-400/25',
  Reject:   'text-rose-400 bg-rose-400/10 border-rose-400/25',
  Update:   'text-blue-400 bg-blue-400/10 border-blue-400/25',
  Block:    'text-red-500 bg-red-500/10 border-red-500/25',
  Flag:     'text-yellow-400 bg-yellow-400/10 border-yellow-400/25',
  Move:     'text-violet-400 bg-violet-400/10 border-violet-400/25',
};

const ACTIVITY_TYPES = ['all', 'Create', 'Follow', 'Like', 'Announce', 'Undo', 'Delete', 'Accept', 'Reject', 'Update', 'Block'];

// ─── JSON Tree ────────────────────────────────────────────────────────────────
function JsonTree({ data, depth = 0 }: { data: unknown; depth?: number }) {
  const [open, setOpen] = useState(depth < 2);
  if (data === null || data === undefined) return <span className="text-muted-foreground/50">null</span>;
  if (typeof data === 'boolean') return <span className="text-amber-400">{String(data)}</span>;
  if (typeof data === 'number') return <span className="text-cyan-300">{data}</span>;
  if (typeof data === 'string') {
    if (data.startsWith('http')) return (
      <a href={data} target="_blank" rel="noopener noreferrer"
        className="text-primary hover:underline text-[11px] font-mono break-all">"{data}"</a>
    );
    return <span className="text-emerald-300 text-[11px] font-mono break-all">"{truncate(data, 120)}"</span>;
  }
  if (Array.isArray(data)) {
    if (!data.length) return <span className="text-muted-foreground/50">[]</span>;
    return (
      <span>
        <button onClick={() => setOpen((p) => !p)} className="text-muted-foreground hover:text-foreground">
          {open ? '▾' : '▸'} <span className="text-muted-foreground/50">[{data.length}]</span>
        </button>
        {open && (
          <div className="ml-4 space-y-1">
            {data.map((v, i) => (
              <div key={i}><span className="text-muted-foreground/40">{i}: </span><JsonTree data={v} depth={depth + 1} /></div>
            ))}
          </div>
        )}
      </span>
    );
  }
  if (typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>);
    if (!entries.length) return <span className="text-muted-foreground/50">{'{}'}</span>;
    return (
      <span>
        <button onClick={() => setOpen((p) => !p)} className="text-muted-foreground hover:text-foreground">
          {open ? '▾' : '▸'} <span className="text-muted-foreground/50">{`{${entries.length}}`}</span>
        </button>
        {open && (
          <div className="ml-4 space-y-1">
            {entries.map(([k, v]) => (
              <div key={k} className="flex gap-2 items-start">
                <span className="text-violet-300 flex-shrink-0 text-[11px] font-mono">"{k}":</span>
                <JsonTree data={v} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </span>
    );
  }
  return <span className="text-foreground text-[11px] font-mono">{String(data)}</span>;
}

// ─── Activity Row ─────────────────────────────────────────────────────────────
function ActivityRow({ activity }: { activity: APActivity }) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<'payload' | 'object'>('payload');
  const qc = useQueryClient();

  const markProcessed = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('activities')
        .update({ processed: true })
        .eq('id', activity.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Activity marked as processed');
      qc.invalidateQueries({ queryKey: ['activities'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const color = TYPE_COLORS[activity.activity_type] ?? 'text-muted-foreground bg-muted border-border';

  function extractDomain(uri: string) {
    try { return new URL(uri).hostname; } catch { return uri; }
  }

  return (
    <div className={cn('bg-card border rounded-lg overflow-hidden transition-all', expanded ? 'border-primary/20' : 'border-border hover:border-border/80')}>
      {/* Summary row */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/20 transition-colors">
        {/* Direction */}
        <div className="flex-shrink-0">
          {activity.direction === 'inbound'
            ? <ArrowDown className="w-3.5 h-3.5 text-cyan-400" />
            : <ArrowUp className="w-3.5 h-3.5 text-amber-400" />}
        </div>

        {/* Type badge */}
        <span className={cn('text-[11px] font-mono font-semibold px-2 py-0.5 rounded border flex-shrink-0', color)}>
          {activity.activity_type}
        </span>

        {/* Actor */}
        <span className="text-xs font-mono text-muted-foreground truncate flex-1">
          <span className="text-foreground">{extractDomain(activity.actor_uri)}</span>
          {activity.object_uri && <> → <span className="text-primary/70">{truncate(activity.object_uri, 50)}</span></>}
        </span>

        {/* Sig */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {activity.signature_verified
            ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            : <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
          <span className="text-[10px] font-mono text-muted-foreground/50 hidden sm:block">
            {activity.signature_verified ? 'sig ok' : 'unverified'}
          </span>
        </div>

        {/* Processed */}
        <div className="flex-shrink-0">
          {activity.processed
            ? <span className="text-[10px] font-mono text-emerald-400/60 bg-emerald-400/8 px-1.5 py-0.5 rounded">done</span>
            : <span className="text-[10px] font-mono text-amber-400/60 bg-amber-400/8 px-1.5 py-0.5 rounded">pending</span>}
        </div>

        {/* Time */}
        <span className="text-[10px] font-mono text-muted-foreground/50 flex-shrink-0">
          {timeAgo(activity.created_at)}
        </span>

        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border">
          {/* Meta row */}
          <div className="flex items-center gap-4 px-4 py-2 bg-muted/20 border-b border-border flex-wrap">
            <div className="text-[10px] font-mono text-muted-foreground">
              ID: <span className="text-foreground/70">{activity.id}</span>
            </div>
            {activity.activity_uri && (
              <div className="text-[10px] font-mono text-muted-foreground truncate max-w-xs">
                URI: <a href={activity.activity_uri} target="_blank" rel="noopener noreferrer"
                  className="text-primary hover:underline">{activity.activity_uri}</a>
              </div>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => { navigator.clipboard.writeText(JSON.stringify(activity.raw_payload, null, 2)); toast.success('Payload copied'); }}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono text-muted-foreground border border-border rounded hover:bg-muted/60">
                <Copy className="w-3 h-3" />Copy
              </button>
              {!activity.processed && (
                <button onClick={() => markProcessed.mutate()} disabled={markProcessed.isPending}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono text-emerald-400 border border-emerald-400/25 bg-emerald-400/8 rounded hover:bg-emerald-400/15">
                  {markProcessed.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}Mark Processed
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-4 pt-3">
            {(['payload', 'object'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={cn('px-3 py-1 text-[11px] font-mono rounded border transition-all',
                  tab === t ? 'bg-primary/10 text-primary border-primary/25' : 'text-muted-foreground border-border hover:bg-muted/60')}>
                {t === 'payload' ? 'Raw Payload' : 'Object Data'}
              </button>
            ))}
          </div>

          {/* JSON viewer */}
          <div className="px-4 py-3 overflow-auto max-h-72">
            <div className="text-[11px] font-mono leading-relaxed">
              <JsonTree data={tab === 'payload' ? activity.raw_payload : (activity.object_data ?? {})} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ActivityStream() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dirFilter, setDirFilter] = useState('all');
  const [processedFilter, setProcessedFilter] = useState('all');

  const { data: activities, isLoading, refetch } = useActivities({
    type: typeFilter,
    direction: dirFilter,
    processed: processedFilter === 'all' ? undefined : processedFilter,
    search,
  });

  const inbound = activities?.filter((a) => a.direction === 'inbound').length ?? 0;
  const outbound = activities?.filter((a) => a.direction === 'outbound').length ?? 0;
  const unprocessed = activities?.filter((a) => !a.processed).length ?? 0;

  return (
    <div className="max-w-5xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-xl">
        <Activity className="w-5 h-5 text-primary flex-shrink-0" />
        <div>
          <h1 className="text-sm font-semibold text-foreground">Activity Stream</h1>
          <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
            All ActivityPub activities (inbound + outbound) stored in the gateway
          </p>
        </div>
        <button onClick={() => refetch()}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-muted-foreground border border-border rounded hover:bg-muted/60 transition-colors">
          <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Activities', value: activities?.length ?? 0, color: 'text-foreground' },
          { label: 'Inbound', value: inbound, color: 'text-cyan-400', icon: ArrowDown },
          { label: 'Outbound', value: outbound, color: 'text-amber-400', icon: ArrowUp },
          { label: 'Unprocessed', value: unprocessed, color: unprocessed > 0 ? 'text-red-400' : 'text-emerald-400' },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl px-4 py-3">
            <div className="text-[10px] font-mono text-muted-foreground">{s.label}</div>
            <div className={cn('text-xl font-bold font-mono mt-1', s.color)}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search actor, type, URI…"
            className="pl-8 pr-3 py-1.5 bg-card border border-border rounded text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 w-56" />
        </div>

        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="px-2.5 py-1.5 bg-card border border-border rounded text-xs font-mono text-foreground focus:outline-none focus:border-primary/40">
          {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{t === 'all' ? 'All Types' : t}</option>)}
        </select>

        <select value={dirFilter} onChange={(e) => setDirFilter(e.target.value)}
          className="px-2.5 py-1.5 bg-card border border-border rounded text-xs font-mono text-foreground focus:outline-none focus:border-primary/40">
          <option value="all">All Directions</option>
          <option value="inbound">Inbound ↓</option>
          <option value="outbound">Outbound ↑</option>
        </select>

        <select value={processedFilter} onChange={(e) => setProcessedFilter(e.target.value)}
          className="px-2.5 py-1.5 bg-card border border-border rounded text-xs font-mono text-foreground focus:outline-none focus:border-primary/40">
          <option value="all">All Status</option>
          <option value="false">Unprocessed</option>
          <option value="true">Processed</option>
        </select>

        <span className="ml-auto text-[11px] font-mono text-muted-foreground/50">
          {activities?.length ?? 0} activities
        </span>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="bg-card border border-border rounded-xl p-16 flex items-center justify-center gap-2 text-muted-foreground text-sm font-mono">
          <RefreshCw className="w-4 h-4 animate-spin" />Loading activity stream…
        </div>
      ) : !activities?.length ? (
        <div className="bg-card border border-border rounded-xl p-16 text-center">
          <Activity className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-mono">No activities yet. Activities appear here when the gateway receives or sends AP events.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activities.map((a) => <ActivityRow key={a.id} activity={a} />)}
        </div>
      )}
    </div>
  );
}
