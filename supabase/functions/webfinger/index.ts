/**
 * WebFinger Endpoint (RFC 7033)
 * Responds to /.well-known/webfinger?resource=acct:user@domain
 * Allows Mastodon/Fediverse clients to discover Testagram actors
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, corsResponse, errorResponse } from '../_shared/cors.ts';

const DOMAIN = Deno.env.get('GATEWAY_DOMAIN') ?? 'testagram.site';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  const url = new URL(req.url);
  const resource = url.searchParams.get('resource');

  if (!resource) return errorResponse('Missing resource parameter', 400);

  // Parse acct: URI
  let username: string;
  let domain: string;

  if (resource.startsWith('acct:')) {
    const [user, dom] = resource.slice(5).split('@');
    username = user;
    domain = dom;
  } else if (resource.startsWith('https://')) {
    // Handle URL-based resource lookup
    const parsed = new URL(resource);
    domain = parsed.hostname;
    username = parsed.pathname.split('/').pop() ?? '';
  } else {
    return errorResponse('Invalid resource format', 400);
  }

  if (domain !== DOMAIN) {
    return errorResponse('Resource not found on this instance', 404);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Check cache first
  const cacheKey = resource;
  const { data: cached } = await supabase
    .from('webfinger_cache')
    .select('*')
    .eq('resource', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (cached) {
    return new Response(JSON.stringify(cached.raw_response), {
      headers: {
        'Content-Type': 'application/jrd+json',
        ...corsHeaders,
      },
    });
  }

  // Look up actor in database
  const { data: actor } = await supabase
    .from('actors')
    .select('*')
    .eq('handle', username)
    .eq('is_local', true)
    .maybeSingle();

  let actorUri: string;

  if (actor) {
    actorUri = actor.actor_uri;
  } else {
    // Auto-generate based on username (for demo purposes)
    actorUri = `https://${DOMAIN}/users/${username}`;
  }

  const jrd = {
    subject: `acct:${username}@${DOMAIN}`,
    aliases: [actorUri, `https://${DOMAIN}/@${username}`],
    links: [
      {
        rel: 'http://webfinger.net/rel/profile-page',
        type: 'text/html',
        href: `https://${DOMAIN}/@${username}`,
      },
      {
        rel: 'self',
        type: 'application/activity+json',
        href: actorUri,
      },
      {
        rel: 'http://ostatus.org/schema/1.0/subscribe',
        template: `https://${DOMAIN}/authorize_interaction?uri={uri}`,
      },
    ],
  };

  // Cache the result
  await supabase.from('webfinger_cache').upsert({
    resource: cacheKey,
    subject: jrd.subject,
    aliases: jrd.aliases,
    links: jrd.links,
    raw_response: jrd,
    fetched_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  }, { onConflict: 'resource' });

  // Log the lookup
  await supabase.from('activity_logs').insert({
    event_type: 'webfinger_lookup',
    module: 'routes',
    description: `WebFinger lookup: ${resource}`,
    status: 'success',
    metadata: { resource, username, domain },
  });

  return new Response(JSON.stringify(jrd), {
    headers: {
      'Content-Type': 'application/jrd+json',
      'Cache-Control': 'max-age=3600',
      ...corsHeaders,
    },
  });
});
