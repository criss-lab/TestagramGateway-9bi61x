import { useState } from 'react';
import { cn } from '@/lib/utils';

type LayerKey = 'dashboard' | 'database' | 'storage' | 'edgeFunctions' | 'activityBuilder' | 'httpSig' | 'deliveryQueue' | 'workers' | 'fediverse';

const LAYER_INFO: Record<LayerKey, { title: string; desc: string; items?: string[] }> = {
  dashboard:       { title: 'React Dashboard', desc: 'Admin UI for monitoring and managing all federation modules', items: ['Dashboard','Instances','Import Feed','Export Queue','AP Inspector','Analytics'] },
  database:        { title: 'Supabase Database', desc: 'PostgreSQL — stores all federation state', items: ['actors','activities','objects','delivery_queue','deliveries','public_keys','webfinger_cache','nodeinfo_cache','blocked_instances'] },
  storage:         { title: 'Supabase Storage', desc: 'Object storage for all media', items: ['avatars','images','videos','attachments','emoji','headers'] },
  edgeFunctions:   { title: 'Edge Functions', desc: 'Serverless Deno functions — the AP gateway core', items: ['webfinger','actor','inbox','outbox','nodeinfo','deliver','discover','fetchRemote','health'] },
  activityBuilder: { title: 'Activity Builder', desc: 'Constructs valid AP JSON-LD activities per ActivityStreams 2.0', items: ['Create','Update','Delete','Like','Follow','Undo','Accept','Reject','Announce','Block'] },
  httpSig:         { title: 'HTTP Signature Engine', desc: 'RFC 7235 — signs & verifies all federation requests', items: ['RSA-SHA256 signing','Digest header','Signature verification','Key caching','Replay prevention'] },
  deliveryQueue:   { title: 'Delivery Queue', desc: 'Ordered queue for outbound AP activities', items: ['Pending → Processing','Processing → Delivered','Retrying (backoff)','Failed (max attempts)','Dead letter log'] },
  workers:         { title: 'Federation Workers', desc: 'Scheduled jobs running on a cron', items: ['retry failed deliveries','refresh actor profiles','refresh NodeInfo','discover instances','clean expired cache'] },
  fediverse:       { title: 'Fediverse', desc: 'Remote ActivityPub servers — send and receive activities', items: ['Mastodon','Pixelfed','Misskey','Firefish','PeerTube','Lemmy','Threads','Pleroma','BookWyrm'] },
};

const LAYER_COLOR: Record<LayerKey, string> = {
  dashboard:       'border-cyan-400/30 bg-cyan-400/5 hover:border-cyan-400/50',
  database:        'border-violet-400/30 bg-violet-400/5 hover:border-violet-400/50',
  storage:         'border-blue-400/30 bg-blue-400/5 hover:border-blue-400/50',
  edgeFunctions:   'border-primary/30 bg-primary/5 hover:border-primary/50',
  activityBuilder: 'border-emerald-400/30 bg-emerald-400/5 hover:border-emerald-400/50',
  httpSig:         'border-amber-400/30 bg-amber-400/5 hover:border-amber-400/50',
  deliveryQueue:   'border-orange-400/30 bg-orange-400/5 hover:border-orange-400/50',
  workers:         'border-pink-400/30 bg-pink-400/5 hover:border-pink-400/50',
  fediverse:       'border-red-400/30 bg-red-400/5 hover:border-red-400/50',
};

const LAYER_TEXT: Record<LayerKey, string> = {
  dashboard: 'text-cyan-400', database: 'text-violet-400', storage: 'text-blue-400',
  edgeFunctions: 'text-primary', activityBuilder: 'text-emerald-400', httpSig: 'text-amber-400',
  deliveryQueue: 'text-orange-400', workers: 'text-pink-400', fediverse: 'text-red-400',
};

function LayerBox({ id, children, active, onClick }: { id: LayerKey; children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={cn('w-full text-left rounded-lg border px-3 py-2 transition-all duration-150 cursor-pointer',
        LAYER_COLOR[id], active && 'ring-1 ring-current ring-offset-0')}>
      {children}
    </button>
  );
}

function Arrow({ label, dir = 'down', color = 'text-muted-foreground' }: { label?: string; dir?: 'down' | 'up' | 'both'; color?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 py-0.5">
      {(dir === 'up' || dir === 'both') && <div className={cn('text-[10px] font-mono opacity-60', color)}>↑</div>}
      {label && <span className={cn('text-[9px] font-mono opacity-50 leading-none', color)}>{label}</span>}
      {(dir === 'down' || dir === 'both') && <div className={cn('text-[10px] font-mono opacity-60', color)}>↓</div>}
    </div>
  );
}

export default function ArchitectureDiagram() {
  const [active, setActive] = useState<LayerKey | null>(null);
  const info = active ? LAYER_INFO[active] : null;

  function toggle(key: LayerKey) {
    setActive((prev) => (prev === key ? null : key));
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-mono">
          ActivityPub Gateway · Full Architecture
        </div>
        <span className="text-[10px] font-mono text-muted-foreground/40">click a layer to inspect</span>
      </div>

      <div className="flex gap-4">
        {/* Left: architecture stack */}
        <div className="flex-1 min-w-0 space-y-1">
          {/* Top layer: React Dashboard */}
          <LayerBox id="dashboard" active={active === 'dashboard'} onClick={() => toggle('dashboard')}>
            <div className={cn('text-[11px] font-semibold font-mono', LAYER_TEXT.dashboard)}>React Dashboard</div>
            <div className="text-[10px] text-muted-foreground font-mono mt-0.5">Dashboard · Instances · Import · Export · Inspector · Analytics</div>
          </LayerBox>

          <Arrow dir="both" label="queries / mutations" />

          {/* Middle: Supabase tier */}
          <div className="grid grid-cols-2 gap-2">
            <LayerBox id="database" active={active === 'database'} onClick={() => toggle('database')}>
              <div className={cn('text-[11px] font-semibold font-mono', LAYER_TEXT.database)}>Supabase DB</div>
              <div className="text-[10px] text-muted-foreground font-mono mt-0.5">actors · activities · objects · delivery_queue · public_keys</div>
            </LayerBox>
            <LayerBox id="storage" active={active === 'storage'} onClick={() => toggle('storage')}>
              <div className={cn('text-[11px] font-semibold font-mono', LAYER_TEXT.storage)}>Supabase Storage</div>
              <div className="text-[10px] text-muted-foreground font-mono mt-0.5">avatars · images · videos · attachments</div>
            </LayerBox>
          </div>

          <Arrow dir="both" label="reads / writes" />

          {/* Edge Functions */}
          <LayerBox id="edgeFunctions" active={active === 'edgeFunctions'} onClick={() => toggle('edgeFunctions')}>
            <div className={cn('text-[11px] font-semibold font-mono', LAYER_TEXT.edgeFunctions)}>Supabase Edge Functions</div>
            <div className="grid grid-cols-5 gap-x-4 gap-y-0.5 mt-1">
              {['webfinger','actor','inbox','outbox','nodeinfo','deliver','discover','fetchRemote','health'].map((fn) => (
                <span key={fn} className="text-[10px] font-mono text-muted-foreground">{fn}/</span>
              ))}
            </div>
          </LayerBox>

          <Arrow dir="down" label="builds" />

          {/* Activity Builder + HTTP Sig */}
          <div className="grid grid-cols-2 gap-2">
            <LayerBox id="activityBuilder" active={active === 'activityBuilder'} onClick={() => toggle('activityBuilder')}>
              <div className={cn('text-[11px] font-semibold font-mono', LAYER_TEXT.activityBuilder)}>Activity Builder</div>
              <div className="text-[10px] text-muted-foreground font-mono mt-0.5">Create · Like · Follow · Announce · Undo · Accept</div>
            </LayerBox>
            <LayerBox id="httpSig" active={active === 'httpSig'} onClick={() => toggle('httpSig')}>
              <div className={cn('text-[11px] font-semibold font-mono', LAYER_TEXT.httpSig)}>HTTP Sig Engine</div>
              <div className="text-[10px] text-muted-foreground font-mono mt-0.5">RSA-SHA256 · Digest · Verify · Replay-safe</div>
            </LayerBox>
          </div>

          <Arrow dir="down" label="enqueues" />

          {/* Delivery Queue */}
          <LayerBox id="deliveryQueue" active={active === 'deliveryQueue'} onClick={() => toggle('deliveryQueue')}>
            <div className={cn('text-[11px] font-semibold font-mono', LAYER_TEXT.deliveryQueue)}>Delivery Queue</div>
            <div className="flex items-center gap-4 mt-1">
              {['Pending','Processing','Delivered','Retrying','Failed'].map((s, i) => (
                <span key={s} className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                  {i > 0 && <span className="opacity-30">→</span>}
                  {s}
                </span>
              ))}
            </div>
          </LayerBox>

          <Arrow dir="both" label="triggers / retries" />

          {/* Workers */}
          <LayerBox id="workers" active={active === 'workers'} onClick={() => toggle('workers')}>
            <div className={cn('text-[11px] font-semibold font-mono', LAYER_TEXT.workers)}>Federation Workers</div>
            <div className="text-[10px] text-muted-foreground font-mono mt-0.5">retry failures · refresh actors · refresh NodeInfo · discover · cleanup</div>
          </LayerBox>

          <Arrow dir="both" label="HTTP Signed requests" />

          {/* Fediverse */}
          <LayerBox id="fediverse" active={active === 'fediverse'} onClick={() => toggle('fediverse')}>
            <div className={cn('text-[11px] font-semibold font-mono', LAYER_TEXT.fediverse)}>Fediverse</div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
              {['Mastodon','Pixelfed','Misskey','Firefish','PeerTube','Lemmy','Threads','Pleroma'].map((p) => (
                <span key={p} className="text-[10px] font-mono text-muted-foreground">{p}</span>
              ))}
            </div>
          </LayerBox>
        </div>

        {/* Right: detail panel */}
        <div className="w-48 flex-shrink-0">
          <div className="sticky top-0 space-y-2">
            {info ? (
              <div className={cn('border rounded-xl p-3.5 space-y-2', active && LAYER_COLOR[active!])}>
                <div className={cn('text-[11px] font-semibold font-mono', active && LAYER_TEXT[active!])}>{info.title}</div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{info.desc}</p>
                {info.items && (
                  <ul className="space-y-1 pt-1 border-t border-border/40">
                    {info.items.map((item) => (
                      <li key={item} className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
                        <div className={cn('w-1 h-1 rounded-full flex-shrink-0', active && LAYER_TEXT[active!])} style={{ background: 'currentColor' }} />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="border border-dashed border-border rounded-xl p-3.5 text-center">
                <div className="text-[10px] font-mono text-muted-foreground/40 leading-relaxed">
                  Click any layer to see details about that component
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="border border-border rounded-xl p-3 space-y-1.5">
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground/40 font-mono mb-2">Layers</div>
              {(Object.keys(LAYER_INFO) as LayerKey[]).map((k) => (
                <button key={k} onClick={() => toggle(k)}
                  className={cn('flex items-center gap-1.5 w-full text-left text-[10px] font-mono transition-colors',
                    active === k ? LAYER_TEXT[k] : 'text-muted-foreground hover:text-foreground')}>
                  <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', LAYER_TEXT[k])} style={{ background: 'currentColor' }} />
                  {LAYER_INFO[k].title.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
