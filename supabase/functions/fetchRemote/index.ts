/**
 * Remote Fetcher
 * Fetches actor profiles, timelines, followers, and public keys from remote instances
 * Stores metadata only — does NOT persist post content (live federation)
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'POST') return errorResponse('POST required', 405);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON', 400);
  }

  const { type, target } = body as { type: string; target: string };

  switch (type) {
    case 'actor': {
      // Fetch remote actor profile
      const actorUrl = target.startsWith('https://') ? target : `https://${target}`;
      try {
        const res = await fetch(actorUrl, {
          headers: { Accept: 'application/activity+json, application/ld+json' },
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) return errorResponse(`Remote returned ${res.status}`, res.status);

        const actor = await res.json();
        const handle = `@${actor.preferredUsername}@${new URL(actorUrl).hostname}`;
        const domain = new URL(actorUrl).hostname;

        // Upsert into remote_accounts (metadata only)
        await supabase.from('remote_accounts').upsert({
          actor_id: actor.id,
          handle,
          display_name: actor.name ?? actor.preferredUsername,
          bio: typeof actor.summary === 'string'
            ? actor.summary.replace(/<[^>]+>/g, '').slice(0, 500)
            : null,
          avatar_url: actor.icon?.url ?? null,
          instance_domain: domain,
          followers_count: actor.followers ? 0 : 0,
          following_count: actor.following ? 0 : 0,
          posts_count: actor.outbox ? 0 : 0,
          last_fetched_at: new Date().toISOString(),
        }, { onConflict: 'actor_id' });

        // Cache public key
        if (actor.publicKey?.publicKeyPem) {
          await supabase.from('public_keys').upsert({
            key_id: actor.publicKey.id,
            actor_uri: actor.id,
            owner: actor.publicKey.owner,
            public_key_pem: actor.publicKey.publicKeyPem,
          }, { onConflict: 'key_id' });
        }

        // Upsert instance
        await supabase.from('federation_instances').upsert({
          domain,
          status: 'active',
          last_seen_at: new Date().toISOString(),
        }, { onConflict: 'domain', ignoreDuplicates: true });

        await supabase.from('activity_logs').insert({
          event_type: 'remote_actor_fetched',
          module: 'import',
          description: `Fetched and cached actor profile: ${handle}`,
          status: 'success',
          metadata: { actorId: actor.id, handle, domain },
        });

        return jsonResponse({
          status: 'success',
          actor: { id: actor.id, handle, displayName: actor.name, domain },
        });
      } catch (e) {
        return errorResponse(e instanceof Error ? e.message : 'Fetch failed', 500);
      }
    }

    case 'webfinger': {
      // Resolve acct: URI via WebFinger
      const [username, domain] = target.replace('acct:', '').split('@');
      if (!username || !domain) return errorResponse('Invalid acct: format', 400);

      try {
        const res = await fetch(
          `https://${domain}/.well-known/webfinger?resource=acct:${username}@${domain}`,
          {
            headers: { Accept: 'application/jrd+json, application/json' },
            signal: AbortSignal.timeout(8000),
          }
        );
        if (!res.ok) return errorResponse(`WebFinger returned ${res.status}`, res.status);

        const jrd = await res.json();

        // Cache result
        await supabase.from('webfinger_cache').upsert({
          resource: `acct:${username}@${domain}`,
          subject: jrd.subject,
          aliases: jrd.aliases ?? [],
          links: jrd.links ?? [],
          raw_response: jrd,
          fetched_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        }, { onConflict: 'resource' });

        await supabase.from('activity_logs').insert({
          event_type: 'webfinger_resolved',
          module: 'import',
          description: `Resolved WebFinger for @${username}@${domain}`,
          status: 'success',
        });

        return jsonResponse({ status: 'success', webfinger: jrd });
      } catch (e) {
        return errorResponse(e instanceof Error ? e.message : 'WebFinger failed', 500);
      }
    }

    case 'nodeinfo': {
      const domain = target.replace(/^https?:\/\//, '');
      try {
        const wkRes = await fetch(`https://${domain}/.well-known/nodeinfo`, {
          signal: AbortSignal.timeout(6000),
        });
        if (!wkRes.ok) return errorResponse(`NodeInfo discovery failed: ${wkRes.status}`, 502);

        const wk = await wkRes.json();
        const link = wk.links?.find((l: any) => l.rel?.includes('nodeinfo'));
        if (!link) return errorResponse('No NodeInfo link found', 404);

        const niRes = await fetch(link.href, { signal: AbortSignal.timeout(6000) });
        if (!niRes.ok) return errorResponse(`NodeInfo fetch failed: ${niRes.status}`, 502);

        const ni = await niRes.json();

        await supabase.from('nodeinfo_cache').upsert({
          domain,
          software_name: ni.software?.name,
          software_version: ni.software?.version,
          protocols: ni.protocols ?? [],
          open_registrations: ni.openRegistrations,
          user_count: ni.usage?.users?.total,
          post_count: ni.usage?.localPosts,
          raw_response: ni,
          fetched_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
        }, { onConflict: 'domain' });

        await supabase.from('federation_instances').upsert({
          domain,
          software: ni.software?.name?.toLowerCase() ?? 'unknown',
          version: ni.software?.version,
          status: 'active',
          account_count: ni.usage?.users?.total ?? 0,
          post_count: ni.usage?.localPosts ?? 0,
          last_seen_at: new Date().toISOString(),
          inbox_url: `https://${domain}/inbox`,
          shared_inbox_url: `https://${domain}/inbox`,
        }, { onConflict: 'domain' });

        return jsonResponse({ status: 'success', nodeinfo: ni });
      } catch (e) {
        return errorResponse(e instanceof Error ? e.message : 'NodeInfo fetch failed', 500);
      }
    }

    default:
      return errorResponse(`Unknown fetch type: ${type}`, 400);
  }
});
