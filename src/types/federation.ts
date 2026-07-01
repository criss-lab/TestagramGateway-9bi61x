export interface FederationInstance {
  id: string;
  domain: string;
  software: string;
  version: string | null;
  status: 'active' | 'unreachable' | 'suspended';
  last_seen_at: string | null;
  post_count: number;
  account_count: number;
  inbox_url: string | null;
  shared_inbox_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface RemoteAccount {
  id: string;
  actor_id: string;
  handle: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  instance_domain: string | null;
  followers_count: number;
  following_count: number;
  posts_count: number;
  last_fetched_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RemotePost {
  id: string;
  activity_id: string;
  remote_account_id: string | null;
  content: string | null;
  content_type: string;
  visibility: string;
  language: string | null;
  url: string | null;
  in_reply_to: string | null;
  reblog_of: string | null;
  media_attachments: unknown[];
  tags: unknown[];
  likes_count: number;
  replies_count: number;
  reposts_count: number;
  published_at: string | null;
  created_at: string;
  remote_accounts: Pick<RemoteAccount, 'handle' | 'display_name' | 'avatar_url' | 'instance_domain'> | null;
}

export interface DeliveryQueueItem {
  id: string;
  activity_type: string;
  activity_data: Record<string, unknown>;
  target_inbox: string;
  target_domain: string | null;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  scheduled_at: string;
  delivered_at: string | null;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  event_type: string;
  module: string;
  description: string | null;
  metadata: Record<string, unknown>;
  status: 'success' | 'warning' | 'error';
  created_at: string;
}

export interface RemoteFollow {
  id: string;
  local_user_id: string | null;
  remote_account_id: string | null;
  direction: 'inbound' | 'outbound';
  status: 'pending' | 'accepted' | 'rejected';
  accepted_at: string | null;
  created_at: string;
}

export interface PostInteraction {
  id: string;
  user_id: string | null;
  post_id: string;
  action: 'like' | 'repost' | 'share' | 'reply';
  reply_content: string | null;
  created_at: string;
}

export interface AccountFollow {
  id: string;
  follower_handle: string;
  remote_account_id: string;
  status: 'following' | 'unfollowed' | 'pending';
  created_at: string;
}

export interface DashboardStats {
  instances: number;
  accounts: number;
  posts: number;
  queueTotal: number;
  queuePending: number;
  queueFailed: number;
}

// ActivityPub types
export interface APActor {
  '@context': string | string[];
  type: 'Person' | 'Service' | 'Application' | 'Group' | 'Organization';
  id: string;
  following: string;
  followers: string;
  inbox: string;
  outbox: string;
  preferredUsername: string;
  name?: string;
  summary?: string;
  icon?: { type: string; mediaType: string; url: string };
  publicKey?: { id: string; owner: string; publicKeyPem: string };
}

export interface APNote {
  '@context': string | string[];
  type: 'Note';
  id: string;
  attributedTo: string;
  content: string;
  published: string;
  to: string[];
  cc?: string[];
  inReplyTo?: string;
  attachment?: unknown[];
  tag?: unknown[];
}

export interface APActivity {
  '@context': string | string[];
  type: 'Create' | 'Follow' | 'Like' | 'Announce' | 'Undo' | 'Delete' | 'Accept' | 'Reject';
  id: string;
  actor: string;
  object: string | APNote | APActor;
  to?: string[];
  cc?: string[];
  published?: string;
}

export interface WebFingerResult {
  subject: string;
  aliases?: string[];
  links: { rel: string; type?: string; href?: string; template?: string }[];
}
