/**
 * ActivityPub Outbox
 * GET /outbox?page=true — returns the actor's activity stream
 * POST /outbox — internal API to publish new activities
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsResponse, apResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import {
  buildCreate, buildNote, buildLike, buildAnnounce, buildFollow, buildDelete, buildUpdate,
} from '../_shared/activityBuilder.ts';
import { signRequest } from '../_shared/httpSignature.ts';

const DOMAIN = Deno.env.get('GATEWAY_DOMAIN') ?? 'testagram.site';
const ACTOR_URI = `https://${DOMAIN}/users/testagram`;
const PRIVATE_KEY = Deno.env.get('ACTOR_PRIVATE_KEY') ?? '';
const KEY_ID = `${ACTOR_URI}#main-key`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // GET — public outbox collection
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const page = url.searchParams.get('page') === 'true';
    const pageNum = parseInt(url.searchParams.get('min_id') ?? '0', 10);
    const LIMIT = 20;

    const { data: activities, count } = await supabase
      .from('activities')
      .select('*', { count: 'exact' })
      .eq('direction', 'outbound')
      .eq('actor_uri', ACTOR_URI)
      .order('created_at', { ascending: false })
      .range(pageNum, pageNum + LIMIT - 1);

    if (!page) {
      return apResponse({
        '@context': 'https://www.w3.org/ns/activitystreams',
        id: `https://${DOMAIN}/outbox`,
        type: 'OrderedCollection',
        totalItems: count ?? 0,
        first: `https://${DOMAIN}/outbox?page=true`,
        last: `https://${DOMAIN}/outbox?page=true&min_id=${Math.max(0, (count ?? 0) - LIMIT)}`,
      });
    }

    return apResponse({
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: `https://${DOMAIN}/outbox?page=true&min_id=${pageNum}`,
      type: 'OrderedCollectionPage',
      partOf: `https://${DOMAIN}/outbox`,
      prev: `https://${DOMAIN}/outbox?page=true&min_id=${pageNum + LIMIT}`,
      orderedItems: (activities ?? []).map((a) => a.raw_payload),
    });
  }

  // POST — internal publish endpoint (requires service role or auth)
  if (req.method === 'POST') {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse('Invalid JSON', 400);
    }

    const { type, content, targetDomains, objectId, targetActorId } = body as {
      type: string;
      content?: string;
      targetDomains?: string[];
      objectId?: string;
      targetActorId?: string;
    };

    let activity: Record<string, unknown>;
    let activityType = type;

    switch (type) {
      case 'Create': {
        if (!content) return errorResponse('content required for Create', 400);
        const noteId = `https://${DOMAIN}/notes/${crypto.randomUUID()}`;
        const note = buildNote({
          id: noteId,
          actorId: ACTOR_URI,
          content,
          publishedAt: new Date().toISOString(),
        });
        activity = buildCreate(ACTOR_URI, note, noteId);

        // Store the object
        await supabase.from('objects').insert({
          object_uri: noteId,
          object_type: 'Note',
          attributed_to: ACTOR_URI,
          content,
          url: noteId,
          published_at: new Date().toISOString(),
        });
        break;
      }

      case 'Follow': {
        if (!targetActorId) return errorResponse('targetActorId required for Follow', 400);
        activity = buildFollow(ACTOR_URI, targetActorId);
        break;
      }

      case 'Like': {
        if (!objectId) return errorResponse('objectId required for Like', 400);
        activity = buildLike(ACTOR_URI, objectId);
        break;
      }

      case 'Announce': {
        if (!objectId) return errorResponse('objectId required for Announce', 400);
        activity = buildAnnounce(ACTOR_URI, objectId);
        break;
      }

      case 'Delete': {
        if (!objectId) return errorResponse('objectId required for Delete', 400);
        activity = buildDelete(ACTOR_URI, objectId);
        break;
      }

      default:
        return errorResponse(`Unknown activity type: ${type}`, 400);
    }

    // Store outbound activity
    await supabase.from('activities').insert({
      activity_uri: activity.id as string,
      activity_type: activityType,
      actor_uri: ACTOR_URI,
      object_uri: (typeof activity.object === 'string' ? activity.object : (activity.object as any)?.id) ?? null,
      object_data: activity.object as object,
      direction: 'outbound',
      raw_payload: activity,
      signature_verified: true,
    });

    // Queue for delivery
    const domains = targetDomains ?? [];
    const queueItems = domains.map((d) => ({
      activity_type: activityType,
      activity_data: activity,
      target_inbox: `https://${d}/inbox`,
      target_domain: d,
      status: 'pending',
    }));

    if (queueItems.length > 0) {
      await supabase.from('delivery_queue').insert(queueItems);
    }

    await supabase.from('activity_logs').insert({
      event_type: `outbound_${activityType.toLowerCase()}`,
      module: 'outbox',
      description: `Published ${activityType} activity to ${domains.length} instance(s)`,
      status: 'success',
      metadata: { activityType, domains, activityId: activity.id },
    });

    return jsonResponse({
      status: 'queued',
      activityId: activity.id,
      queued: queueItems.length,
    }, 201);
  }

  return errorResponse('Method not allowed', 405);
});
