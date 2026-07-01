/**
 * Actor Endpoint
 * GET /users/:username — returns the AP Actor JSON-LD object
 * Used by remote servers to fetch actor profiles
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsResponse, apResponse, errorResponse } from '../_shared/cors.ts';
import { buildActor } from '../_shared/activityBuilder.ts';

const DOMAIN = Deno.env.get('GATEWAY_DOMAIN') ?? 'testagram.site';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  const url = new URL(req.url);
  const username = url.searchParams.get('username') ?? url.pathname.split('/').pop() ?? '';

  if (!username) return errorResponse('Username required', 400);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Fetch actor from DB
  const { data: actor, error } = await supabase
    .from('actors')
    .select('*')
    .eq('handle', username)
    .eq('is_local', true)
    .maybeSingle();

  if (error) return errorResponse('Database error', 500);

  if (!actor) {
    // Build a synthetic actor for demonstration
    const actorUri = `https://${DOMAIN}/users/${username}`;
    const keyId = `${actorUri}#main-key`;

    // Check if there's a public key stored
    const { data: keyData } = await supabase
      .from('public_keys')
      .select('*')
      .eq('actor_uri', actorUri)
      .maybeSingle();

    const builtActor = buildActor({
      id: actorUri,
      handle: username,
      domain: DOMAIN,
      displayName: username,
      bio: `Testagram user @${username}@${DOMAIN}`,
      publicKeyId: keyId,
      publicKeyPem: keyData?.public_key_pem ?? '-----BEGIN PUBLIC KEY-----\n[Key not generated]\n-----END PUBLIC KEY-----',
    });

    await supabase.from('activity_logs').insert({
      event_type: 'actor_fetch',
      module: 'routes',
      description: `Remote actor fetch: @${username}@${DOMAIN} (synthetic)`,
      status: 'warning',
    });

    return apResponse(builtActor);
  }

  const actorPayload = buildActor({
    id: actor.actor_uri,
    handle: actor.handle,
    domain: DOMAIN,
    displayName: actor.display_name ?? actor.handle,
    bio: actor.bio ?? '',
    avatarUrl: actor.avatar_url,
    headerUrl: actor.header_url,
    publicKeyId: `${actor.actor_uri}#main-key`,
    publicKeyPem: actor.public_key_pem ?? '',
    followersCount: actor.followers_count,
    followingCount: actor.following_count,
    postsCount: actor.posts_count,
  });

  await supabase.from('activity_logs').insert({
    event_type: 'actor_fetch',
    module: 'routes',
    description: `Remote actor fetch: @${actor.handle}@${DOMAIN}`,
    status: 'success',
  });

  return apResponse(actorPayload);
});
