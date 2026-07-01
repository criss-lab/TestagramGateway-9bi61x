/**
 * Health Check + Gateway Status Endpoint
 * Returns comprehensive status of the AP gateway
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsResponse, jsonResponse } from '../_shared/cors.ts';

const DOMAIN = Deno.env.get('GATEWAY_DOMAIN') ?? 'testagram.site';
const VERSION = '1.0.0';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const start = Date.now();

  // Parallel status checks
  const [instances, accounts, activities, queuePending, queueFailed, recentLogs] = await Promise.all([
    supabase.from('federation_instances').select('status', { count: 'exact' }),
    supabase.from('actors').select('*', { count: 'exact', head: true }).eq('is_local', true),
    supabase.from('activities').select('*', { count: 'exact', head: true }),
    supabase.from('delivery_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('delivery_queue').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
    supabase.from('activity_logs').select('status,created_at').order('created_at', { ascending: false }).limit(50),
  ]);

  const instanceList = instances.data ?? [];
  const activeInstances = instanceList.filter((i) => i.status === 'active').length;
  const unhealthyInstances = instanceList.filter((i) => i.status !== 'active').length;

  const recentErrors = (recentLogs.data ?? []).filter((l) => l.status === 'error').length;
  const recentWarnings = (recentLogs.data ?? []).filter((l) => l.status === 'warning').length;

  const dbLatency = Date.now() - start;

  const gatewayStatus = recentErrors > 5 ? 'degraded' : queueFailed.count && queueFailed.count > 10 ? 'partial' : 'healthy';

  const health = {
    status: gatewayStatus,
    timestamp: new Date().toISOString(),
    version: VERSION,
    domain: DOMAIN,
    uptime: 'managed by Supabase Edge Functions',
    database: {
      latency_ms: dbLatency,
      status: dbLatency < 500 ? 'healthy' : 'slow',
    },
    federation: {
      instances: {
        total: instances.count ?? 0,
        active: activeInstances,
        unhealthy: unhealthyInstances,
      },
      actors: {
        local: accounts.count ?? 0,
      },
      activities: {
        total: activities.count ?? 0,
      },
    },
    delivery: {
      pending: queuePending.count ?? 0,
      failed: queueFailed.count ?? 0,
    },
    recent_activity: {
      errors: recentErrors,
      warnings: recentWarnings,
      window: '50 events',
    },
    endpoints: {
      webfinger: `https://${DOMAIN}/.well-known/webfinger`,
      actor: `https://${DOMAIN}/users/testagram`,
      inbox: `https://${DOMAIN}/inbox`,
      outbox: `https://${DOMAIN}/outbox`,
      nodeinfo: `https://${DOMAIN}/.well-known/nodeinfo`,
    },
  };

  return jsonResponse(health, gatewayStatus === 'healthy' ? 200 : 503);
});
