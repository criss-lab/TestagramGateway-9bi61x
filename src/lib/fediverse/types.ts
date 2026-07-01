// Fediverse Protocol Types and Interfaces

export interface FediverseActor {
  id: string;
  type: 'Person' | 'Service' | 'Application' | 'Organization';
  preferredUsername: string;
  name: string;
  summary?: string;
  inbox: string;
  outbox: string;
  followers?: string;
  following?: string;
  url?: string;
  icon?: {
    type: 'Image';
    url: string;
  };
  publicKey: {
    id: string;
    owner: string;
    publicKeyPem: string;
  };
  discoverable?: boolean;
  manuallyApprovesFollowers?: boolean;
  endpoints?: {
    sharedInbox: string;
  };
}

export interface FediverseObject {
  id: string;
  type: 'Note' | 'Article' | 'Image' | 'Video' | 'Audio';
  attributedTo: string;
  content: string;
  published: string;
  updated?: string;
  inReplyTo?: string;
  replies?: string;
  likes?: string;
  shares?: string;
  url?: string;
  tag?: FediverseTag[];
  attachment?: FediverseAttachment[];
  sensitive?: boolean;
  summary?: string;
}

export interface FediverseActivity {
  '@context': string | string[];
  id: string;
  type: 'Create' | 'Update' | 'Delete' | 'Follow' | 'Like' | 'Announce' | 'Undo';
  actor: string;
  object: FediverseObject | string;
  target?: string;
  published: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
}

export interface FediverseTag {
  type: 'Hashtag' | 'Mention';
  href: string;
  name: string;
}

export interface FediverseAttachment {
  type: 'Document' | 'Image' | 'Video' | 'Audio';
  url: string;
  mediaType?: string;
  name?: string;
}

export interface FediverseCollection {
  id: string;
  type: 'Collection' | 'OrderedCollection';
  totalItems: number;
  items?: Array<FediverseObject | string>;
  first?: string;
  last?: string;
}

export interface BlueskyProfile {
  did: string;
  handle: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  banner?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
  labels?: string[];
}

export interface BlueskyPost {
  uri: string;
  cid: string;
  author: BlueskyProfile;
  record: {
    text: string;
    createdAt: string;
    facets?: BlueskyFacet[];
    reply?: {
      root: {
        uri: string;
        cid: string;
      };
      parent: {
        uri: string;
        cid: string;
      };
    };
    embed?: any;
  };
  likeCount?: number;
  replyCount?: number;
  repostCount?: number;
  quoteCount?: number;
}

export interface BlueskyFacet {
  index: {
    byteStart: number;
    byteEnd: number;
  };
  features: Array<{
    $type: string;
    uri?: string;
    did?: string;
    handle?: string;
    tag?: string;
  }>;
}

export interface FederatedIdentity {
  userId: string;
  fediverseHandle?: string;
  blueskyDid?: string;
  blueskyHandle?: string;
  mastodonHandle?: string;
  activityPubId?: string;
  linkedAt: string;
  verified: boolean;
}
