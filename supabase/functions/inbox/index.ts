/**
 * ActivityPub Inbox
 * POST /inbox — receives incoming activities from the Fediverse
 * Handles: Follow, Undo(Follow), Like, Undo(Like), Create, Announce, Delete, Update, Block
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { verifySignature } from '../_shared/httpSignature.ts';
import { buildAccept } from '../_shared/activityBuilder.ts';
import { signRequest } from '../_shared/httpSignature.ts';

const DOMAIN = Deno.env.get('GATEWAY_DOMAIN') ?? 'testagram.site';
const ACTOR_URI = `https://${DOMAIN}/users/testagram`;
const PRIVATE_KEY = Deno.env.get('ACTOR_PRIVATE_KEY') ?? '';
const KEY_ID = `${ACTOR_URI}#main-key`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  let bodyText: string;
  let activity: Record<string, unknown>;

  try {
    bodyText = await req.text();
    activity = JSON.parse(bodyText);
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  // Verify HTTP Signature
  const verified = await verifySignature(req, bodyText);

  const activityType = String(activity.type ?? '');
  const actorUri = String(activity.actor ?? '');
  const objectRaw = activity.object;
  const objectUri = typeof objectRaw === 'string' ? objectRaw : (objectRaw as any)?.id ?? '';

  // Store the raw activity
  await supabase.from('activities').insert({
    activity_uri: activity.id as string,
    activity_type: activityType,
    actor_uri: actorUri,
    object_uri: objectUri,
    object_data: typeof objectRaw === 'object' ? objectRaw : { id: objectRaw },
    direction: 'inbound',
    raw_payload: activity,
    signature_verified: verified,
    processed: false,
  }).select();

  // Process based on type
  switch (activityType) {
    case 'Follow': {
      // Auto-accept follows
      const acceptActivity = buildAccept(ACTOR_URI, activity);
      const body = JSON.stringify(acceptActivity);

      // Fetch actor to get inbox
      let targetInbox = `${actorUri}/inbox`;
      try {
        const actorRes = await fetch(actorUri, {
          headers: { Accept: 'application/activity+json' },
        });
        if (actorRes.ok) {
          const actorData = await actorRes.json();
          targetInbox = actorData.inbox ?? targetInbox;
        }
      } catch { /* use default */ }

      if (PRIVATE_KEY) {
        const signedHeaders = await signRequest({
          method: 'POST',
          url: targetInbox,
          body,
          privateKeyPem: PRIVATE_KEY,
          keyId: KEY_ID,
        });

        await fetch(targetInbox, {
          method: 'POST',
          headers: { ...signedHeaders, 'Content-Type': 'application/activity+json' },
          body,
        }).catch(() => null);
      }

      await supabase.from('activity_logs').insert({
        event_type: 'inbound_follow',
        module: 'inbox',
        description: `Inbound Follow from ${actorUri} — auto-accepted`,
        status: 'success',
        metadata: { actorUri, verified },
      });
      break;
    }

    case 'Like': {
      // Update likes count on local object
      if (objectUri) {
        await supabase.from('objects')
          .update({ likes_count: supabase.rpc('increment' as any) })
          .eq('object_uri', objectUri);
      }
      await supabase.from('activity_logs').insert({
        event_type: 'inbound_like',
        module: 'inbox',
        description: `Inbound Like on ${objectUri} from ${actorUri}`,
        status: 'success',
        metadata: { actorUri, objectUri, verified },
      });
      break;
    }

    case 'Create': {
      const obj = objectRaw as Record<string, unknown> ?? {};
      if (obj.type === 'Note') {
        await supabase.from('activity_logs').insert({
          event_type: 'inbound_note',
          module: 'inbox',
          description: `Inbound Note from ${actorUri}`,
          status: 'success',
          metadata: { actorUri, objectId: obj.id, verified },
        });
      }
      break;
    }

    case 'Announce': {
      await supabase.from('activity_logs').insert({
        event_type: 'inbound_boost',
        module: 'inbox',
        description: `Inbound Boost of ${objectUri} from ${actorUri}`,
        status: 'success',
        metadata: { actorUri, objectUri, verified },
      });
      break;
    }

    case 'Delete': {
      await supabase.from('activity_logs').insert({
        event_type: 'inbound_delete',
        module: 'inbox',
        description: `Inbound Delete for ${objectUri} from ${actorUri}`,
        status: 'warning',
        metadata: { actorUri, objectUri, verified },
      });
      break;
    }

    case 'Undo': {
      const undoObj = objectRaw as Record<string, unknown> ?? {};
      const undoType = String(undoObj.type ?? '');
      await supabase.from('activity_logs').insert({
        event_type: `inbound_undo_${undoType.toLowerCase()}`,
        module: 'inbox',
        description: `Inbound Undo(${undoType}) from ${actorUri}`,
        status: 'success',
        metadata: { actorUri, verified },
      });
      break;
    }

    default: {
      await supabase.from('activity_logs').insert({
        event_type: `inbound_${activityType.toLowerCase()}`,
        module: 'inbox',
        description: `Unhandled inbound activity type: ${activityType} from ${actorUri}`,
        status: 'warning',
        metadata: { activityType, actorUri, verified },
      });
    }
  }

  // Mark activity as processed
  if (activity.id) {
    await supabase.from('activities')
      .update({ processed: true })
      .eq('activity_uri', activity.id as string);
  }

  return jsonResponse({ status: 'accepted' }, 202);
});
