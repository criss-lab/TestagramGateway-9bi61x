# Fediverse & Bluesky Integration Guide

## Overview

This integration enables TestagramGateway to interoperate with the Fediverse (Mastodon, Lemmy, PeerTube, etc.) and Bluesky platforms, allowing users to:

- Link their Fediverse accounts (Mastodon, Lemmy, etc.)
- Connect their Bluesky account
- Cross-post content
- Federate interactions (likes, reposts, follows)
- Discover content across networks
- Maintain federated identity

## Architecture

### Core Components

1. **FederationService** - Handles ActivityPub protocol operations
2. **BlueskyService** - Manages Bluesky API interactions
3. **FediverseConnect** - UI component for account linking
4. **BlueskySidebar** - Display Bluesky feed and interactions

### Protocols

- **ActivityPub (AP)** - W3C standard for federated social networking
- **Bluesky AT Protocol** - Open protocol for decentralized social networks

## Setup Instructions

### 1. Environment Variables

```env
# Fediverse
VITE_FEDERATION_PRIVATE_KEY=your_rsa_private_key
VITE_FEDERATION_PUBLIC_KEY=your_rsa_public_key
VITE_INSTANCE_URL=https://yourdomain.com
VITE_INSTANCE_ADMIN_EMAIL=admin@yourdomain.com

# Bluesky
VITE_BLUESKY_HANDLE=your.bsky.social
VITE_BLUESKY_PASSWORD=your_app_password
```

### 2. Generate RSA Keys for ActivityPub

```bash
# Generate private key
openssl genrsa -out private_key.pem 2048

# Generate public key
openssl rsa -in private_key.pem -pubout -out public_key.pem
```

### 3. Database Schema

```sql
-- Federated identities table
CREATE TABLE federated_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  fediverse_handle VARCHAR,
  bluesky_did VARCHAR,
  bluesky_handle VARCHAR,
  mastodon_handle VARCHAR,
  activity_pub_id VARCHAR UNIQUE,
  linked_at TIMESTAMP DEFAULT NOW(),
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Federated posts tracking
CREATE TABLE federated_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id),
  activity_pub_uri VARCHAR UNIQUE,
  bluesky_uri VARCHAR,
  mastodon_uri VARCHAR,
  federated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Federated interactions
CREATE TABLE federated_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id),
  source_platform VARCHAR, -- 'mastodon', 'bluesky', 'lemmy'
  source_actor_id VARCHAR,
  interaction_type VARCHAR, -- 'like', 'repost', 'reply'
  interaction_uri VARCHAR,
  received_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Usage Examples

### Linking a Fediverse Account

```typescript
import FederationService from '@/lib/fediverse/federation-service';

const federation = new FederationService(
  'https://yourdomain.com',
  privateKey,
  publicKey
);

// Verify Mastodon account
const mastodonHandle = 'user@mastodon.social';
// Implement WebFinger lookup and verification
```

### Creating a Cross-Post

```typescript
const post = {
  id: 'post-123',
  content: 'Hello Fediverse and Bluesky!',
  created_at: new Date(),
  media_urls: [],
};

// Create ActivityPub object
const activity = federation.createPostActivity(userId, post);

// Send to followers
await sendToFollowers(activity);

// Create Bluesky post
const blueskyPost = await bluesky.createPost(
  post.content,
  extractFacets(post.content)
);
```

### Handling Incoming Activity

```typescript
// HTTP POST to /inbox
app.post('/inbox', async (req, res) => {
  const activity = req.body;
  
  // Verify signature
  if (!federation.verifySignature(req.headers, JSON.stringify(activity))) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process activity
  switch (activity.type) {
    case 'Create':
      await handleCreate(activity);
      break;
    case 'Like':
      await handleLike(activity);
      break;
    case 'Follow':
      await handleFollow(activity);
      break;
    // ...
  }
  
  res.json({ ok: true });
});
```

### Bluesky Integration

```typescript
import BlueskyService from '@/lib/bluesky/bluesky-service';

const bluesky = new BlueskyService();

// Create session
await bluesky.createSession('user@bsky.social', 'app_password');

// Create post
const post = await bluesky.createPost(
  'Hello from XClone!',
  [], // facets
  undefined // embed
);

// Search posts
const results = await bluesky.searchPosts('fediverse');

// Get home feed
const feed = await bluesky.getHomeFeed(30);
```

## Security Considerations

1. **HTTP Signatures** - All ActivityPub requests are signed with RSA keys
2. **Verification** - Signatures are verified before processing
3. **HTTPS Only** - All federation communication uses HTTPS
4. **Token Management** - Bluesky app passwords are securely stored
5. **Rate Limiting** - Implement rate limiting for federation endpoints
6. **Content Validation** - Validate all incoming content

## Testing

### Test with Local Instance

```bash
# Using docker-compose with Mastodon instance
docker-compose up -d

# Your instance will be available at http://localhost:3000
```

### Test Federation

```typescript
import { test } from 'vitest';

test('should create ActivityPub actor', () => {
  const actor = federation.createActor(
    'user-123',
    'testuser',
    'Test User'
  );
  
  expect(actor.preferredUsername).toBe('testuser');
  expect(actor.type).toBe('Person');
});
```

## Troubleshooting

### Account Not Linking

- Verify account is public
- Check WebFinger endpoint is accessible
- Ensure domain is resolvable

### Posts Not Appearing

- Check HTTP signature verification
- Verify inbox URL is correct
- Check rate limiting
- Review error logs

### Bluesky Connection Issues

- Verify app password is correct
- Check network connectivity
- Ensure Bluesky API is accessible
- Verify handle format

## Further Reading

- [ActivityPub Specification](https://www.w3.org/TR/activitypub/)
- [WebFinger RFC 7033](https://tools.ietf.org/html/rfc7033)
- [Mastodon API Documentation](https://docs.joinmastodon.org/)
- [Bluesky AT Protocol](https://github.com/bluesky-social/atproto)
