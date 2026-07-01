/**
 * Delivery Worker
 * Processes pending items in the delivery_queue
 * Signs and sends ActivityPub activities to remote inboxes
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsResponse, jsonResponse } from '../_shared/cors.ts';
import { signRequest } from '../_shared/httpSignature.ts';

const DOMAIN = Deno.env.get('GATEWAY_DOMAIN') ?? 'testagram.site';
const ACTOR_URI = `https://${DOMAIN}/users/testagram`;
const PRIVATE_KEY = Deno.env.get('ACTOR_PRIVATE_KEY') ?? '';
const KEY_ID = `${ACTOR_URI}#main-key`;
const BATCH_SIZE = 10;

interface QueueItem {
  id: string;
  activity_type: string;
  activity_data: Record<string, unknown>;
  target_inbox: string;
  target_domain: string;
  status: string;
  attempts: number;
  max_attempts: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Fetch pending + retrying items
  const { data: items, error } = await supabase
    .from('delivery_queue')
    .select('*')
    .in('status', ['pending', 'retrying'])
    .lt('attempts', 3)
    .order('scheduled_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  if (!items?.length) {
    return jsonResponse({ status: 'idle', processed: 0 });
  }

  // Mark as processing
  const ids = items.map((i) => i.id);
  await supabase.from('delivery_queue')
    .update({ status: 'retrying' })
    .in('id', ids);

  const results: Array<{ id: string; success: boolean; status: number; error?: string }> = [];

  await Promise.all(items.map(async (item: QueueItem) => {
    const body = JSON.stringify(item.activity_data);
    const start = Date.now();
    let success = false;
    let httpStatus = 0;
    let errorMsg: string | undefined;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/activity+json',
        'Accept': 'application/activity+json',
      };

      if (PRIVATE_KEY) {
        const signed = await signRequest({
          method: 'POST',
          url: item.target_inbox,
          body,
          privateKeyPem: PRIVATE_KEY,
          keyId: KEY_ID,
        });
        Object.assign(headers, signed);
      }

      const res = await fetch(item.target_inbox, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(10_000),
      });

      httpStatus = res.status;
      success = res.status >= 200 && res.status < 300;

      if (!success) {
        errorMsg = `HTTP ${res.status}: ${await res.text().catch(() => '')}`;
      }
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : 'Network error';
    }

    const duration = Date.now() - start;
    const newAttempts = item.attempts + 1;
    const newStatus = success ? 'delivered' : newAttempts >= item.max_attempts ? 'failed' : 'retrying';

    // Update queue item
    await supabase.from('delivery_queue').update({
      status: newStatus,
      attempts: newAttempts,
      last_error: errorMsg ?? null,
      delivered_at: success ? new Date().toISOString() : null,
    }).eq('id', item.id);

    // Record delivery attempt
    await supabase.from('deliveries').insert({
      queue_id: item.id,
      target_inbox: item.target_inbox,
      http_status: httpStatus,
      response_body: errorMsg?.slice(0, 500) ?? null,
      signature_used: KEY_ID,
      duration_ms: duration,
      success,
    });

    // Log result
    await supabase.from('activity_logs').insert({
      event_type: success ? 'delivery_success' : 'delivery_failure',
      module: 'export',
      description: success
        ? `Delivered ${item.activity_type} to ${item.target_domain} (${duration}ms)`
        : `Failed to deliver ${item.activity_type} to ${item.target_domain}: ${errorMsg}`,
      status: success ? 'success' : newStatus === 'failed' ? 'error' : 'warning',
      metadata: { queueId: item.id, domain: item.target_domain, attempts: newAttempts, httpStatus },
    });

    results.push({ id: item.id, success, status: httpStatus, error: errorMsg });
  }));

  const delivered = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return jsonResponse({
    status: 'complete',
    processed: results.length,
    delivered,
    failed,
    results,
  });
});
