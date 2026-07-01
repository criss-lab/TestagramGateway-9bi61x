import { useState } from 'react';
import { Code2, RefreshCw, Send, Hash, Globe, Key, Cpu, ChevronRight, ChevronDown, Copy, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

type Tab = 'builder' | 'webfinger' | 'actor' | 'nodeinfo' | 'raw';

const AP_TEMPLATES: Record<string, object> = {
  Create: {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: 'https://testagram.site/notes/example-id/activity',
    type: 'Create',
    actor: 'https://testagram.site/users/testagram',
    published: new Date().toISOString(),
    to: ['https://www.w3.org/ns/activitystreams#Public'],
    cc: ['https://testagram.site/users/testagram/followers'],
    object: {
      id: 'https://testagram.site/notes/example-id',
      type: 'Note',
      attributedTo: 'https://testagram.site/users/testagram',
      content: '<p>Hello Fediverse from testagram.site!</p>',
      published: new Date().toISOString(),
      to: ['https://www.w3.org/ns/activitystreams#Public'],
      cc: ['https://testagram.site/users/testagram/followers'],
      tag: [{ type: 'Hashtag', name: '#testagram', href: 'https://testagram.site/tags/testagram' }],
    },
  },
  Follow: {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: 'https://testagram.site/users/testagram#follows/alice',
    type: 'Follow',
    actor: 'https://testagram.site/users/testagram',
    object: 'https://mastodon.social/users/alice_dev',
  },
  Like: {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: 'https://testagram.site/users/testagram#likes/example',
    type: 'Like',
    actor: 'https://testagram.site/users/testagram',
    object: 'https://mastodon.social/users/alice_dev/statuses/001',
  },
  Announce: {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: 'https://testagram.site/users/testagram#announces/example',
    type: 'Announce',
    actor: 'https://testagram.site/users/testagram',
    published: new Date().toISOString(),
    to: ['https://www.w3.org/ns/activitystreams#Public'],
    cc: ['https://testagram.site/users/testagram/followers'],
    object: 'https://mastodon.social/users/alice_dev/statuses/001',
  },
  Accept: {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: 'https://testagram.site/users/testagram#accepts/follow',
    type: 'Accept',
    actor: 'https://testagram.site/users/testagram',
    object: {
      id: 'https://mastodon.social/users/alice#follows/testagram',
      type: 'Follow',
      actor: 'https://mastodon.social/users/alice',
      object: 'https://testagram.site/users/testagram',
    },
  },
  Delete: {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: 'https://testagram.site/notes/example-id#delete',
    type: 'Delete',
    actor: 'https://testagram.site/users/testagram',
    to: ['https://www.w3.org/ns/activitystreams#Public'],
    object: { id: 'https://testagram.site/notes/example-id', type: 'Tombstone' },
  },
};

function JsonNode({ value, depth = 0 }: { value: unknown; depth?: number }) {
  const [collapsed, setCollapsed] = useState(false);
  const indent = depth * 12;

  if (value === null) return <span className="text-rose-400 font-mono text-xs">null</span>;
  if (typeof value === 'boolean') return <span className="text-amber-400 font-mono text-xs">{String(value)}</span>;
  if (typeof value === 'number') return <span className="text-sky-400 font-mono text-xs">{value}</span>;
  if (typeof value === 'string') {
    if (value.startsWith('https://') || value.startsWith('http://')) {
      return <a href={value} target="_blank" rel="noopener noreferrer" className="text-cyan-400 font-mono text-xs hover:underline break-all">{JSON.stringify(value)}</a>;
    }
    return <span className="text-emerald-400 font-mono text-xs break-all">{JSON.stringify(value)}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground font-mono text-xs">[]</span>;
    return (
      <span>
        <button onClick={() => setCollapsed((p) => !p)} className="text-muted-foreground hover:text-foreground transition-colors">
          {collapsed ? <ChevronRight className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />}
        </button>
        {collapsed ? (
          <span className="text-muted-foreground font-mono text-xs">[…{value.length}]</span>
        ) : (
          <span>
            <span className="text-foreground font-mono text-xs">[</span>
            <div style={{ marginLeft: indent + 12 }}>
              {value.map((item, i) => (
                <div key={i}>
                  <JsonNode value={item} depth={depth + 1} />
                  {i < value.length - 1 && <span className="text-muted-foreground font-mono text-xs">,</span>}
                </div>
              ))}
            </div>
            <span className="text-foreground font-mono text-xs">]</span>
          </span>
        )}
      </span>
    );
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as object);
    if (entries.length === 0) return <span className="text-muted-foreground font-mono text-xs">{'{}'}</span>;
    return (
      <span>
        <button onClick={() => setCollapsed((p) => !p)} className="text-muted-foreground hover:text-foreground transition-colors">
          {collapsed ? <ChevronRight className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />}
        </button>
        {collapsed ? (
          <span className="text-muted-foreground font-mono text-xs">{'{…}'}</span>
        ) : (
          <span>
            <span className="text-foreground font-mono text-xs">{'{'}</span>
            <div style={{ marginLeft: indent + 12 }}>
              {entries.map(([key, val], i) => (
                <div key={key}>
                  <span className="text-violet-300 font-mono text-xs">"{key}"</span>
                  <span className="text-muted-foreground font-mono text-xs">: </span>
                  <JsonNode value={val} depth={depth + 1} />
                  {i < entries.length - 1 && <span className="text-muted-foreground font-mono text-xs">,</span>}
                </div>
              ))}
            </div>
            <span className="text-foreground font-mono text-xs">{'}'}</span>
          </span>
        )}
      </span>
    );
  }

  return <span className="text-muted-foreground font-mono text-xs">{String(value)}</span>;
}

export default function PayloadInspector() {
  const [tab, setTab] = useState<Tab>('builder');
  const [selectedTemplate, setSelectedTemplate] = useState('Create');
  const [rawInput, setRawInput] = useState(JSON.stringify(AP_TEMPLATES.Create, null, 2));
  const [parsed, setParsed] = useState<object | null>(AP_TEMPLATES.Create);
  const [parseError, setParseError] = useState<string | null>(null);
  const [wfHandle, setWfHandle] = useState('@alice@mastodon.social');
  const [wfResult, setWfResult] = useState<object | null>(null);
  const [wfLoading, setWfLoading] = useState(false);
  const [actorUrl, setActorUrl] = useState('https://mastodon.social/users/alice');
  const [actorResult, setActorResult] = useState<object | null>(null);
  const [actorLoading, setActorLoading] = useState(false);
  const [nodeDomain, setNodeDomain] = useState('mastodon.social');
  const [nodeResult, setNodeResult] = useState<object | null>(null);
  const [nodeLoading, setNodeLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  function loadTemplate(name: string) {
    const t = AP_TEMPLATES[name];
    setSelectedTemplate(name);
    setRawInput(JSON.stringify(t, null, 2));
    setParsed(t);
    setParseError(null);
  }

  function handleRawChange(val: string) {
    setRawInput(val);
    try {
      const p = JSON.parse(val);
      setParsed(p);
      setParseError(null);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Parse error');
      setParsed(null);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(rawInput);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function resolveWebFinger() {
    setWfLoading(true);
    setWfResult(null);
    try {
      const clean = wfHandle.replace(/^@/, '');
      const [user, domain] = clean.split('@');
      if (!user || !domain) { toast.error('Format: @user@domain'); return; }
      const res = await fetch(`https://${domain}/.well-known/webfinger?resource=acct:${user}@${domain}`, {
        headers: { Accept: 'application/jrd+json, application/json' },
      });
      const data = await res.json();
      setWfResult(data);

      await supabase.from('webfinger_cache').upsert({
        resource: `acct:${user}@${domain}`, subject: data.subject,
        aliases: data.aliases ?? [], links: data.links ?? [],
        raw_response: data, fetched_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      }, { onConflict: 'resource' });
      await supabase.from('activity_logs').insert({
        event_type: 'webfinger_lookup', module: 'routes',
        description: `WebFinger resolved: acct:${user}@${domain}`, status: 'success',
      });
      queryClient.invalidateQueries({ queryKey: ['activity_logs'] });
      toast.success(`Resolved @${user}@${domain}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'WebFinger failed');
    } finally {
      setWfLoading(false);
    }
  }

  async function fetchActor() {
    setActorLoading(true);
    setActorResult(null);
    try {
      const res = await fetch(actorUrl, { headers: { Accept: 'application/activity+json, application/ld+json' } });
      const data = await res.json();
      setActorResult(data);

      const domain = new URL(actorUrl).hostname;
      const handle = `@${data.preferredUsername}@${domain}`;
      await supabase.from('remote_accounts').upsert({
        actor_id: data.id, handle,
        display_name: data.name ?? data.preferredUsername,
        bio: typeof data.summary === 'string' ? data.summary.replace(/<[^>]+>/g, '').slice(0, 500) : null,
        avatar_url: data.icon?.url ?? null, instance_domain: domain,
        last_fetched_at: new Date().toISOString(),
      }, { onConflict: 'actor_id' });

      if (data.publicKey?.publicKeyPem) {
        await supabase.from('public_keys').upsert({
          key_id: data.publicKey.id, actor_uri: data.id, owner: data.publicKey.owner,
          public_key_pem: data.publicKey.publicKeyPem,
        }, { onConflict: 'key_id' });
      }
      queryClient.invalidateQueries({ queryKey: ['remote_accounts'] });
      toast.success(`Fetched actor: ${handle}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Actor fetch failed');
    } finally {
      setActorLoading(false);
    }
  }

  async function fetchNodeInfo() {
    setNodeLoading(true);
    setNodeResult(null);
    try {
      const domain = nodeDomain.replace(/^https?:\/\//, '');
      const wkRes = await fetch(`https://${domain}/.well-known/nodeinfo`);
      const wk = await wkRes.json();
      const link = wk.links?.find((l: any) => l.rel?.includes('nodeinfo'));
      const niRes = await fetch(link.href);
      const ni = await niRes.json();
      setNodeResult(ni);

      await supabase.from('nodeinfo_cache').upsert({
        domain, software_name: ni.software?.name, software_version: ni.software?.version,
        protocols: ni.protocols ?? [], open_registrations: ni.openRegistrations,
        user_count: ni.usage?.users?.total, post_count: ni.usage?.localPosts,
        raw_response: ni, fetched_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 21600000).toISOString(),
      }, { onConflict: 'domain' });
      await supabase.from('federation_instances').upsert({
        domain, software: ni.software?.name?.toLowerCase() ?? 'unknown',
        version: ni.software?.version, status: 'active',
        account_count: ni.usage?.users?.total ?? 0, post_count: ni.usage?.localPosts ?? 0,
        last_seen_at: new Date().toISOString(),
        inbox_url: `https://${domain}/inbox`, shared_inbox_url: `https://${domain}/inbox`,
      }, { onConflict: 'domain' });
      queryClient.invalidateQueries({ queryKey: ['federation_instances'] });
      toast.success(`NodeInfo fetched for ${domain}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'NodeInfo failed');
    } finally {
      setNodeLoading(false);
    }
  }

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'builder', label: 'Activity Builder', icon: Cpu },
    { key: 'webfinger', label: 'WebFinger', icon: Hash },
    { key: 'actor', label: 'Actor API', icon: Globe },
    { key: 'nodeinfo', label: 'NodeInfo', icon: Key },
    { key: 'raw', label: 'Raw Inspector', icon: Code2 },
  ];

  return (
    <div className="max-w-5xl space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn('flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono transition-all flex-1 justify-center',
              tab === key ? 'bg-primary/10 text-primary border border-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent')}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {/* Activity Builder */}
      {tab === 'builder' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground/60 font-mono mb-2">AP Activity Template</div>
              <div className="flex flex-wrap gap-1.5">
                {Object.keys(AP_TEMPLATES).map((name) => (
                  <button key={name} onClick={() => loadTemplate(name)}
                    className={cn('px-2.5 py-1 rounded text-xs font-mono border transition-all',
                      selectedTemplate === name ? 'bg-primary/15 text-primary border-primary/30' : 'text-muted-foreground border-border hover:bg-muted/60')}>
                    {name}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-mono text-muted-foreground">Edit payload</span>
                <button onClick={handleCopy} className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors">
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <textarea value={rawInput} onChange={(e) => handleRawChange(e.target.value)} rows={20}
                spellCheck={false}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-xs font-mono text-foreground focus:outline-none focus:border-primary/40 resize-none leading-relaxed" />
              {parseError && (
                <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-red-400">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />{parseError}
                </div>
              )}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground/60 font-mono mb-2">Visual Inspector</div>
            <div className="bg-background border border-border rounded-lg p-4 overflow-auto max-h-[560px] leading-relaxed">
              {parsed ? <JsonNode value={parsed} /> : <span className="text-red-400 text-xs font-mono">Invalid JSON</span>}
            </div>
          </div>
        </div>
      )}

      {/* WebFinger Resolver */}
      {tab === 'webfinger' && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs font-semibold text-foreground mb-3">WebFinger Resolver · RFC 7033</div>
            <div className="flex gap-2">
              <input value={wfHandle} onChange={(e) => setWfHandle(e.target.value)}
                placeholder="@alice@mastodon.social or acct:alice@mastodon.social"
                className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono text-foreground focus:outline-none focus:border-primary/40" />
              <button onClick={resolveWebFinger} disabled={wfLoading}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50">
                {wfLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Resolve
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground font-mono mt-2">
              Fetches the JRD document from /.well-known/webfinger and caches it in Supabase
            </p>
          </div>
          {wfResult && (
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs font-semibold text-foreground mb-3">WebFinger Response</div>
              <div className="bg-background border border-border rounded-lg p-4 overflow-auto max-h-96">
                <JsonNode value={wfResult} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actor Fetch */}
      {tab === 'actor' && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs font-semibold text-foreground mb-3">Actor API Fetcher · AP Person / Service</div>
            <div className="flex gap-2">
              <input value={actorUrl} onChange={(e) => setActorUrl(e.target.value)}
                placeholder="https://mastodon.social/users/alice"
                className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono text-foreground focus:outline-none focus:border-primary/40" />
              <button onClick={fetchActor} disabled={actorLoading}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50">
                {actorLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}Fetch
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground font-mono mt-2">
              Fetches an AP actor JSON-LD document, caches account metadata and public key in Supabase
            </p>
          </div>
          {actorResult && (
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs font-semibold text-foreground mb-3">Actor JSON-LD Response</div>
              <div className="bg-background border border-border rounded-lg p-4 overflow-auto max-h-96">
                <JsonNode value={actorResult} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* NodeInfo */}
      {tab === 'nodeinfo' && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs font-semibold text-foreground mb-3">NodeInfo Fetcher · nodeinfo 2.0 / 2.1</div>
            <div className="flex gap-2">
              <input value={nodeDomain} onChange={(e) => setNodeDomain(e.target.value)}
                placeholder="mastodon.social"
                className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono text-foreground focus:outline-none focus:border-primary/40" />
              <button onClick={fetchNodeInfo} disabled={nodeLoading}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50">
                {nodeLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}Fetch
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground font-mono mt-2">
              Fetches /.well-known/nodeinfo then the schema document. Upserts instance info and caches NodeInfo in Supabase
            </p>
          </div>
          {nodeResult && (
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs font-semibold text-foreground mb-3">NodeInfo Response</div>
              <div className="bg-background border border-border rounded-lg p-4 overflow-auto max-h-96">
                <JsonNode value={nodeResult} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Raw Inspector */}
      {tab === 'raw' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">Raw JSON Input</span>
              <button onClick={handleCopy} className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground">
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <textarea value={rawInput} onChange={(e) => handleRawChange(e.target.value)} rows={30}
              placeholder="Paste any AP payload here…"
              spellCheck={false}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-xs font-mono text-foreground focus:outline-none focus:border-primary/40 resize-none" />
          </div>
          <div>
            <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Interactive Tree View</div>
            <div className="bg-background border border-border rounded-lg p-4 overflow-auto h-[calc(100%-2rem)] leading-loose">
              {parsed
                ? <JsonNode value={parsed} />
                : <span className="text-red-400 text-xs font-mono">{parseError ?? 'Enter JSON to inspect'}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
