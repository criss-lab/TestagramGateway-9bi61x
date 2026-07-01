/**
 * NodeInfo Endpoint (nodeinfo 2.0 / 2.1)
 * GET /.well-known/nodeinfo — returns discovery document
 * GET /nodeinfo/2.1 — returns full NodeInfo document
 * Required for federation compatibility with Mastodon, Misskey, etc.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsResponse, jsonResponse } from '../_shared/cors.ts';

const DOMAIN = Deno.env.get('GATEWAY_DOMAIN') ?? 'testagram.site';
const VERSION = '1.0.0';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  const url = new URL(req.url);
  const path = url.searchParams.get('path') ?? url.pathname;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Well-known discovery
  if (path.includes('well-known') || path.includes('discovery')) {
    const discovery = {
      links: [
        {
          rel: 'http://nodeinfo.diaspora.software/ns/schema/2.0',
          href: `https://${DOMAIN}/nodeinfo/2.0`,
        },
        {
          rel: 'http://nodeinfo.diaspora.software/ns/schema/2.1',
          href: `https://${DOMAIN}/nodeinfo/2.1`,
        },
      ],
    };
    return jsonResponse(discovery);
  }

  // Fetch stats from database
  const [usersResult, postsResult] = await Promise.all([
    supabase.from('actors').select('*', { count: 'exact', head: true }).eq('is_local', true),
    supabase.from('objects').select('*', { count: 'exact', head: true }),
  ]);

  const userCount = usersResult.count ?? 0;
  const postCount = postsResult.count ?? 0;

  const nodeInfo = {
    version: '2.1',
    software: {
      name: 'testagramgateway',
      version: VERSION,
      repository: 'https://github.com/criss-lab/TestagramGateway',
      homepage: `https://${DOMAIN}`,
    },
    protocols: ['activitypub'],
    usage: {
      users: {
        total: userCount,
        activeMonth: userCount,
        activeHalfyear: userCount,
      },
      localPosts: postCount,
      localComments: 0,
    },
    openRegistrations: false,
    metadata: {
      nodeName: 'Testagram Gateway',
      nodeDescription: 'ActivityPub federation gateway for Testagram — testagram.site',
      maintainer: { name: 'Testagram Team', email: 'admin@testagram.site' },
      langs: ['en'],
      federation: {
        enabled: true,
        exclusions: [],
        quarantinedInstances: [],
      },
      features: [
        'activitypub',
        'webfinger',
        'nodeinfo',
        'http-signatures',
        'shared-inbox',
        'media-proxy',
      ],
    },
  };

  await supabase.from('activity_logs').insert({
    event_type: 'nodeinfo_fetch',
    module: 'routes',
    description: `NodeInfo fetched by remote server`,
    status: 'success',
  });

  return jsonResponse(nodeInfo);
});
