import { useState } from 'react';
import { RefreshCw, ExternalLink, Plus, Send, Trash2, RotateCcw, ChevronDown, AlertTriangle } from 'lucide-react';
import StatusBadge from '@/components/features/StatusBadge';
import { useDeliveryQueue } from '@/hooks/useDeliveryQueue';
import { useActivityLogs } from '@/hooks/useActivityLogs';
import ActivityFeed from '@/components/features/ActivityFeed';
import { timeAgo, truncate, cn, formatNumber } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const FILTERS = ['all', 'pending', 'delivered', 'failed', 'retrying'] as const;
type Filter = typeof FILTERS[number];

const activityColors: Record<string, string> = {
  Create:   'text-emerald-400 bg-emerald-400/10 border-emerald-400/25',
  Follow:   'text-violet-400 bg-violet-400/10 border-violet-400/25',
  Like:     'text-pink-400 bg-pink-400/10 border-pink-400/25',
  Announce: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/25',
  Delete:   'text-red-400 bg-red-400/10 border-red-400/25',
  Undo:     'text-amber-400 bg-amber-400/10 border-amber-400/25',
};

const ACTIVITY_TYPES = ['Create', 'Follow', 'Like', 'Announce', 'Delete', 'Undo'];

export default function ExportQueue() {
  const [filter, setFilter] = useState<Filter>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [bulkRetrying, setBulkRetrying] = useState(false);
  const queryClient = useQueryClient();
  const { data: allItems } = useDeliveryQueue('all');
  const { data: items, isLoading } = useDeliveryQueue(filter);
  const { data: exportLogs } = useActivityLogs(10, 'export');

  const [form, setForm] = useState({
    activity_type: 'Create', target_inbox: '', target_domain: '',
    content: '', max_attempts: '3',
  });

  const counts = {
    all:       allItems?.length ?? 0,
    pending:   allItems?.filter(i => i.status === 'pending').length ?? 0,
    delivered: allItems?.filter(i => i.status === 'delivered').length ?? 0,
    failed:    allItems?.filter(i => i.status === 'failed').length ?? 0,
    retrying:  allItems?.filter(i => i.status === 'retrying').length ?? 0,
  };

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const target_domain = form.target_domain || (() => { try { return new URL(form.target_inbox).hostname; } catch { return form.target_inbox; } })();
    const activity_data = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: form.activity_type,
      id: `https://testagram.site/activities/${Date.now()}`,
      actor: 'https://testagram.site/users/me',
      ...(form.activity_type === 'Create' ? { object: { type: 'Note', content: form.content } } : {}),
    };
    const { error } = await supabase.from('delivery_queue').insert({
      activity_type: form.activity_type, activity_data,
      target_inbox: form.target_inbox, target_domain,
      status: 'pending', attempts: 0, max_attempts: parseInt(form.max_attempts),
    });
    if (error) { toast.error(error.message); setSaving(false); return; }
    await supabase.from('activity_logs').insert({
      event_type: 'delivery_queued', module: 'export',
      description: `Queued ${form.activity_type} activity for ${target_domain}`, status: 'success',
    });
    toast.success(`${form.activity_type} activity queued for ${target_domain}.`);
    queryClient.invalidateQueries({ queryKey: ['delivery_queue'] });
    queryClient.invalidateQueries({ queryKey: ['activity_logs'] });
    setForm({ activity_type: 'Create', target_inbox: '', target_domain: '', content: '', max_attempts: '3' });
    setShowAddForm(false);
    setSaving(false);
  }

  async function handleRetry(id: string, domain: string) {
    const { error } = await supabase.from('delivery_queue')
      .update({ status: 'pending', attempts: 0, last_error: null, scheduled_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { toast.error(error.message); return; }
    await supabase.from('activity_logs').insert({
      event_type: 'delivery_retry', module: 'export',
      description: `Manually retrying delivery to ${domain}`, status: 'warning',
    });
    toast.success('Item reset to pending — will retry on next cycle.');
    queryClient.invalidateQueries({ queryKey: ['delivery_queue'] });
    queryClient.invalidateQueries({ queryKey: ['activity_logs'] });
  }

  async function handleBulkRetry() {
    const failedItems = allItems?.filter(i => i.status === 'failed' || i.status === 'retrying') ?? [];
    if (!failedItems.length) { toast.info('No failed items to retry.'); return; }
    if (!confirm(`Reset ${failedItems.length} failed/retrying item(s) to pending?`)) return;
    setBulkRetrying(true);
    const { error } = await supabase.from('delivery_queue')
      .update({ status: 'pending', attempts: 0, last_error: null, scheduled_at: new Date().toISOString() })
      .in('status', ['failed', 'retrying']);
    if (error) { toast.error(error.message); setBulkRetrying(false); return; }
    await supabase.from('activity_logs').insert({
      event_type: 'bulk_retry', module: 'export',
      description: `Bulk retry triggered: ${failedItems.length} items reset to pending`, status: 'warning',
    });
    toast.success(`${failedItems.length} items reset to pending.`);
    queryClient.invalidateQueries({ queryKey: ['delivery_queue'] });
    queryClient.invalidateQueries({ queryKey: ['activity_logs'] });
    setBulkRetrying(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this item from the delivery queue?')) return;
    const { error } = await supabase.from('delivery_queue').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Delivery item removed.');
    queryClient.invalidateQueries({ queryKey: ['delivery_queue'] });
  }

  return (
    <div className="max-w-6xl space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        {(['pending', 'delivered', 'failed', 'retrying'] as const).map(s => (
          <div key={s} className={cn('bg-card border rounded-lg px-4 py-3 flex items-center justify-between',
            s === 'failed' && counts.failed > 0 ? 'border-red-400/25' : 'border-border')}>
            <span className="text-xs text-muted-foreground capitalize">{s}</span>
            <span className={cn('text-lg font-bold font-mono',
              s === 'failed' && counts.failed > 0 ? 'text-red-300' : 'text-foreground')}>
              {formatNumber(counts[s])}
            </span>
          </div>
        ))}
      </div>

      {/* Failed banner */}
      {counts.failed > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-400/6 border border-red-400/20 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300 flex-1">
            {counts.failed} deliveries failed — {counts.retrying} are retrying.
          </p>
          <button
            onClick={handleBulkRetry}
            disabled={bulkRetrying}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-400/15 border border-red-400/25 text-red-400 text-xs rounded-md hover:bg-red-400/25 transition-colors font-semibold disabled:opacity-50 flex-shrink-0"
          >
            {bulkRetrying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            {bulkRetrying ? 'Retrying…' : `Retry All Failed (${counts.failed + counts.retrying})`}
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 flex-wrap">
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all border',
                filter === f ? 'bg-primary/10 text-primary border-primary/25' : 'text-muted-foreground border-border hover:text-foreground hover:bg-muted/60')}>
              {f} <span className="opacity-60">({counts[f]})</span>
            </button>
          ))}
        </div>
        <button onClick={() => setShowAddForm(p => !p)}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-emerald-400/10 border border-emerald-400/25 text-emerald-400 text-xs rounded-md hover:bg-emerald-400/20 transition-colors font-medium">
          <Plus className="w-3.5 h-3.5" />Queue Activity
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <form onSubmit={handleAddItem} className="bg-card border border-emerald-400/20 rounded-lg p-4 space-y-3">
          <div className="text-xs font-semibold text-emerald-400 font-mono mb-1">Queue Outbound Activity</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-muted-foreground font-mono mb-1">Activity Type</label>
              <select value={form.activity_type} onChange={e => setForm({ ...form, activity_type: e.target.value })}
                className="w-full px-3 py-1.5 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:border-emerald-400/40 font-mono">
                {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-muted-foreground font-mono mb-1">Max Attempts</label>
              <input type="number" min="1" max="10" value={form.max_attempts} onChange={e => setForm({ ...form, max_attempts: e.target.value })}
                className="w-full px-3 py-1.5 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:border-emerald-400/40 font-mono" />
            </div>
            <div>
              <label className="block text-[11px] text-muted-foreground font-mono mb-1">Target Inbox URL *</label>
              <input required value={form.target_inbox} onChange={e => setForm({ ...form, target_inbox: e.target.value })}
                placeholder="https://mastodon.social/inbox"
                className="w-full px-3 py-1.5 bg-background border border-border rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-emerald-400/40 font-mono" />
            </div>
            <div>
              <label className="block text-[11px] text-muted-foreground font-mono mb-1">Target Domain</label>
              <input value={form.target_domain} onChange={e => setForm({ ...form, target_domain: e.target.value })}
                placeholder="mastodon.social"
                className="w-full px-3 py-1.5 bg-background border border-border rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-emerald-400/40 font-mono" />
            </div>
            {form.activity_type === 'Create' && (
              <div className="col-span-2">
                <label className="block text-[11px] text-muted-foreground font-mono mb-1">Note Content</label>
                <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}
                  rows={2} placeholder="Post content to publish via ActivityPub from testagram.site…"
                  className="w-full px-3 py-1.5 bg-background border border-border rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-emerald-400/40 font-mono resize-none" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button type="submit" disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-400/15 border border-emerald-400/30 text-emerald-400 text-xs rounded font-semibold hover:bg-emerald-400/25 transition-colors disabled:opacity-50">
              {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              {saving ? 'Queueing…' : 'Queue Activity'}
            </button>
            <button type="button" onClick={() => setShowAddForm(false)}
              className="px-4 py-1.5 text-xs text-muted-foreground border border-border rounded hover:bg-muted/60 transition-colors">Cancel</button>
          </div>
        </form>
      )}

      {/* Queue table */}
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
                  <th className="text-left px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Activity</th>
                  <th className="text-left px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Target</th>
                  <th className="text-left px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="text-center px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Attempts</th>
                  <th className="text-left px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Created</th>
                  <th className="text-left px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Delivered</th>
                  <th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items?.map(item => (
                  <>
                    <tr key={item.id} className="hover:bg-muted/20 transition-colors group">
                      <td className="px-4 py-3">
                        <span className={cn('text-[11px] font-mono px-2 py-0.5 rounded border',
                          activityColors[item.activity_type] ?? 'text-muted-foreground bg-muted border-border')}>
                          {item.activity_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs text-foreground">{item.target_domain ?? '—'}</span>
                          <a href={item.target_inbox} target="_blank" rel="noopener noreferrer"
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        {item.last_error && (
                          <div className="text-[10px] font-mono text-red-400 mt-0.5 max-w-xs truncate" title={item.last_error}>
                            {truncate(item.last_error, 60)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                      <td className="px-4 py-3 text-center font-mono text-xs text-muted-foreground">{item.attempts}/{item.max_attempts}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{timeAgo(item.created_at)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.delivered_at ? timeAgo(item.delivered_at) : '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors" title="View payload">
                            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', expandedId === item.id && 'rotate-180')} />
                          </button>
                          {(item.status === 'failed' || item.status === 'retrying') && (
                            <button onClick={() => handleRetry(item.id, item.target_domain ?? '—')}
                              className="p-1 rounded text-muted-foreground hover:text-amber-400 hover:bg-amber-400/10 transition-colors" title="Retry">
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => handleDelete(item.id)}
                            className="p-1 rounded text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === item.id && (
                      <tr key={`${item.id}-exp`} className="bg-muted/10">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="text-[11px] font-mono text-muted-foreground mb-1">Payload</div>
                          <pre className="text-[11px] font-mono text-cyan-300 bg-background border border-border rounded p-3 overflow-x-auto max-h-40">
                            {JSON.stringify(item.activity_data, null, 2)}
                          </pre>
                          <div className="mt-2 text-[11px] font-mono text-muted-foreground">
                            Inbox: <span className="text-foreground">{item.target_inbox}</span>
                            {item.scheduled_at && <> · Scheduled: <span className="text-foreground">{timeAgo(item.scheduled_at)}</span></>}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {items?.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground font-mono">
                      No items in the delivery queue.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Export Activity</h2>
        <ActivityFeed logs={exportLogs ?? []} />
      </div>
    </div>
  );
}
