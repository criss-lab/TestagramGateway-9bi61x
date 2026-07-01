import { Database, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface TableDef {
  name: string;
  desc: string;
  apRole: string;
  color: string;
  columns: Array<{ name: string; type: string; desc: string; nullable?: boolean }>;
}

const TABLES: TableDef[] = [
  {
    name: 'actors', desc: 'Local and remote ActivityPub actors (Person, Service, Group)', apRole: 'Actor Object',
    color: 'border-cyan-400/30 text-cyan-400',
    columns: [
      { name: 'id', type: 'uuid', desc: 'Primary key' },
      { name: 'actor_uri', type: 'text', desc: 'Globally unique AP actor URI (id field)' },
      { name: 'handle', type: 'text', desc: 'Short handle (preferredUsername)' },
      { name: 'actor_type', type: 'text', desc: 'Person | Service | Group | Organization | Application' },
      { name: 'is_local', type: 'boolean', desc: 'true = Testagram user, false = remote actor' },
      { name: 'inbox_url', type: 'text', desc: 'Actor inbox endpoint', nullable: true },
      { name: 'outbox_url', type: 'text', desc: 'Actor outbox endpoint', nullable: true },
      { name: 'shared_inbox_url', type: 'text', desc: 'Instance shared inbox URL', nullable: true },
      { name: 'public_key_pem', type: 'text', desc: 'RSA public key (PEM format)', nullable: true },
      { name: 'private_key_pem', type: 'text', desc: 'RSA private key — local actors only', nullable: true },
      { name: 'manually_approves_followers', type: 'boolean', desc: 'Requires follow approval' },
      { name: 'discoverable', type: 'boolean', desc: 'Appears in directory / search' },
      { name: 'last_fetched_at', type: 'timestamptz', desc: 'Last time profile was refreshed', nullable: true },
    ],
  },
  {
    name: 'activities', desc: 'All ActivityPub activities — inbound and outbound', apRole: 'Activity Object',
    color: 'border-violet-400/30 text-violet-400',
    columns: [
      { name: 'id', type: 'uuid', desc: 'Primary key' },
      { name: 'activity_uri', type: 'text', desc: 'Globally unique activity URI (id field)', nullable: true },
      { name: 'activity_type', type: 'text', desc: 'Create | Update | Delete | Like | Follow | Undo | Accept | Reject | Announce | Block' },
      { name: 'actor_uri', type: 'text', desc: 'AP actor who performed this activity' },
      { name: 'object_uri', type: 'text', desc: 'Target object URI', nullable: true },
      { name: 'object_data', type: 'jsonb', desc: 'Embedded object JSON (for Create, Accept, etc.)' },
      { name: 'direction', type: 'text', desc: 'inbound (received via inbox) or outbound (sent via outbox)' },
      { name: 'processed', type: 'boolean', desc: 'Whether side-effects have been applied' },
      { name: 'raw_payload', type: 'jsonb', desc: 'Original AP JSON-LD payload as received/sent' },
      { name: 'signature_verified', type: 'boolean', desc: 'HTTP Signature verification result' },
    ],
  },
  {
    name: 'objects', desc: 'ActivityPub objects — Notes, Articles, Videos, Images', apRole: 'Object (Note/Article/…)',
    color: 'border-emerald-400/30 text-emerald-400',
    columns: [
      { name: 'id', type: 'uuid', desc: 'Primary key' },
      { name: 'object_uri', type: 'text', desc: 'Globally unique object URI (id field)' },
      { name: 'object_type', type: 'text', desc: 'Note | Article | Video | Image | Question' },
      { name: 'attributed_to', type: 'text', desc: 'Actor URI who authored this object', nullable: true },
      { name: 'content', type: 'text', desc: 'HTML content body', nullable: true },
      { name: 'content_map', type: 'jsonb', desc: 'Language-keyed content variants' },
      { name: 'sensitive', type: 'boolean', desc: 'Content warning flag' },
      { name: 'visibility', type: 'text', desc: 'public | unlisted | private | direct' },
      { name: 'in_reply_to', type: 'text', desc: 'URI of parent object for replies', nullable: true },
      { name: 'conversation', type: 'text', desc: 'Conversation thread URI', nullable: true },
      { name: 'attachment', type: 'jsonb', desc: 'Media attachments array' },
      { name: 'tag', type: 'jsonb', desc: 'Hashtags, mentions, emoji' },
    ],
  },
  {
    name: 'public_keys', desc: 'RSA public keys for HTTP Signature verification', apRole: 'Security Vocabulary',
    color: 'border-amber-400/30 text-amber-400',
    columns: [
      { name: 'id', type: 'uuid', desc: 'Primary key' },
      { name: 'key_id', type: 'text', desc: 'Key URI (actor_uri#main-key)' },
      { name: 'actor_uri', type: 'text', desc: 'Owner actor URI' },
      { name: 'owner', type: 'text', desc: 'Owner field from AP publicKey object' },
      { name: 'public_key_pem', type: 'text', desc: 'PEM-encoded RSA public key' },
      { name: 'algorithm', type: 'text', desc: 'Signature algorithm (RSA-SHA256)' },
    ],
  },
  {
    name: 'delivery_queue', desc: 'Outbound activities awaiting delivery to remote inboxes', apRole: 'Delivery System',
    color: 'border-orange-400/30 text-orange-400',
    columns: [
      { name: 'id', type: 'uuid', desc: 'Primary key' },
      { name: 'activity_type', type: 'text', desc: 'AP activity type (Create, Follow, Like, …)' },
      { name: 'activity_data', type: 'jsonb', desc: 'Full AP JSON-LD payload to deliver' },
      { name: 'target_inbox', type: 'text', desc: 'Remote inbox URL to POST to' },
      { name: 'target_domain', type: 'text', desc: 'Remote domain (for analytics)', nullable: true },
      { name: 'status', type: 'text', desc: 'pending | retrying | delivered | failed' },
      { name: 'attempts', type: 'integer', desc: 'Number of delivery attempts made' },
      { name: 'max_attempts', type: 'integer', desc: 'Maximum attempts before marking failed' },
      { name: 'last_error', type: 'text', desc: 'Last error message from delivery attempt', nullable: true },
      { name: 'scheduled_at', type: 'timestamptz', desc: 'When this delivery is/was scheduled' },
      { name: 'delivered_at', type: 'timestamptz', desc: 'Timestamp of successful delivery', nullable: true },
    ],
  },
  {
    name: 'deliveries', desc: 'Individual delivery attempt log — one row per HTTP request', apRole: 'Audit Log',
    color: 'border-pink-400/30 text-pink-400',
    columns: [
      { name: 'id', type: 'uuid', desc: 'Primary key' },
      { name: 'queue_id', type: 'uuid', desc: 'FK → delivery_queue.id' },
      { name: 'target_inbox', type: 'text', desc: 'Remote inbox URL' },
      { name: 'http_status', type: 'integer', desc: 'HTTP response status code', nullable: true },
      { name: 'response_body', type: 'text', desc: 'Response body (truncated)', nullable: true },
      { name: 'signature_used', type: 'text', desc: 'Key ID used for signing', nullable: true },
      { name: 'duration_ms', type: 'integer', desc: 'Round-trip time in milliseconds', nullable: true },
      { name: 'success', type: 'boolean', desc: 'true if HTTP 2xx response received' },
    ],
  },
  {
    name: 'webfinger_cache', desc: 'Cached WebFinger JRD responses (RFC 7033)', apRole: 'Discovery',
    color: 'border-blue-400/30 text-blue-400',
    columns: [
      { name: 'id', type: 'uuid', desc: 'Primary key' },
      { name: 'resource', type: 'text', desc: 'acct: URI that was looked up' },
      { name: 'subject', type: 'text', desc: 'Canonical subject from JRD', nullable: true },
      { name: 'aliases', type: 'jsonb', desc: 'Alias URIs array from JRD' },
      { name: 'links', type: 'jsonb', desc: 'Links array from JRD response' },
      { name: 'raw_response', type: 'jsonb', desc: 'Full JRD JSON response' },
      { name: 'expires_at', type: 'timestamptz', desc: 'Cache expiry time' },
    ],
  },
  {
    name: 'nodeinfo_cache', desc: 'Cached NodeInfo 2.0/2.1 documents from remote instances', apRole: 'Discovery',
    color: 'border-teal-400/30 text-teal-400',
    columns: [
      { name: 'id', type: 'uuid', desc: 'Primary key' },
      { name: 'domain', type: 'text', desc: 'Instance domain' },
      { name: 'software_name', type: 'text', desc: 'AP software (mastodon, misskey, …)', nullable: true },
      { name: 'software_version', type: 'text', desc: 'Software version string', nullable: true },
      { name: 'protocols', type: 'jsonb', desc: 'Supported protocols array' },
      { name: 'open_registrations', type: 'boolean', desc: 'Whether instance accepts new users', nullable: true },
      { name: 'user_count', type: 'integer', desc: 'Reported total user count', nullable: true },
      { name: 'post_count', type: 'integer', desc: 'Reported local post count', nullable: true },
      { name: 'raw_response', type: 'jsonb', desc: 'Full NodeInfo JSON document' },
      { name: 'expires_at', type: 'timestamptz', desc: 'Cache expiry time' },
    ],
  },
  {
    name: 'blocked_instances', desc: 'Silenced or suspended federation instances', apRole: 'Moderation',
    color: 'border-red-400/30 text-red-400',
    columns: [
      { name: 'id', type: 'uuid', desc: 'Primary key' },
      { name: 'domain', type: 'text', desc: 'Blocked instance domain' },
      { name: 'reason', type: 'text', desc: 'Admin-provided reason', nullable: true },
      { name: 'severity', type: 'text', desc: 'silence | suspend' },
      { name: 'blocked_at', type: 'timestamptz', desc: 'When the block was applied' },
    ],
  },
];

function TableCard({ table }: { table: TableDef }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn('border rounded-xl overflow-hidden transition-all', table.color.split(' ')[0])}>
      <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors text-left"
        onClick={() => setExpanded((p) => !p)}>
        <Database className={cn('w-4 h-4 flex-shrink-0', table.color.split(' ')[1])} />
        <div className="flex-1 min-w-0">
          <div className={cn('text-sm font-mono font-semibold', table.color.split(' ')[1])}>{table.name}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{table.desc}</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={cn('text-[10px] font-mono px-2 py-0.5 rounded border', table.color.split(' ')[0], table.color.split(' ')[1])}>
            {table.apRole}
          </span>
          <span className="text-[11px] font-mono text-muted-foreground/40">{table.columns.length} cols</span>
          {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/20 border-b border-border">
                <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Column</th>
                <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Type</th>
                <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {table.columns.map((col) => (
                <tr key={col.name} className="hover:bg-muted/10">
                  <td className="px-4 py-2 font-mono text-foreground flex items-center gap-1.5">
                    {col.name}
                    {col.nullable && <span className="text-[9px] text-muted-foreground/40">?</span>}
                  </td>
                  <td className="px-4 py-2 font-mono text-amber-400/80">{col.type}</td>
                  <td className="px-4 py-2 text-muted-foreground">{col.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function APSchema() {
  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Database className="w-4 h-4 text-primary" />
        <h1 className="text-sm font-semibold text-foreground">ActivityPub Schema</h1>
        <span className="text-[11px] font-mono text-muted-foreground/50 ml-1">· {TABLES.length} tables</span>
      </div>
      <div className="bg-card border border-border rounded-xl px-4 py-3 text-[11px] font-mono text-muted-foreground leading-relaxed">
        Full database schema for the Testagram ActivityPub gateway. Each table maps to a specific AP concept.
        Content (posts, media) is never stored — only metadata, actor profiles, keys, activities, and delivery state.
      </div>
      <div className="space-y-2">
        {TABLES.map((table) => <TableCard key={table.name} table={table} />)}
      </div>
    </div>
  );
}
