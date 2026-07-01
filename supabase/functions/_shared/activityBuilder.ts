/**
 * ActivityPub Activity Builder
 * Constructs valid AP JSON-LD objects per the ActivityStreams 2.0 spec
 */

const AP_CONTEXT = [
  'https://www.w3.org/ns/activitystreams',
  'https://w3id.org/security/v1',
  {
    manuallyApprovesFollowers: 'as:manuallyApprovesFollowers',
    sensitive: 'as:sensitive',
    Hashtag: 'as:Hashtag',
    Emoji: 'as:Emoji',
    focalPoint: { '@container': '@list', '@id': 'as:focalPoint' },
    toot: 'http://joinmastodon.org/ns#',
    featured: { '@id': 'toot:featured', '@type': '@id' },
    featuredTags: { '@id': 'toot:featuredTags', '@type': '@id' },
    alsoKnownAs: { '@id': 'as:alsoKnownAs', '@type': '@id' },
    discoverable: 'toot:discoverable',
    suspended: 'toot:suspended',
  },
];

export interface ActorData {
  id: string;
  handle: string;
  domain: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  headerUrl?: string;
  publicKeyId: string;
  publicKeyPem: string;
  followersCount?: number;
  followingCount?: number;
  postsCount?: number;
}

export interface NoteData {
  id: string;
  actorId: string;
  content: string;
  inReplyTo?: string;
  visibility?: 'public' | 'unlisted' | 'private' | 'direct';
  sensitive?: boolean;
  language?: string;
  tags?: string[];
  attachments?: Array<{ url: string; type: string; mediaType: string }>;
  publishedAt?: string;
}

export function buildActor(actor: ActorData) {
  const baseUrl = `https://${actor.domain}`;
  const actorUrl = actor.id;

  return {
    '@context': AP_CONTEXT,
    id: actorUrl,
    type: 'Person',
    following: `${actorUrl}/following`,
    followers: `${actorUrl}/followers`,
    inbox: `${actorUrl}/inbox`,
    outbox: `${actorUrl}/outbox`,
    featured: `${actorUrl}/collections/featured`,
    featuredTags: `${actorUrl}/collections/tags`,
    preferredUsername: actor.handle.split('@')[0],
    name: actor.displayName,
    summary: actor.bio ?? '',
    url: actorUrl,
    manuallyApprovesFollowers: false,
    discoverable: true,
    published: new Date().toISOString(),
    endpoints: { sharedInbox: `${baseUrl}/inbox` },
    icon: actor.avatarUrl ? {
      type: 'Image',
      mediaType: 'image/jpeg',
      url: actor.avatarUrl,
    } : undefined,
    image: actor.headerUrl ? {
      type: 'Image',
      mediaType: 'image/jpeg',
      url: actor.headerUrl,
    } : undefined,
    publicKey: {
      id: actor.publicKeyId,
      owner: actorUrl,
      publicKeyPem: actor.publicKeyPem,
    },
    tag: [],
    attachment: [],
    endpoints2: {
      totalItems: actor.followersCount ?? 0,
    },
  };
}

export function buildNote(note: NoteData) {
  const to = ['https://www.w3.org/ns/activitystreams#Public'];
  const cc = [`${note.actorId}/followers`];

  const hashtags = (note.tags ?? []).map((tag) => ({
    type: 'Hashtag',
    href: `#${tag}`,
    name: `#${tag}`,
  }));

  return {
    '@context': AP_CONTEXT,
    id: note.id,
    type: 'Note',
    summary: null,
    inReplyTo: note.inReplyTo ?? null,
    published: note.publishedAt ?? new Date().toISOString(),
    url: note.id,
    attributedTo: note.actorId,
    to,
    cc,
    sensitive: note.sensitive ?? false,
    conversation: `tag:${new URL(note.id).hostname},${new Date().getFullYear()}:objectId=conversation-${crypto.randomUUID()}`,
    content: `<p>${note.content}</p>`,
    contentMap: { [note.language ?? 'en']: `<p>${note.content}</p>` },
    attachment: (note.attachments ?? []).map((a) => ({
      type: 'Document',
      mediaType: a.mediaType,
      url: a.url,
    })),
    tag: hashtags,
  };
}

export function buildCreate(actor: string, note: object, noteId: string) {
  return {
    '@context': AP_CONTEXT,
    id: `${noteId}/activity`,
    type: 'Create',
    actor,
    published: new Date().toISOString(),
    to: ['https://www.w3.org/ns/activitystreams#Public'],
    cc: [`${actor}/followers`],
    object: note,
  };
}

export function buildFollow(actor: string, targetActor: string) {
  return {
    '@context': AP_CONTEXT,
    id: `${actor}#follows/${encodeURIComponent(targetActor)}`,
    type: 'Follow',
    actor,
    object: targetActor,
  };
}

export function buildUnfollow(actor: string, targetActor: string, followId: string) {
  return {
    '@context': AP_CONTEXT,
    id: `${actor}#unfollows/${encodeURIComponent(targetActor)}`,
    type: 'Undo',
    actor,
    object: {
      id: followId,
      type: 'Follow',
      actor,
      object: targetActor,
    },
  };
}

export function buildLike(actor: string, objectId: string) {
  return {
    '@context': AP_CONTEXT,
    id: `${actor}#likes/${encodeURIComponent(objectId)}`,
    type: 'Like',
    actor,
    object: objectId,
  };
}

export function buildUnlike(actor: string, objectId: string) {
  return {
    '@context': AP_CONTEXT,
    id: `${actor}#unlikes/${encodeURIComponent(objectId)}`,
    type: 'Undo',
    actor,
    object: {
      id: `${actor}#likes/${encodeURIComponent(objectId)}`,
      type: 'Like',
      actor,
      object: objectId,
    },
  };
}

export function buildAnnounce(actor: string, objectId: string) {
  return {
    '@context': AP_CONTEXT,
    id: `${actor}#announces/${encodeURIComponent(objectId)}`,
    type: 'Announce',
    actor,
    published: new Date().toISOString(),
    to: ['https://www.w3.org/ns/activitystreams#Public'],
    cc: [`${actor}/followers`, objectId],
    object: objectId,
  };
}

export function buildAccept(actor: string, followActivity: object) {
  return {
    '@context': AP_CONTEXT,
    id: `${actor}#accepts/${crypto.randomUUID()}`,
    type: 'Accept',
    actor,
    object: followActivity,
  };
}

export function buildReject(actor: string, followActivity: object) {
  return {
    '@context': AP_CONTEXT,
    id: `${actor}#rejects/${crypto.randomUUID()}`,
    type: 'Reject',
    actor,
    object: followActivity,
  };
}

export function buildDelete(actor: string, objectId: string) {
  return {
    '@context': AP_CONTEXT,
    id: `${objectId}#delete`,
    type: 'Delete',
    actor,
    to: ['https://www.w3.org/ns/activitystreams#Public'],
    object: { id: objectId, type: 'Tombstone' },
  };
}

export function buildUpdate(actor: string, updatedObject: object) {
  return {
    '@context': AP_CONTEXT,
    id: `${actor}#update-${Date.now()}`,
    type: 'Update',
    actor,
    to: ['https://www.w3.org/ns/activitystreams#Public'],
    object: updatedObject,
  };
}
