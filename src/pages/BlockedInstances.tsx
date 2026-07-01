import { useState } from 'react';
import { ShieldOff, Plus, Trash2, RefreshCw, AlertTriangle } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { timeAgo, cn } from '@/lib/utils';
import { toast } from 'sonner';

interface BlockedInstance {
  id: string;
  domain: string;
  reason: string | null;
  severity: 'silence' | 'suspend';
  blocked_at: string;
}

export default function BlockedInstances() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ domain: '', reason: '', severity: 'suspend' });
  const [saving, setSaving] = useState(false);

  const { data: blocked, isLoading } = useQuery({
    queryKey: ['blocked_instances'],
    queryFn: async () => {
      const { data, error } = await supabase.from('blocked_instances').select('*').order('blocked_at', { ascending: false });
      if (error) throw error;
      return data as BlockedInstance[];
    },
  });

  async function handleBlock(e: React.FormEvent) {
    e.preventDefault();
    if (!form.domain.trim()) return;
    setSaving(true);
    const domain = form.domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    const { error } = await supabase.from('blocked_instances').insert({
      domain, reason: form.reason || null, severity: form.severity,
    });
    if (error) {
      toast.error(error.message.includes('unique') ? `${domain} is already blocked.` : error.message);
    } else {
      await supabase.from('federation_instances').update({ status: 'suspended' }).eq('domain', domain);
      await supabase.from('activity_logs').insert({
        event_type: 'instance_blocked', module: 'sync',
        description: `Blocked ${domain} (severity: ${form.severity})${form.reason ? ` — ${form.reason}` : ''}`,
        status: 'warning',
      });
      toast.success(`${domain} blocked.`);
      queryClient.invalidateQueries({ queryKey: ['blocked_instances'] });
      queryClient.invalidateQueries({ queryKey: ['federation_instances'] });
      setForm({ domain: '', reason: '', severity: 'suspend' });
      setShowForm(false);
    }
    setSaving(false);
  }

  async function handleUnblock(b: BlockedInstance) {
    if (!confirm(`Unblock ${b.domain}?`)) return;
    await supabase.from('blocked_instances').delete().eq('id', b.id);
    await supabase.from('federation_instances').update({ status: 'active' }).eq('domain', b.domain);
    toast.success(`${b.domain} unblocked.`);
    queryClient.invalidateQueries({ queryKey: ['blocked_instances'] });
    queryClient.invalidateQueries({ queryKey: ['federation_instances'] });
  }

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <ShieldOff className="w-4 h-4 text-red-400" />
          <h1 className="text-sm font-semibold text-foreground">Blocked Instances</h1>
        </div>
        <button onClick={() => setShowForm((p) => !p)}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-red-400/10 border border-red-400/25 text-red-400 text-xs rounded-md hover:bg-red-400/20 transition-colors font-medium">
          <Plus className="w-3.5 h-3.5" />Block Instance
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleBlock} className="bg-card border border-red-400/20 rounded-xl p-4 space-y-3">
          <div className="text-xs font-semibold text-red-400 font-mono mb-1">Block Federation Instance</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[11px] text-muted-foreground font-mono mb-1">Domain *</label>
              <input required value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })}
                placeholder="bad-instance.example.com"
                className="w-full px-3 py-1.5 bg-background border border-border rounded text-sm font-mono text-foreground focus:outline-none focus:border-red-400/40" />
            </div>
            <div>
              <label className="block text-[11px] text-muted-foreground font-mono mb-1">Severity</label>
              <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}
                className="w-full px-3 py-1.5 bg-background border border-border rounded text-sm font-mono text-foreground focus:outline-none focus:border-red-400/40">
                <option value="suspend">Suspend (no federation)</option>
                <option value="silence">Silence (hide from public)</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] text-muted-foreground font-mono mb-1">Reason (optional)</label>
              <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Spam, CSAM, harassment, etc."
                className="w-full px-3 py-1.5 bg-background border border-border rounded text-sm font-mono text-foreground focus:outline-none focus:border-red-400/40" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-red-500 text-white text-xs rounded font-semibold hover:bg-red-600 disabled:opacity-50">
              {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ShieldOff className="w-3 h-3" />}
              {saving ? 'Blocking…' : 'Block Instance'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-1.5 text-xs text-muted-foreground border border-border rounded hover:bg-muted/60">Cancel</button>
          </div>
        </form>
      )}

      {blocked?.length === 0 && !isLoading && (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <ShieldOff className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground font-mono">No instances blocked yet.</p>
        </div>
      )}

      {isLoading && (
        <div className="bg-card border border-border rounded-xl p-12 flex items-center justify-center gap-2 text-muted-foreground font-mono text-sm">
          <RefreshCw className="w-4 h-4 animate-spin" />Loading…
        </div>
      )}

      {(blocked?.length ?? 0) > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="divide-y divide-border">
            {blocked?.map((b) => (
              <div key={b.id} className="flex items-start gap-4 px-4 py-3 hover:bg-muted/20 transition-colors group">
                <AlertTriangle className={cn('w-4 h-4 flex-shrink-0 mt-0.5', b.severity === 'suspend' ? 'text-red-400' : 'text-amber-400')} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-foreground">{b.domain}</span>
                    <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded border',
                      b.severity === 'suspend'
                        ? 'text-red-400 bg-red-400/10 border-red-400/20'
                        : 'text-amber-400 bg-amber-400/10 border-amber-400/20')}>
                      {b.severity}
                    </span>
                  </div>
                  {b.reason && <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{b.reason}</p>}
                  <span className="text-[10px] text-muted-foreground/40 font-mono">Blocked {timeAgo(b.blocked_at)}</span>
                </div>
                <button onClick={() => handleUnblock(b)}
                  className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-1 text-[10px] font-mono rounded border border-red-400/20 text-red-400 hover:bg-red-400/10 transition-all">
                  <Trash2 className="w-3 h-3" />Unblock
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
