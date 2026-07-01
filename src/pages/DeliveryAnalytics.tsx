import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area,
} from 'recharts';
import { TrendingUp, Send, CheckCircle2, XCircle, Clock, RefreshCw } from 'lucide-react';
import { useDeliveryQueue } from '@/hooks/useDeliveryQueue';
import { useActivityLogs } from '@/hooks/useActivityLogs';
import { formatNumber, cn } from '@/lib/utils';

const STATUS_COLORS: Record<string, string> = {
  delivered: '#34d399',
  pending:   '#38bdf8',
  retrying:  '#fbbf24',
  failed:    '#f87171',
};

const ACTIVITY_COLORS: Record<string, string> = {
  Create:   '#34d399',
  Follow:   '#a78bfa',
  Like:     '#f472b6',
  Announce: '#22d3ee',
  Delete:   '#f87171',
  Undo:     '#fbbf24',
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs font-mono shadow-lg">
      <div className="text-foreground font-semibold mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground capitalize">{p.name}:</span>
          <span className="text-foreground">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function DeliveryAnalytics() {
  const { data: allItems, isLoading } = useDeliveryQueue('all');
  const { data: logs } = useActivityLogs(100);

  // Status distribution for pie chart
  const statusData = useMemo(() => {
    if (!allItems) return [];
    const counts: Record<string, number> = {};
    allItems.forEach((i) => { counts[i.status] = (counts[i.status] ?? 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [allItems]);

  // Activity type distribution
  const activityTypeData = useMemo(() => {
    if (!allItems) return [];
    const counts: Record<string, number> = {};
    allItems.forEach((i) => { counts[i.activity_type] = (counts[i.activity_type] ?? 0) + 1; });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [allItems]);

  // Domain distribution
  const domainData = useMemo(() => {
    if (!allItems) return [];
    const counts: Record<string, Record<string, number>> = {};
    allItems.forEach((i) => {
      const d = i.target_domain ?? 'unknown';
      if (!counts[d]) counts[d] = { delivered: 0, failed: 0, pending: 0, retrying: 0 };
      counts[d][i.status] = (counts[d][i.status] ?? 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => Object.values(b[1]).reduce((s, v) => s + v, 0) - Object.values(a[1]).reduce((s, v) => s + v, 0))
      .slice(0, 8)
      .map(([domain, stats]) => ({ domain: domain.replace('.social', '').replace('.org', '').replace('.io', ''), ...stats }));
  }, [allItems]);

  // Activity log timeline (module events over time bucketed by hour)
  const timelineData = useMemo(() => {
    if (!logs) return [];
    const buckets: Record<string, { time: string; import: number; export: number; sync: number }> = {};
    logs.forEach((log) => {
      const d = new Date(log.created_at);
      const key = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:00`;
      if (!buckets[key]) buckets[key] = { time: key, import: 0, export: 0, sync: 0 };
      const m = log.module as 'import' | 'export' | 'sync';
      if (m in buckets[key]) buckets[key][m]++;
    });
    return Object.values(buckets).slice(-12);
  }, [logs]);

  // Attempt distribution
  const attemptData = useMemo(() => {
    if (!allItems) return [];
    const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
    allItems.forEach((i) => {
      const k = Math.min(i.attempts, 3);
      counts[k] = (counts[k] ?? 0) + 1;
    });
    return Object.entries(counts).map(([attempts, count]) => ({
      attempts: attempts === '3' ? '3+' : `${attempts}`,
      count,
    }));
  }, [allItems]);

  // KPI numbers
  const successRate = useMemo(() => {
    if (!allItems?.length) return 0;
    const delivered = allItems.filter((i) => i.status === 'delivered').length;
    return Math.round((delivered / allItems.length) * 100);
  }, [allItems]);

  const avgAttempts = useMemo(() => {
    if (!allItems?.length) return 0;
    return (allItems.reduce((s, i) => s + i.attempts, 0) / allItems.length).toFixed(1);
  }, [allItems]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-muted-foreground text-sm font-mono">
        <RefreshCw className="w-4 h-4 animate-spin" /> Loading analytics…
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-emerald-400/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-muted-foreground">Success Rate</span>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-300">{successRate}%</div>
          <div className="text-[11px] font-mono text-muted-foreground mt-1">delivered / total</div>
        </div>
        <div className="bg-card border border-cyan-400/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Send className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-muted-foreground">Total Queued</span>
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-300">{formatNumber(allItems?.length ?? 0)}</div>
          <div className="text-[11px] font-mono text-muted-foreground mt-1">all-time activities</div>
        </div>
        <div className="bg-card border border-red-400/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-4 h-4 text-red-400" />
            <span className="text-xs text-muted-foreground">Failed</span>
          </div>
          <div className="text-2xl font-bold font-mono text-red-300">
            {formatNumber(allItems?.filter((i) => i.status === 'failed').length ?? 0)}
          </div>
          <div className="text-[11px] font-mono text-muted-foreground mt-1">need attention</div>
        </div>
        <div className="bg-card border border-amber-400/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-muted-foreground">Avg Attempts</span>
          </div>
          <div className="text-2xl font-bold font-mono text-amber-300">{avgAttempts}</div>
          <div className="text-[11px] font-mono text-muted-foreground mt-1">per delivery item</div>
        </div>
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Status pie */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-mono mb-4">Delivery Status</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
              >
                {statusData.map((entry) => (
                  <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? '#6b7280'} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(v) => <span className="text-xs font-mono text-muted-foreground capitalize">{v}</span>}
                iconSize={8}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Activity type bar */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-mono mb-4">Activity Types</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={activityTypeData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#6b7280' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {activityTypeData.map((entry) => (
                  <Cell key={entry.name} fill={ACTIVITY_COLORS[entry.name] ?? '#6b7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Retry attempts */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-mono mb-4">Attempt Distribution</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={attemptData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="attempts" tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#6b7280' }}
                label={{ value: 'Attempts', position: 'insideBottom', offset: -2, fontSize: 10, fill: '#6b7280', fontFamily: 'monospace' }} />
              <YAxis tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#6b7280' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill="#38bdf8" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Domain breakdown stacked bar */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-mono mb-4">Deliveries by Domain</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={domainData} margin={{ top: 0, right: 0, left: -15, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="domain"
                tick={{ fontSize: 9, fontFamily: 'monospace', fill: '#6b7280' }}
                angle={-30}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#6b7280' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="delivered" stackId="a" fill="#34d399" />
              <Bar dataKey="pending"   stackId="a" fill="#38bdf8" />
              <Bar dataKey="retrying"  stackId="a" fill="#fbbf24" />
              <Bar dataKey="failed"    stackId="a" fill="#f87171" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Module activity timeline */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-mono mb-4">Module Activity Timeline</div>
          {timelineData.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground font-mono">
              Not enough data for timeline.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={timelineData} margin={{ top: 0, right: 0, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="importGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="exportGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="syncGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#fbbf24" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" tick={{ fontSize: 9, fontFamily: 'monospace', fill: '#6b7280' }} />
                <YAxis tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#6b7280' }} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="import" stroke="#a78bfa" fill="url(#importGrad)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="export" stroke="#34d399" fill="url(#exportGrad)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="sync"   stroke="#fbbf24" fill="url(#syncGrad)"   strokeWidth={1.5} />
                <Legend formatter={(v) => <span className="text-xs font-mono text-muted-foreground capitalize">{v}</span>} iconSize={8} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
