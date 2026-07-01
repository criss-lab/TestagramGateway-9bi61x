/**
 * Instance Discovery Worker
 * Auto-discovers new Fediverse instances via NodeInfo, WebFinger, and peer lists
 * Seeds discovered instances into federation_instances table
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsResponse, jsonResponse } from '../_shared/cors.ts';

interface NodeInfoResult {
  domain: string;
  software: string;
  version: string;
  userCount: number;
  postCount: number;
  openRegistrations: boolean;
  inboxUrl: string;
  sharedInboxUrl: string;
}

async function fetchNodeInfo(domain: string): Promise<NodeInfoResult | null> {
  try {
    // Step 1: fetch .well-known/nodeinfo
    const wellKnown = await fetch(`https://${domain}/.well-known/nodeinfo`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!wellKnown.ok) return null;

    const wkData = await wellKnown.json();
    const link = (wkData.links ?? []).find((l: any) =>
      l.rel?.includes('nodeinfo.diaspora.software/ns/schema/2')
    );
    if (!link?.href) return null;

    // Step 2: fetch nodeinfo document
    const niRes = await fetch(link.href, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!niRes.ok) return null;

    const ni = await niRes.json();
    const software = ni.software?.name?.toLowerCase() ?? 'unknown';
    const version = ni.software?.version ?? '';
    const userCount = ni.usage?.users?.total ?? 0;
    const postCount = ni.usage?.localPosts ?? 0;

    return {
      domain,
      software,
      version,
      userCount,
      postCount,
      openRegistrations: ni.openRegistrations ?? false,
      inboxUrl: `https://${domain}/inbox`,
      sharedInboxUrl: `https://${domain}/inbox`,
    };
  } catch {
    return null;
  }
}

// Seed list of well-known discovery targets
const DISCOVERY_SEEDS = [
  'mastodon.social', 'fosstodon.org', 'infosec.exchange', 'hachyderm.io',
  'mastodon.online', 'mstdn.social', 'mastodon.world', 'mas.to',
  'pixelfed.social', 'misskey.io', 'lemmy.world', 'lemmy.ml',
  'beehaw.org', 'programming.dev', 'kbin.social', 'bookwyrm.social',
  'threads.net', 'social.coop', 'techhub.social', 'indieweb.social',
  'journalism.social', 'chaos.social', 'functional.cafe', 'ruby.social',
  'flipboard.social', 'masto.ai', 'mastodon.lol', 'vivaldi.net',
  'social.tchncs.de', 'toot.community', 'mastodon.uno', 'universeodon.com',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Get currently known domains
  const { data: existing } = await supabase
    .from('federation_instances')
    .select('domain');
  const knownDomains = new Set((existing ?? []).map((r) => r.domain));

  // Discover new domains from peer lists
  const allTargets = new Set(DISCOVERY_SEEDS);

  // Try to get peer lists from active instances
  const { data: activeInstances } = await supabase
    .from('federation_instances')
    .select('domain')
    .eq('status', 'active')
    .limit(5);

  await Promise.all((activeInstances ?? []).map(async ({ domain }) => {
    try {
      const res = await fetch(`https://${domain}/api/v1/instance/peers`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const peers: string[] = await res.json();
        peers.slice(0, 20).forEach((p) => allTargets.add(p));
      }
    } catch { /* ignore */ }
  }));

  // Filter to only new domains
  const toDiscover = [...allTargets].filter((d) => !knownDomains.has(d)).slice(0, 20);

  if (!toDiscover.length) {
    return jsonResponse({ status: 'up_to_date', discovered: 0, message: 'All known instances already registered' });
  }

  // Fetch NodeInfo in parallel
  const results = await Promise.all(toDiscover.map(fetchNodeInfo));
  const discovered: NodeInfoResult[] = results.filter(Boolean) as NodeInfoResult[];

  if (!discovered.length) {
    return jsonResponse({ status: 'no_new_instances', discovered: 0 });
  }

  // Insert discovered instances
  const toInsert = discovered.map((d) => ({
    domain: d.domain,
    software: d.software,
    version: d.version,
    status: 'active',
    last_seen_at: new Date().toISOString(),
    post_count: d.postCount,
    account_count: d.userCount,
    inbox_url: d.inboxUrl,
    shared_inbox_url: d.sharedInboxUrl,
  }));

  const { error } = await supabase.from('federation_instances')
    .upsert(toInsert, { onConflict: 'domain', ignoreDuplicates: false });

  // Update nodeinfo cache
  await Promise.all(discovered.map((d) =>
    supabase.from('nodeinfo_cache').upsert({
      domain: d.domain,
      software_name: d.software,
      software_version: d.version,
      open_registrations: d.openRegistrations,
      user_count: d.userCount,
      post_count: d.postCount,
      fetched_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
    }, { onConflict: 'domain' })
  ));

  await supabase.from('activity_logs').insert({
    event_type: 'instance_discovery',
    module: 'sync',
    description: `Auto-discovered ${discovered.length} new instance(s): ${discovered.map((d) => d.domain).join(', ')}`,
    status: 'success',
    metadata: { discovered: discovered.map((d) => d.domain), error },
  });

  return jsonResponse({
    status: 'success',
    discovered: discovered.length,
    instances: discovered.map((d) => ({
      domain: d.domain,
      software: d.software,
      version: d.version,
      users: d.userCount,
    })),
  });
});
