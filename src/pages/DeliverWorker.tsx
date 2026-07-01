/**
 * Deliver Worker Control Panel
 * Wire the deliver edge function to the UI — trigger delivery, view results live
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Send, RefreshCw, Play, CheckCircle, XCircle, Clock, AlertTriangle,
  Zap, Globe, BarChart2, Trash2, RotateCcw, Loader2, ChevronDown, ChevronRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn, timeAgo, formatNumber } from '@/lib/utils';
import { toast } from 'sonner';
import type { DeliveryQueueItem } from '@/types/federation';
import { FunctionsHttpError } from '@supabase/supabase-js';

// ─── Edge function invoker ────────────────────────────────────────────────────
async function invokeDeliver(): Promise<{ processed: number; delivered: number; failed: number; results: any[] }> {
  const { data, error } = await supabase.functions.invoke('deliver', { body: {} });
  if (error) {
    let msg = error.message;
    if (error instanceof FunctionsHttpError) {
      try {
        const status = error.context?.status ?? 500;
        const text = await error.context?.text();
        msg = `[${status}] ${text || error.message}`;
      } catch { /* */ }
    }
    throw new Error(msg);
  }
  return data;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useQueue(statusFilter: string) {
  return useQuery({
    queryKey: ['delivery_queue', statusFilter],
    queryFn: async () => {
      let q = supabase
        .from('delivery_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (statusFilter !== 'all') q = q.eq('status', statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data as DeliveryQueueItem[];
    },
    refetchInterval: 10_000,
  });
}

function useDeliveries() {
  return useQuery({
    queryKey: ['deliveries_log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deliveries')
        .select('*')
        .order('attempted_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    refetchInterval: 15_000,
  });
}

// ─── Status badge map ─────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { icon: React.ReactNode; color: string }> = {
  pending:   { icon: <Clock className="w-3 h-3" />, color: 'text-amber-400 bg-amber-400/10 border-amber-400/25' },
  retrying:  { icon: <RotateCcw className="w-3 h-3" />, color: 'text-orange-400 bg-orange-400/10 border-orange-400/25' },
  delivered: { icon: <CheckCircle className="w-3 h-3" />, color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/25' },
  failed:    { icon: <XCircle className="w-3 h-3" />, color: 'text-red-400 bg-red-400/10 border-red-400/25' },
};

// ─── Queue Item Row ───────────────────────────────────────────────────────────
function QueueRow({ item }: { item: DeliveryQueueItem }) {
  const [expanded, setExpanded] = useState(false);
  const qc = useQueryClient();
  const sm = STATUS_MAP[item.status] ?? STATUS_MAP.pending;

  const retryMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('delivery_queue')
        .update({ status: 'pending', last_error: null, scheduled_at: new Date().toISOString() })
        .eq('id', item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Item reset to pending');
      qc.invalidateQueries({ queryKey: ['delivery_queue'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('delivery_queue').delete().eq('id', item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Item removed');
      qc.invalidateQueries({ queryKey: ['delivery_queue'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className={cn('bg-card border rounded-lg overflow-hidden', item.status === 'failed' ? 'border-red-400/20' : 'border-border')}>
      <button onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/20 transition-colors">
        {/* Status */}
        <span className={cn('flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border flex-shrink-0', sm.color)}>
          {sm.icon}{item.status}
        </span>

        {/* Type */}
        <span className="text-[11px] font-mono text-primary/80 flex-shrink-0 w-20">{item.activity_type}</span>

        {/* Domain */}
        <span className="text-xs font-mono text-foreground truncate flex-1">
          {item.target_domain ?? item.target_inbox}
        </span>

        {/* Attempts */}
        <span className="text-[11px] font-mono text-muted-foreground flex-shrink-0">
          {item.attempts}/{item.max_attempts} attempts
        </span>

        {/* Time */}
        <span className="text-[10px] font-mono text-muted-foreground/50 flex-shrink-0">{timeAgo(item.created_at)}</span>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {(item.status === 'failed' || item.status === 'retrying') && (
            <button onClick={() => retryMut.mutate()} disabled={retryMut.isPending}
              className="p-1 text-muted-foreground hover:text-amber-400 transition-colors" title="Reset to pending">
              {retryMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            </button>
          )}
          <button onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending}
            className="p-1 text-muted-foreground hover:text-red-400 transition-colors">
            {deleteMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>

        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
            <div><span className="text-muted-foreground">ID:</span> <span className="text-foreground/60">{item.id}</span></div>
            <div><span className="text-muted-foreground">Inbox:</span> <span className="text-foreground break-all">{item.target_inbox}</span></div>
            <div><span className="text-muted-foreground">Scheduled:</span> <span className="text-foreground">{timeAgo(item.scheduled_at)}</span></div>
            {item.delivered_at && <div><span className="text-muted-foreground">Delivered:</span> <span className="text-emerald-400">{timeAgo(item.delivered_at)}</span></div>}
            {item.last_error && <div className="col-span-2"><span className="text-red-400">Error:</span> <span className="text-red-300 break-all">{item.last_error}</span></div>}
          </div>
          <div>
            <div className="text-[10px] font-mono text-muted-foreground/60 mb-1">Activity Payload</div>
            <pre className="text-[10px] font-mono text-foreground/70 bg-muted/30 border border-border rounded px-3 py-2 overflow-auto max-h-36">
              {JSON.stringify(item.activity_data, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Run Result ───────────────────────────────────────────────────────────────
function RunResult({ result }: { result: { processed: number; delivered: number; failed: number; results: any[] } }) {
  return (
    <div className="bg-card border border-primary/20 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Delivery Run Complete</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <div className="text-2xl font-bold font-mono text-foreground">{result.processed}</div>
          <div className="text-[10px] font-mono text-muted-foreground mt-1">Processed</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold font-mono text-emerald-400">{result.delivered}</div>
          <div className="text-[10px] font-mono text-muted-foreground mt-1">Delivered</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold font-mono text-red-400">{result.failed}</div>
          <div className="text-[10px] font-mono text-muted-foreground mt-1">Failed</div>
        </div>
      </div>
      {result.results?.length > 0 && (
        <div className="space-y-1.5">
          {result.results.map((r, i) => (
            <div key={i} className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded border text-[11px] font-mono',
              r.success ? 'bg-emerald-400/5 border-emerald-400/15 text-emerald-400' : 'bg-red-400/5 border-red-400/15 text-red-400'
            )}>
              {r.success ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" /> : <XCircle className="w-3.5 h-3.5 flex-shrink-0" />}
              <span>{r.id} · HTTP {r.status}</span>
              {r.error && <span className="text-red-300/70 ml-auto truncate max-w-xs">{r.error}</span>}
            </div>
          ))}
        </div>
      )}
      {result.processed === 0 && (
        <p className="text-[11px] font-mono text-muted-foreground text-center">Queue is idle — no pending items to deliver.</p>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DeliverWorker() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [runResult, setRunResult] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const qc = useQueryClient();

  const { data: queue, isLoading } = useQueue(statusFilter);
  const { data: deliveries } = useDeliveries();

  const stats = {
    total: queue?.length ?? 0,
    pending: queue?.filter((i) => i.status === 'pending').length ?? 0,
    delivered: queue?.filter((i) => i.status === 'delivered').length ?? 0,
    failed: queue?.filter((i) => i.status === 'failed').length ?? 0,
    retrying: queue?.filter((i) => i.status === 'retrying').length ?? 0,
  };

  async function runDelivery() {
    setRunning(true);
    setRunResult(null);
    try {
      const result = await invokeDeliver();
      setRunResult(result);
      qc.invalidateQueries({ queryKey: ['delivery_queue'] });
      qc.invalidateQueries({ queryKey: ['deliveries_log'] });
      qc.invalidateQueries({ queryKey: ['activity_logs'] });
      toast.success(`Deliver: ${result.delivered} delivered, ${result.failed} failed`);
    } catch (e: any) {
      toast.error(`Deliver failed: ${e.message}`);
    } finally {
      setRunning(false);
    }
  }

  async function bulkRetryFailed() {
    const { error } = await supabase
      .from('delivery_queue')
      .update({ status: 'pending', last_error: null, attempts: 0, scheduled_at: new Date().toISOString() })
      .eq('status', 'failed');
    if (error) { toast.error(error.message); return; }
    toast.success('All failed items reset to pending');
    qc.invalidateQueries({ queryKey: ['delivery_queue'] });
  }

  return (
    <div className="max-w-5xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-xl">
        <Send className="w-5 h-5 text-primary flex-shrink-0" />
        <div>
          <h1 className="text-sm font-semibold text-foreground">Deliver Worker</h1>
          <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
            Trigger the <code className="text-primary">deliver</code> edge function · process pending queue items
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {stats.failed > 0 && (
            <button onClick={bulkRetryFailed}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-400/10 border border-orange-400/25 text-orange-400 text-xs rounded-lg hover:bg-orange-400/20 transition-colors font-medium">
              <RotateCcw className="w-3.5 h-3.5" />Retry All Failed ({stats.failed})
            </button>
          )}
          <button onClick={runDelivery} disabled={running}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {running ? 'Running…' : 'Run Deliver'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-foreground' },
          { label: 'Pending', value: stats.pending, color: 'text-amber-400' },
          { label: 'Retrying', value: stats.retrying, color: 'text-orange-400' },
          { label: 'Delivered', value: stats.delivered, color: 'text-emerald-400' },
          { label: 'Failed', value: stats.failed, color: 'text-red-400' },
        ].map((s) => (
          <button key={s.label}
            onClick={() => setStatusFilter(s.label === 'Total' ? 'all' : s.label.toLowerCase())}
            className={cn('bg-card border rounded-xl px-3 py-3 text-left transition-all hover:border-primary/20',
              (statusFilter === s.label.toLowerCase() || (statusFilter === 'all' && s.label === 'Total'))
                ? 'border-primary/20 bg-primary/5' : 'border-border')}>
            <div className="text-[10px] font-mono text-muted-foreground">{s.label}</div>
            <div className={cn('text-xl font-bold font-mono mt-1', s.color)}>{s.value}</div>
          </button>
        ))}
      </div>

      {/* Run result */}
      {runResult && <RunResult result={runResult} />}

      {/* Delivery attempts log */}
      {deliveries && deliveries.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <BarChart2 className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-semibold text-foreground">Recent Delivery Attempts</span>
            <span className="text-[11px] font-mono text-muted-foreground/50">{deliveries.length} records</span>
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="divide-y divide-border max-h-48 overflow-y-auto">
              {deliveries.map((d: any) => (
                <div key={d.id} className="flex items-center gap-3 px-4 py-2.5">
                  {d.success
                    ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    : <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                  <span className="text-[11px] font-mono text-foreground truncate flex-1">{d.target_inbox}</span>
                  <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded', d.success ? 'text-emerald-400 bg-emerald-400/8' : 'text-red-400 bg-red-400/8')}>
                    HTTP {d.http_status ?? '—'}
                  </span>
                  {d.duration_ms && <span className="text-[10px] font-mono text-muted-foreground/50">{d.duration_ms}ms</span>}
                  <span className="text-[10px] font-mono text-muted-foreground/40 flex-shrink-0">{timeAgo(d.attempted_at)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Queue filter + list */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-semibold text-foreground">Delivery Queue</span>
          <div className="flex gap-1 ml-2">
            {['all', 'pending', 'retrying', 'delivered', 'failed'].map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={cn('px-2.5 py-1 text-[11px] font-mono rounded border transition-all capitalize',
                  statusFilter === s ? 'bg-primary/10 text-primary border-primary/25' : 'text-muted-foreground border-border hover:bg-muted/60')}>
                {s}
              </button>
            ))}
          </div>
          <span className="ml-auto text-[11px] font-mono text-muted-foreground/50">{queue?.length ?? 0} items</span>
        </div>

        {isLoading ? (
          <div className="bg-card border border-border rounded-xl p-12 flex items-center justify-center gap-2 text-muted-foreground text-sm font-mono">
            <RefreshCw className="w-4 h-4 animate-spin" />Loading queue…
          </div>
        ) : !queue?.length ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <Send className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground font-mono">
              {statusFilter !== 'all' ? `No ${statusFilter} items.` : 'Delivery queue is empty.'}
            </p>
            <p className="text-[11px] font-mono text-muted-foreground/50 mt-1">
              Items appear here when you post, follow, like, or repost Fediverse content.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {queue.map((item) => <QueueRow key={item.id} item={item} />)}
          </div>
        )}
      </div>
    </div>
  );
}
