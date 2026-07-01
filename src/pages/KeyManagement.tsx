/**
 * Key Management Page
 * Manage RSA key pairs for ActivityPub actors
 * View public keys cached from remote actors
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Key, Plus, Copy, Eye, EyeOff, RefreshCw, Trash2, Shield,
  CheckCircle, AlertTriangle, Download, Upload, Lock, Unlock, Globe,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn, timeAgo } from '@/lib/utils';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────
interface PublicKey {
  id: string;
  key_id: string;
  actor_uri: string;
  owner: string;
  public_key_pem: string;
  algorithm: string;
  created_at: string;
}

interface APActor {
  id: string;
  actor_uri: string;
  handle: string;
  is_local: boolean;
  display_name: string | null;
  public_key_pem: string | null;
  private_key_pem: string | null;
  created_at: string;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────
function usePublicKeys() {
  return useQuery({
    queryKey: ['public_keys'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('public_keys')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as PublicKey[];
    },
    refetchInterval: 30_000,
  });
}

function useLocalActors() {
  return useQuery({
    queryKey: ['local_actors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('actors')
        .select('id,actor_uri,handle,is_local,display_name,public_key_pem,private_key_pem,created_at')
        .eq('is_local', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as APActor[];
    },
    refetchInterval: 60_000,
  });
}

// ─── Key info parser ──────────────────────────────────────────────────────────
function parsePemMeta(pem: string) {
  if (!pem) return null;
  const lines = pem.split('\n').filter((l) => l.trim());
  const isRsa = pem.includes('RSA');
  const bits = pem.length > 800 ? 2048 : 1024;
  return { type: isRsa ? 'RSA' : 'EC', bits, lines: lines.length };
}

// ─── PEM Viewer ──────────────────────────────────────────────────────────────
function PemViewer({ pem, label }: { pem: string; label: string }) {
  const [visible, setVisible] = useState(false);
  const meta = parsePemMeta(pem);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-mono text-muted-foreground">{label}</span>
        {meta && (
          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-400/8 border border-cyan-400/20 px-1.5 py-0.5 rounded">
            {meta.type}-{meta.bits}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setVisible((p) => !p)}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors">
            {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => { navigator.clipboard.writeText(pem); toast.success(`${label} copied!`); }}
            className="p-1 text-muted-foreground hover:text-primary transition-colors">
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => {
            const blob = new Blob([pem], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `${label.toLowerCase().replace(/\s+/g, '_')}.pem`;
            a.click(); URL.revokeObjectURL(url);
          }} className="p-1 text-muted-foreground hover:text-primary transition-colors">
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <pre className={cn(
        'text-[10px] font-mono rounded px-3 py-2 overflow-auto transition-all',
        visible ? 'text-foreground bg-muted/30 max-h-40' : 'text-muted-foreground/40 bg-muted/10 max-h-12 overflow-hidden select-none'
      )}>
        {visible ? pem : pem.split('\n').slice(0, 2).join('\n') + '\n…'}
      </pre>
    </div>
  );
}

// ─── Add Key Form ─────────────────────────────────────────────────────────────
function AddKeyForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    keyId: 'https://testagram.site/users/testagram#main-key',
    actorUri: 'https://testagram.site/users/testagram',
    owner: 'https://testagram.site/users/testagram',
    publicKeyPem: '',
    algorithm: 'RSA-SHA256',
  });

  const addMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('public_keys').insert({
        key_id: form.keyId,
        actor_uri: form.actorUri,
        owner: form.owner,
        public_key_pem: form.publicKeyPem,
        algorithm: form.algorithm,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Public key added');
      qc.invalidateQueries({ queryKey: ['public_keys'] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="bg-card border border-primary/20 rounded-xl p-4 space-y-3">
      <div className="text-[10px] uppercase tracking-widest text-primary/70 font-mono">Add Public Key</div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-mono text-muted-foreground block mb-1">Key ID *</label>
          <input value={form.keyId} onChange={(e) => setForm({ ...form, keyId: e.target.value })}
            className="w-full px-3 py-1.5 bg-background border border-border rounded text-xs font-mono text-foreground focus:outline-none focus:border-primary/40" />
        </div>
        <div>
          <label className="text-[11px] font-mono text-muted-foreground block mb-1">Algorithm</label>
          <select value={form.algorithm} onChange={(e) => setForm({ ...form, algorithm: e.target.value })}
            className="w-full px-3 py-1.5 bg-background border border-border rounded text-xs font-mono text-foreground focus:outline-none focus:border-primary/40">
            <option value="RSA-SHA256">RSA-SHA256</option>
            <option value="Ed25519">Ed25519</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] font-mono text-muted-foreground block mb-1">Actor URI</label>
          <input value={form.actorUri} onChange={(e) => setForm({ ...form, actorUri: e.target.value })}
            className="w-full px-3 py-1.5 bg-background border border-border rounded text-xs font-mono text-foreground focus:outline-none focus:border-primary/40" />
        </div>
        <div>
          <label className="text-[11px] font-mono text-muted-foreground block mb-1">Owner</label>
          <input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })}
            className="w-full px-3 py-1.5 bg-background border border-border rounded text-xs font-mono text-foreground focus:outline-none focus:border-primary/40" />
        </div>
      </div>
      <div>
        <label className="text-[11px] font-mono text-muted-foreground block mb-1">Public Key PEM *</label>
        <textarea value={form.publicKeyPem} onChange={(e) => setForm({ ...form, publicKeyPem: e.target.value })}
          rows={6} placeholder="-----BEGIN PUBLIC KEY-----&#10;…&#10;-----END PUBLIC KEY-----"
          className="w-full px-3 py-1.5 bg-background border border-border rounded text-[11px] font-mono text-foreground focus:outline-none focus:border-primary/40 resize-none" />
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={() => addMut.mutate()} disabled={addMut.isPending || !form.publicKeyPem.trim()}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {addMut.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
          Add Key
        </button>
        <button onClick={onClose} className="px-4 py-1.5 text-xs text-muted-foreground border border-border rounded hover:bg-muted/60 transition-colors">Cancel</button>
      </div>
    </div>
  );
}

// ─── Fetch Remote Key ─────────────────────────────────────────────────────────
function FetchKeyPanel() {
  const qc = useQueryClient();
  const [actorUrl, setActorUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState<{ keyId: string; pem: string } | null>(null);

  async function fetchKey() {
    if (!actorUrl.trim()) return;
    setLoading(true);
    setFetched(null);
    try {
      const res = await fetch(actorUrl.trim(), {
        headers: { Accept: 'application/activity+json, application/ld+json' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const actor = await res.json();
      const keyId = actor.publicKey?.id ?? `${actorUrl}#main-key`;
      const pem = actor.publicKey?.publicKeyPem;
      if (!pem) throw new Error('No publicKey.publicKeyPem found in actor');

      setFetched({ keyId, pem });

      // Cache in DB
      const { error } = await supabase.from('public_keys').upsert({
        key_id: keyId,
        actor_uri: actorUrl,
        owner: actor.id ?? actorUrl,
        public_key_pem: pem,
        algorithm: 'RSA-SHA256',
      }, { onConflict: 'key_id' });

      if (!error) {
        toast.success('Key fetched and cached!');
        qc.invalidateQueries({ queryKey: ['public_keys'] });
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Globe className="w-4 h-4 text-cyan-400" />
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-mono">Fetch Remote Actor Key</span>
      </div>
      <div className="flex gap-2">
        <input value={actorUrl} onChange={(e) => setActorUrl(e.target.value)}
          placeholder="https://mastodon.social/users/alice"
          className="flex-1 px-3 py-1.5 bg-background border border-border rounded text-xs font-mono text-foreground focus:outline-none focus:border-primary/40" />
        <button onClick={fetchKey} disabled={loading || !actorUrl.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-400/10 border border-cyan-400/25 text-cyan-400 text-xs font-mono rounded hover:bg-cyan-400/20 disabled:opacity-50 transition-colors">
          {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          Fetch
        </button>
      </div>
      {fetched && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] font-mono text-emerald-400">Key fetched and cached in public_keys</span>
          </div>
          <div className="text-[10px] font-mono text-muted-foreground">Key ID: <span className="text-foreground">{fetched.keyId}</span></div>
          <PemViewer pem={fetched.pem} label="Public Key" />
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function KeyManagement() {
  const { data: publicKeys, isLoading: keysLoading } = usePublicKeys();
  const { data: localActors, isLoading: actorsLoading } = useLocalActors();
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPrivate, setShowPrivate] = useState<Record<string, boolean>>({});
  const qc = useQueryClient();

  const deleteKey = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('public_keys').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Key removed');
      qc.invalidateQueries({ queryKey: ['public_keys'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function extractDomain(uri: string) {
    try { return new URL(uri).hostname; } catch { return uri; }
  }

  return (
    <div className="max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-xl">
        <Key className="w-5 h-5 text-amber-400 flex-shrink-0" />
        <div>
          <h1 className="text-sm font-semibold text-foreground">Key Management</h1>
          <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
            Manage RSA key pairs for ActivityPub actors · public_keys + actors tables
          </p>
        </div>
        <button onClick={() => setShowAddForm((p) => !p)}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/25 text-primary text-xs rounded-lg hover:bg-primary/20 transition-colors font-medium">
          <Plus className="w-3.5 h-3.5" />Add Key
        </button>
      </div>

      {showAddForm && <AddKeyForm onClose={() => setShowAddForm(false)} />}

      {/* Fetch remote key */}
      <FetchKeyPanel />

      {/* Local actors with keys */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Lock className="w-4 h-4 text-violet-400" />
          <h2 className="text-sm font-semibold text-foreground">Local Actors</h2>
          <span className="text-[11px] font-mono text-muted-foreground/60">{localActors?.length ?? 0} actors</span>
        </div>
        {actorsLoading ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground font-mono flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />Loading…
          </div>
        ) : !localActors?.length ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <Lock className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground font-mono">No local actors yet. Actors are created when users register with the gateway.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {localActors.map((actor) => (
              <div key={actor.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-violet-400/20 flex items-center justify-center">
                    <Key className="w-4 h-4 text-violet-400" />
                  </div>
                  <div>
                    <div className="text-sm font-mono text-foreground">{actor.handle}</div>
                    <a href={actor.actor_uri} target="_blank" rel="noopener noreferrer"
                      className="text-[11px] font-mono text-primary/70 hover:text-primary">{actor.actor_uri}</a>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-400/8 border border-emerald-400/20 px-1.5 py-0.5 rounded">local</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{timeAgo(actor.created_at)}</span>
                  </div>
                </div>
                {actor.public_key_pem && <PemViewer pem={actor.public_key_pem} label="Public Key" />}
                {actor.private_key_pem && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-red-400">Private Key</span>
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                      <span className="text-[10px] font-mono text-muted-foreground/60">stored securely · never exposed</span>
                      <button onClick={() => setShowPrivate((p) => ({ ...p, [actor.id]: !p[actor.id] }))}
                        className="ml-auto p-1 text-muted-foreground hover:text-foreground">
                        {showPrivate[actor.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    {showPrivate[actor.id] && (
                      <pre className="text-[10px] font-mono text-red-300 bg-red-400/5 border border-red-400/20 rounded px-3 py-2 max-h-24 overflow-auto">
                        {actor.private_key_pem}
                      </pre>
                    )}
                  </div>
                )}
                {!actor.public_key_pem && !actor.private_key_pem && (
                  <div className="flex items-center gap-2 text-[11px] font-mono text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5" />No keys generated yet for this actor
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cached remote public keys */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Unlock className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-foreground">Cached Remote Public Keys</h2>
          <span className="text-[11px] font-mono text-muted-foreground/60">{publicKeys?.length ?? 0} keys</span>
        </div>
        {keysLoading ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground font-mono flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />Loading…
          </div>
        ) : !publicKeys?.length ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <Shield className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground font-mono">No remote public keys cached yet. They appear here when the inbox verifies inbound requests.</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="divide-y divide-border">
              {publicKeys.map((key) => (
                <div key={key.id} className="px-4 py-3 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-3 mb-2">
                    <Globe className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono text-foreground truncate">{extractDomain(key.actor_uri)}</div>
                      <div className="text-[10px] font-mono text-muted-foreground truncate">{key.key_id}</div>
                    </div>
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-400/8 border border-cyan-400/20 px-1.5 py-0.5 rounded">{key.algorithm}</span>
                    <span className="text-[10px] font-mono text-muted-foreground/50">{timeAgo(key.created_at)}</span>
                    <button onClick={() => deleteKey.mutate(key.id)}
                      className="p-1 text-muted-foreground hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <PemViewer pem={key.public_key_pem} label="Public Key PEM" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
