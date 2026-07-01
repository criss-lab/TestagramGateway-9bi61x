/**
 * NodeInfo Cache Browser
 * Browse and inspect cached NodeInfo records from federated instances
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Server, RefreshCw, Search, ExternalLink, Trash2, Download,
  CheckCircle, XCircle, Clock, Globe, Zap, Database,
  ChevronDown, ChevronRight, AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn, timeAgo, formatNumber } from '@/lib/utils';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────
interface NodeInfoRecord {
  id: string;
  domain: string;
  software_name: string | null;
  software_version: string | null;
  protocols: string[];
  open_registrations: boolean | null;
  user_count: number | null;
  post_count: number | null;
  raw_response: Record<string, unknown>;
  fetched_at: string;
  expires_at: string;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useNodeInfoCache(search: string) {
  return useQuery({
    queryKey: ['nodeinfo_cache', search],
    queryFn: async () => {
      let q = supabase
        .from('nodeinfo_cache')
        .select('*')
        .order('fetched_at', { ascending: false })
        .limit(200);
      const { data, error } = await q;
      if (error) throw error;
      let rows = data as NodeInfoRecord[];
      if (search) {
        const s = search.toLowerCase();
        rows = rows.filter(
          (r) =>
            r.domain.toLowerCase().includes(s) ||
            r.software_name?.toLowerCase().includes(s)
        );
      }
      return rows;
    },
    refetchInterval: 30_000,
  });
}

// ─── Software badge colors ────────────────────────────────────────────────────
const SW_COLORS: Record<string, string> = {
  mastodon:  'text-violet-400 bg-violet-400/10 border-violet-400/25',
  misskey:   'text-emerald-400 bg-emerald-400/10 border-emerald-400/25',
  pixelfed:  'text-pink-400 bg-pink-400/10 border-pink-400/25',
  peertube:  'text-orange-400 bg-orange-400/10 border-orange-400/25',
  pleroma:   'text-amber-400 bg-amber-400/10 border-amber-400/25',
  lemmy:     'text-red-400 bg-red-400/10 border-red-400/25',
  firefish:  'text-cyan-400 bg-cyan-400/10 border-cyan-400/25',
  kbin:      'text-blue-400 bg-blue-400/10 border-blue-400/25',
  bookwyrm:  'text-teal-400 bg-teal-400/10 border-teal-400/25',
  threads:   'text-indigo-400 bg-indigo-400/10 border-indigo-400/25',
};

function swColor(sw: string | null): string {
  return SW_COLORS[sw?.toLowerCase() ?? ''] ?? 'text-muted-foreground bg-muted border-border';
}

function isExpired(expires_at: string) {
  return new Date(expires_at) < new Date();
}

// ─── Refresh from network ─────────────────────────────────────────────────────
async function fetchNodeInfoForDomain(domain: string): Promise<NodeInfoRecord | null> {
  try {
    const wkRes = await fetch(`https://${domain}/.well-known/nodeinfo`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!wkRes.ok) return null;
    const wk = await wkRes.json();
    const link = (wk.links ?? []).find((l: any) => l.rel?.includes('nodeinfo'));
    if (!link?.href) return null;

    const niRes = await fetch(link.href, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!niRes.ok) return null;
    const ni = await niRes.json();

    return {
      id: crypto.randomUUID(),
      domain,
      software_name: ni.software?.name ?? null,
      software_version: ni.software?.version ?? null,
      protocols: ni.protocols ?? [],
      open_registrations: ni.openRegistrations ?? null,
      user_count: ni.usage?.users?.total ?? null,
      post_count: ni.usage?.localPosts ?? null,
      raw_response: ni,
      fetched_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
    };
  } catch {
    return null;
  }
}

// ─── Row component ────────────────────────────────────────────────────────────
function NodeInfoRow({ record, onDelete }: { record: NodeInfoRecord; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const expired = isExpired(record.expires_at);

  return (
    <div className={cn('bg-card border rounded-lg overflow-hidden', expired ? 'border-amber-400/20' : 'border-border')}>
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/20 transition-colors">

        {/* Domain */}
        <Globe className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <span className="text-xs font-mono text-foreground font-medium w-44 truncate flex-shrink-0">{record.domain}</span>

        {/* Software */}
        {record.software_name && (
          <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded border flex-shrink-0', swColor(record.software_name))}>
            {record.software_name} {record.software_version ? `v${record.software_version}` : ''}
          </span>
        )}

        {/* Protocols */}
        <div className="flex gap-1 flex-shrink-0">
          {(record.protocols ?? []).slice(0, 2).map((p) => (
            <span key={p} className="text-[9px] font-mono text-muted-foreground/60 bg-muted/40 px-1 rounded">{p}</span>
          ))}
        </div>

        {/* Users / Posts */}
        <div className="flex gap-4 ml-auto mr-4 flex-shrink-0">
          {record.user_count !== null && (
            <div className="text-right">
              <div className="text-[11px] font-mono text-foreground">{formatNumber(record.user_count)}</div>
              <div className="text-[9px] font-mono text-muted-foreground/50">users</div>
            </div>
          )}
          {record.post_count !== null && (
            <div className="text-right">
              <div className="text-[11px] font-mono text-foreground">{formatNumber(record.post_count)}</div>
              <div className="text-[9px] font-mono text-muted-foreground/50">posts</div>
            </div>
          )}
        </div>

        {/* Open reg */}
        {record.open_registrations !== null && (
          record.open_registrations
            ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" title="Open registrations" />
            : <XCircle className="w-3.5 h-3.5 text-red-400/60 flex-shrink-0" title="Closed registrations" />
        )}

        {/* Expiry */}
        <span className={cn('text-[10px] font-mono flex-shrink-0', expired ? 'text-amber-400' : 'text-muted-foreground/50')}>
          {expired ? '⚠ expired' : timeAgo(record.fetched_at)}
        </span>

        {/* Delete */}
        <button onClick={(e) => { e.stopPropagation(); onDelete(record.id); }}
          className="p-1 text-muted-foreground hover:text-red-400 transition-colors flex-shrink-0">
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <div className="text-[10px] font-mono text-muted-foreground">Fetched</div>
              <div className="text-[11px] font-mono text-foreground mt-0.5">{new Date(record.fetched_at).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[10px] font-mono text-muted-foreground">Expires</div>
              <div className={cn('text-[11px] font-mono mt-0.5', expired ? 'text-amber-400' : 'text-foreground')}>
                {new Date(record.expires_at).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-mono text-muted-foreground">Open Registrations</div>
              <div className={cn('text-[11px] font-mono mt-0.5', record.open_registrations ? 'text-emerald-400' : 'text-red-400')}>
                {record.open_registrations === null ? 'unknown' : record.open_registrations ? 'Yes' : 'No'}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-mono text-muted-foreground">Protocols</div>
              <div className="text-[11px] font-mono text-foreground mt-0.5">{(record.protocols ?? []).join(', ') || '—'}</div>
            </div>
          </div>

          {/* Raw JSON */}
          <div>
            <div className="text-[10px] font-mono text-muted-foreground/60 mb-1">Raw NodeInfo Response</div>
            <pre className="text-[10px] font-mono text-foreground/70 bg-muted/30 border border-border rounded px-3 py-2 overflow-auto max-h-48">
              {JSON.stringify(record.raw_response, null, 2)}
            </pre>
          </div>

          <div className="flex items-center gap-2">
            <a href={`https://${record.domain}/.well-known/nodeinfo`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] font-mono text-primary hover:underline">
              <ExternalLink className="w-3 h-3" />View live NodeInfo
            </a>
            <button onClick={() => { navigator.clipboard.writeText(JSON.stringify(record.raw_response, null, 2)); toast.success('NodeInfo JSON copied'); }}
              className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground ml-2">
              <Download className="w-3 h-3" />Copy JSON
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Refresh panel ────────────────────────────────────────────────────────────
function RefreshPanel({ onRefreshed }: { onRefreshed: () => void }) {
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  async function handleFetch() {
    if (!domain.trim()) return;
    setLoading(true);
    const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    const result = await fetchNodeInfoForDomain(clean);
    if (!result) {
      toast.error(`Could not fetch NodeInfo from ${clean}`);
      setLoading(false);
      return;
    }

    const { error } = await supabase.from('nodeinfo_cache').upsert({
      domain: clean,
      software_name: result.software_name,
      software_version: result.software_version,
      protocols: result.protocols,
      open_registrations: result.open_registrations,
      user_count: result.user_count,
      post_count: result.post_count,
      raw_response: result.raw_response,
      fetched_at: result.fetched_at,
      expires_at: result.expires_at,
    }, { onConflict: 'domain' });

    if (error) { toast.error(error.message); }
    else {
      toast.success(`NodeInfo cached for ${clean}`);
      qc.invalidateQueries({ queryKey: ['nodeinfo_cache'] });
      setDomain('');
      onRefreshed();
    }
    setLoading(false);
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Download className="w-4 h-4 text-cyan-400" />
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-mono">Fetch & Cache NodeInfo</span>
      </div>
      <div className="flex gap-2">
        <input value={domain} onChange={(e) => setDomain(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
          placeholder="mastodon.social"
          className="flex-1 px-3 py-1.5 bg-background border border-border rounded text-xs font-mono text-foreground focus:outline-none focus:border-primary/40" />
        <button onClick={handleFetch} disabled={loading || !domain.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-400/10 border border-cyan-400/25 text-cyan-400 text-xs font-mono rounded hover:bg-cyan-400/20 disabled:opacity-50 transition-colors">
          {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          Fetch
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function NodeInfoBrowser() {
  const [search, setSearch] = useState('');
  const [swFilter, setSwFilter] = useState('all');
  const { data: records, isLoading, refetch } = useNodeInfoCache(search);
  const qc = useQueryClient();

  const deleteRecord = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('nodeinfo_cache').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Record deleted');
      qc.invalidateQueries({ queryKey: ['nodeinfo_cache'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const softwares = ['all', ...Array.from(new Set(records?.map((r) => r.software_name).filter(Boolean) as string[]))];
  const filtered = records?.filter((r) => swFilter === 'all' || r.software_name === swFilter);
  const expired = records?.filter((r) => isExpired(r.expires_at)).length ?? 0;

  return (
    <div className="max-w-5xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-xl">
        <Database className="w-5 h-5 text-pink-400 flex-shrink-0" />
        <div>
          <h1 className="text-sm font-semibold text-foreground">NodeInfo Cache Browser</h1>
          <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
            Cached NodeInfo 2.x records from federated instances
          </p>
        </div>
        <button onClick={() => refetch()}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-muted-foreground border border-border rounded hover:bg-muted/60 transition-colors">
          <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl px-4 py-3">
          <div className="text-[10px] font-mono text-muted-foreground">Cached</div>
          <div className="text-xl font-bold font-mono text-foreground mt-1">{records?.length ?? 0}</div>
        </div>
        <div className="bg-card border border-border rounded-xl px-4 py-3">
          <div className="text-[10px] font-mono text-muted-foreground">Expired</div>
          <div className={cn('text-xl font-bold font-mono mt-1', expired > 0 ? 'text-amber-400' : 'text-emerald-400')}>{expired}</div>
        </div>
        <div className="bg-card border border-border rounded-xl px-4 py-3">
          <div className="text-[10px] font-mono text-muted-foreground">Total Users</div>
          <div className="text-xl font-bold font-mono text-cyan-300 mt-1">
            {formatNumber(records?.reduce((s, r) => s + (r.user_count ?? 0), 0) ?? 0)}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl px-4 py-3">
          <div className="text-[10px] font-mono text-muted-foreground">Software Types</div>
          <div className="text-xl font-bold font-mono text-violet-300 mt-1">
            {new Set(records?.map((r) => r.software_name).filter(Boolean)).size}
          </div>
        </div>
      </div>

      {expired > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-400/8 border border-amber-400/20 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <p className="text-[11px] font-mono text-amber-300">{expired} record{expired > 1 ? 's' : ''} expired — use "Fetch & Cache" to refresh or trigger the discover edge function</p>
        </div>
      )}

      {/* Fetch panel */}
      <RefreshPanel onRefreshed={() => refetch()} />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search domain or software…"
            className="pl-8 pr-3 py-1.5 bg-card border border-border rounded text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 w-56" />
        </div>
        <div className="flex flex-wrap gap-1">
          {softwares.map((sw) => (
            <button key={sw} onClick={() => setSwFilter(sw)}
              className={cn('px-2.5 py-1 text-[11px] font-mono rounded border transition-all capitalize',
                swFilter === sw
                  ? sw === 'all' ? 'bg-primary/10 text-primary border-primary/25' : cn(swColor(sw), 'opacity-100')
                  : 'text-muted-foreground border-border hover:bg-muted/60')}>
              {sw}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[11px] font-mono text-muted-foreground/50">{filtered?.length ?? 0} records</span>
      </div>

      {/* Records */}
      {isLoading ? (
        <div className="bg-card border border-border rounded-xl p-16 flex items-center justify-center gap-2 text-muted-foreground text-sm font-mono">
          <RefreshCw className="w-4 h-4 animate-spin" />Loading NodeInfo cache…
        </div>
      ) : !filtered?.length ? (
        <div className="bg-card border border-border rounded-xl p-16 text-center">
          <Server className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-mono">
            {search ? 'No records match your search.' : 'NodeInfo cache is empty. Fetch a domain above or run the discover edge function.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <NodeInfoRow key={r.id} record={r} onDelete={(id) => deleteRecord.mutate(id)} />
          ))}
        </div>
      )}
    </div>
  );
}
