import { useState } from 'react';
import {
  Globe, RefreshCw, Plus, Trash2, Search, ExternalLink,
  ChevronDown, ChevronUp, Wifi, WifiOff, Loader2, Zap,
} from 'lucide-react';
import StatusBadge from '@/components/features/StatusBadge';
import { useFederationInstances } from '@/hooks/useFederationInstances';
import { useAutoDiscover } from '@/hooks/useAutoDiscover';
import { formatNumber, timeAgo, cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { FederationInstance } from '@/types/federation';

const softwareBadge: Record<string, string> = {
  mastodon: 'text-violet-400 bg-violet-400/10 border-violet-400/25',
  pixelfed: 'text-pink-400 bg-pink-400/10 border-pink-400/25',
  peertube: 'text-orange-400 bg-orange-400/10 border-orange-400/25',
  threads:  'text-blue-400 bg-blue-400/10 border-blue-400/25',
  misskey:  'text-emerald-400 bg-emerald-400/10 border-emerald-400/25',
  pleroma:  'text-amber-400 bg-amber-400/10 border-amber-400/25',
  other:    'text-muted-foreground bg-muted border-border',
};

const SOFTWARE_OPTIONS = ['mastodon', 'pixelfed', 'peertube', 'misskey', 'pleroma', 'threads', 'other'];
type SortKey = 'domain' | 'account_count' | 'post_count' | 'last_seen_at';

interface PingResult { instanceId: string; latency: number | null; online: boolean; }

export default function Instances() {
  const { data: instances, isLoading, isError, refetch } = useFederationInstances();
  const { discover } = useAutoDiscover();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'unreachable' | 'suspended'>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('account_count');
  const [sortAsc, setSortAsc] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pingResults, setPingResults] = useState<Record<string, PingResult>>({});
  const [pingingId, setPingingId] = useState<string | null>(null);
  const [pingingAll, setPingingAll] = useState(false);

  const [form, setForm] = useState({ domain: '', software: 'mastodon', version: '', inbox_url: '', shared_inbox_url: '' });

  async function pingInstance(inst: FederationInstance): Promise<PingResult> {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      await fetch(`https://${inst.domain}/.well-known/nodeinfo`, { method: 'HEAD', signal: controller.signal, mode: 'no-cors' });
      clearTimeout(timeout);
      return { instanceId: inst.id, latency: Date.now() - start, online: true };
    } catch {
      return { instanceId: inst.id, latency: null, online: false };
    }
  }

  async function handlePing(inst: FederationInstance) {
    setPingingId(inst.id);
    const result = await pingInstance(inst);
    setPingResults(p => ({ ...p, [inst.id]: result }));
    const newStatus = result.online ? 'active' : 'unreachable';
    if (inst.status !== newStatus) {
      await supabase.from('federation_instances').update({ status: newStatus, last_seen_at: result.online ? new Date().toISOString() : inst.last_seen_at, updated_at: new Date().toISOString() }).eq('id', inst.id);
      await supabase.from('activity_logs').insert({ event_type: 'instance_ping', module: 'sync', description: `Ping ${inst.domain}: ${result.online ? `online (${result.latency}ms)` : 'unreachable'}`, status: result.online ? 'success' : 'warning' });
      queryClient.invalidateQueries({ queryKey: ['federation_instances'] });
    }
    toast[result.online ? 'success' : 'error'](result.online ? `${inst.domain} · ${result.latency}ms` : `${inst.domain} unreachable`);
    setPingingId(null);
  }

  async function handlePingAll() {
    if (!instances?.length) return;
    setPingingAll(true);
    const results = await Promise.all(instances.map(pingInstance));
    const map: Record<string, PingResult> = {};
    results.forEach(r => { map[r.instanceId] = r; });
    setPingResults(map);
    await Promise.all(results.map(async r => {
      const inst = instances.find(i => i.id === r.instanceId);
      if (!inst) return;
      const newStatus = r.online ? 'active' : 'unreachable';
      if (inst.status !== newStatus) {
        await supabase.from('federation_instances').update({ status: newStatus, last_seen_at: r.online ? new Date().toISOString() : inst.last_seen_at, updated_at: new Date().toISOString() }).eq('id', r.instanceId);
      }
    }));
    const online = results.filter(r => r.online).length;
    toast.success(`Ping complete: ${online}/${instances.length} instances online.`);
    queryClient.invalidateQueries({ queryKey: ['federation_instances'] });
    queryClient.invalidateQueries({ queryKey: ['activity_logs'] });
    setPingingAll(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.domain.trim()) return;
    setSaving(true);
    const domain = form.domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    const inbox_url = form.inbox_url || `https://${domain}/inbox`;
    const { error } = await supabase.from('federation_instances').insert({
      domain, software: form.software, version: form.version || null,
      inbox_url, shared_inbox_url: form.shared_inbox_url || inbox_url,
      status: 'active', last_seen_at: new Date().toISOString(),
    });
    if (error) {
      toast.error(error.message.includes('unique') ? 'Instance already exists.' : error.message);
    } else {
      toast.success(`${domain} added.`);
      await supabase.from('activity_logs').insert({ event_type: 'instance_added', module: 'sync', description: `Added new instance: ${domain} (${form.software})`, status: 'success' });
      queryClient.invalidateQueries({ queryKey: ['federation_instances'] });
      queryClient.invalidateQueries({ queryKey: ['activity_logs'] });
      setForm({ domain: '', software: 'mastodon', version: '', inbox_url: '', shared_inbox_url: '' });
      setShowAddForm(false);
    }
    setSaving(false);
  }

  async function handleDelete(inst: FederationInstance) {
    if (!confirm(`Remove ${inst.domain} from federation?`)) return;
    const { error } = await supabase.from('federation_instances').delete().eq('id', inst.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${inst.domain} removed.`);
    queryClient.invalidateQueries({ queryKey: ['federation_instances'] });
  }

  async function handleStatusToggle(inst: FederationInstance) {
    const next = inst.status === 'active' ? 'suspended' : 'active';
    const { error } = await supabase.from('federation_instances').update({ status: next, updated_at: new Date().toISOString() }).eq('id', inst.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${inst.domain} marked as ${next}.`);
    queryClient.invalidateQueries({ queryKey: ['federation_instances'] });
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(p => !p);
    else { setSortKey(key); setSortAsc(true); }
  }

  const filtered = (instances ?? [])
    .filter(i => {
      const matchSearch = i.domain.includes(search.toLowerCase()) || i.software.includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || i.status === statusFilter;
      return matchSearch && matchStatus;
    })
    .sort((a, b) => {
      const va = a[sortKey] ?? '';
      const vb = b[sortKey] ?? '';
      if (sortKey === 'account_count' || sortKey === 'post_count') return sortAsc ? Number(va) - Number(vb) : Number(vb) - Number(va);
      return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (sortAsc ? <ChevronUp className="w-3 h-3 inline ml-0.5" /> : <ChevronDown className="w-3 h-3 inline ml-0.5" />) : null;

  const statusCounts = {
    all: instances?.length ?? 0,
    active: instances?.filter(i => i.status === 'active').length ?? 0,
    unreachable: instances?.filter(i => i.status === 'unreachable').length ?? 0,
    suspended: instances?.filter(i => i.status === 'suspended').length ?? 0,
  };

  return (
    <div className="max-w-6xl space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48 max-w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search domain or software…"
            className="w-full pl-8 pr-3 py-1.5 bg-card border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 font-mono" />
        </div>
        <div className="flex items-center gap-1">
          {(['all', 'active', 'unreachable', 'suspended'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn('px-2.5 py-1 rounded text-xs font-mono border transition-all',
                statusFilter === s ? 'bg-primary/10 text-primary border-primary/25' : 'text-muted-foreground border-border hover:bg-muted/60')}>
              {s} <span className="opacity-60">({statusCounts[s]})</span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={discover}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-400/10 border border-amber-400/25 text-amber-400 text-xs rounded-md hover:bg-amber-400/20 transition-colors font-medium">
            <Zap className="w-3.5 h-3.5" />Auto-Discover
          </button>
          <button onClick={handlePingAll} disabled={pingingAll || !instances?.length}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-400/10 border border-cyan-400/25 text-cyan-400 text-xs rounded-md hover:bg-cyan-400/20 transition-colors font-medium disabled:opacity-50">
            {pingingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
            {pingingAll ? 'Pinging…' : 'Ping All'}
          </button>
          <button onClick={() => setShowAddForm(p => !p)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/25 text-primary text-xs rounded-md hover:bg-primary/20 transition-colors font-medium">
            <Plus className="w-3.5 h-3.5" />Add Instance
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <form onSubmit={handleAdd} className="bg-card border border-primary/20 rounded-lg p-4 space-y-3">
          <div className="text-xs font-semibold text-primary mb-1 font-mono">New Fediverse Instance</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[11px] text-muted-foreground font-mono mb-1">Domain *</label>
              <input required value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })}
                placeholder="instance.example.com"
                className="w-full px-3 py-1.5 bg-background border border-border rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 font-mono" />
            </div>
            <div>
              <label className="block text-[11px] text-muted-foreground font-mono mb-1">Software</label>
              <select value={form.software} onChange={e => setForm({ ...form, software: e.target.value })}
                className="w-full px-3 py-1.5 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:border-primary/40 font-mono">
                {SOFTWARE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-muted-foreground font-mono mb-1">Version</label>
              <input value={form.version} onChange={e => setForm({ ...form, version: e.target.value })} placeholder="4.2.8"
                className="w-full px-3 py-1.5 bg-background border border-border rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 font-mono" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button type="submit" disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground text-xs rounded font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
              {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              {saving ? 'Adding…' : 'Add Instance'}
            </button>
            <button type="button" onClick={() => setShowAddForm(false)}
              className="px-4 py-1.5 text-xs text-muted-foreground border border-border rounded hover:bg-muted/60 transition-colors">Cancel</button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {isLoading && <div className="p-10 text-center text-sm text-muted-foreground font-mono flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> Loading instances…</div>}
        {isError && (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm text-red-400 font-mono">Failed to load instances.</p>
            <button onClick={() => refetch()} className="flex items-center gap-1.5 mx-auto px-4 py-1.5 bg-red-400/10 border border-red-400/25 text-red-400 text-xs rounded font-mono hover:bg-red-400/20 transition-colors">
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        )}
        {!isLoading && !isError && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                    <button onClick={() => toggleSort('domain')} className="hover:text-foreground transition-colors">Domain <SortIcon k="domain" /></button>
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Software</th>
                  <th className="text-left px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Ping</th>
                  <th className="text-right px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                    <button onClick={() => toggleSort('post_count')} className="hover:text-foreground transition-colors">Posts <SortIcon k="post_count" /></button>
                  </th>
                  <th className="text-right px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                    <button onClick={() => toggleSort('account_count')} className="hover:text-foreground transition-colors">Accounts <SortIcon k="account_count" /></button>
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                    <button onClick={() => toggleSort('last_seen_at')} className="hover:text-foreground transition-colors">Last Seen <SortIcon k="last_seen_at" /></button>
                  </th>
                  <th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(inst => {
                  const pr = pingResults[inst.id];
                  return (
                    <>
                      <tr key={inst.id} className="hover:bg-muted/20 transition-colors group">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Globe className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="font-mono text-xs text-foreground">{inst.domain}</span>
                            <a href={`https://${inst.domain}`} target="_blank" rel="noopener noreferrer"
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary">
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                          {inst.version && <div className="text-[10px] font-mono text-muted-foreground/50 pl-5 mt-0.5">v{inst.version}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('text-[11px] font-mono px-2 py-0.5 rounded border capitalize', softwareBadge[inst.software] ?? softwareBadge.other)}>
                            {inst.software}
                          </span>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={inst.status} pulse={inst.status === 'active'} /></td>
                        <td className="px-4 py-3">
                          {pr ? (
                            <div className="flex items-center gap-1.5">
                              {pr.online ? <Wifi className="w-3 h-3 text-emerald-400 flex-shrink-0" /> : <WifiOff className="w-3 h-3 text-red-400 flex-shrink-0" />}
                              <span className={cn('text-[11px] font-mono', pr.online ? 'text-emerald-400' : 'text-red-400')}>
                                {pr.online ? `${pr.latency}ms` : 'timeout'}
                              </span>
                            </div>
                          ) : <span className="text-[11px] font-mono text-muted-foreground/40">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">{formatNumber(inst.post_count)}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">{formatNumber(inst.account_count)}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{inst.last_seen_at ? timeAgo(inst.last_seen_at) : '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => handlePing(inst)} disabled={pingingId === inst.id || pingingAll}
                              className="p-1 rounded border border-border text-muted-foreground hover:text-cyan-400 hover:border-cyan-400/25 hover:bg-cyan-400/8 transition-colors disabled:opacity-50" title="Ping">
                              {pingingId === inst.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => setExpandedId(expandedId === inst.id ? null : inst.id)}
                              className="px-2 py-1 text-[10px] font-mono rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">Info</button>
                            <button onClick={() => handleStatusToggle(inst)}
                              className="px-2 py-1 text-[10px] font-mono rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
                              {inst.status === 'active' ? 'Suspend' : 'Activate'}
                            </button>
                            <button onClick={() => handleDelete(inst)}
                              className="p-1 rounded border border-transparent text-muted-foreground hover:text-red-400 hover:border-red-400/20 hover:bg-red-400/8 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === inst.id && (
                        <tr key={`${inst.id}-exp`} className="bg-muted/10">
                          <td colSpan={8} className="px-4 py-3">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-1.5 text-xs font-mono">
                              <div><span className="text-muted-foreground">Inbox:</span> <span className="text-foreground break-all">{inst.inbox_url ?? '—'}</span></div>
                              <div><span className="text-muted-foreground">Shared:</span> <span className="text-foreground break-all">{inst.shared_inbox_url ?? '—'}</span></div>
                              <div><span className="text-muted-foreground">Added:</span> <span className="text-foreground">{timeAgo(inst.created_at)}</span></div>
                              <div><span className="text-muted-foreground">Updated:</span> <span className="text-foreground">{timeAgo(inst.updated_at)}</span></div>
                              <div><span className="text-muted-foreground">ID:</span> <span className="text-foreground/50 text-[10px]">{inst.id}</span></div>
                              {pingResults[inst.id] && (
                                <div><span className="text-muted-foreground">Last Ping:</span>{' '}
                                  <span className={pingResults[inst.id].online ? 'text-emerald-400' : 'text-red-400'}>
                                    {pingResults[inst.id].online ? `online · ${pingResults[inst.id].latency}ms` : 'unreachable'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground font-mono">
                      {search || statusFilter !== 'all' ? 'No instances match your filters.' : 'No instances configured yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="text-[11px] font-mono text-muted-foreground/50 text-center">
        {instances?.length ?? 0} instances registered · Auto-refreshes every 30s · Use "Auto-Discover" to find more
      </div>
    </div>
  );
}
