import { BlueskyProfile, BlueskyPost, FederatedIdentity } from '../fediverse/types';

interface BlueskySession {
  accessJwt: string;
  refreshJwt: string;
  handle: string;
  did: string;
}

export class BlueskyService {
  private apiUrl = 'https://bsky.social/xrpc';
  private session: BlueskySession | null = null;
  private identifier: string = '';
  private password: string = '';

  constructor(identifier?: string, password?: string) {
    if (identifier && password) {
      this.identifier = identifier;
      this.password = password;
    }
  }

  /**
   * Create a new Bluesky session
   */
  async createSession(identifier: string, password: string): Promise<BlueskySession> {
    try {
      const response = await fetch(`${this.apiUrl}/com.atproto.server.createSession`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier,
          password,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create Bluesky session: ${response.statusText}`);
      }

      this.session = await response.json();
      this.identifier = identifier;
      this.password = password;
      return this.session;
    } catch (error) {
      console.error('Bluesky session creation failed:', error);
      throw error;
    }
  }

  /**
   * Get user profile information
   */
  async getProfile(handle: string): Promise<BlueskyProfile> {
    if (!this.session) {
      throw new Error('No active Bluesky session');
    }

    try {
      const response = await fetch(
        `${this.apiUrl}/app.bsky.actor.getProfile?actor=${encodeURIComponent(handle)}`,
        {
          headers: {
            Authorization: `Bearer ${this.session.accessJwt}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get profile: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get Bluesky profile:', error);
      throw error;
    }
  }

  /**
   * Create a new post
   */
  async createPost(text: string, facets?: any[], embed?: any): Promise<BlueskyPost> {
    if (!this.session) {
      throw new Error('No active Bluesky session');
    }

    try {
      const response = await fetch(`${this.apiUrl}/com.atproto.repo.createRecord`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.session.accessJwt}`,
        },
        body: JSON.stringify({
          repo: this.session.did,
          collection: 'app.bsky.feed.post',
          record: {
            text,
            facets,
            embed,
            createdAt: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create post: ${response.statusText}`);
      }

      const { uri, cid } = await response.json();
      return {
        uri,
        cid,
        author: await this.getProfile(this.session.handle),
        record: {
          text,
          createdAt: new Date().toISOString(),
          facets,
          embed,
        },
      } as BlueskyPost;
    } catch (error) {
      console.error('Failed to create Bluesky post:', error);
      throw error;
    }
  }

  /**
   * Like a post
   */
  async likePost(postUri: string, postCid: string): Promise<{ uri: string; cid: string }> {
    if (!this.session) {
      throw new Error('No active Bluesky session');
    }

    try {
      const response = await fetch(`${this.apiUrl}/com.atproto.repo.createRecord`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.session.accessJwt}`,
        },
        body: JSON.stringify({
          repo: this.session.did,
          collection: 'app.bsky.feed.like',
          record: {
            subject: {
              uri: postUri,
              cid: postCid,
            },
            createdAt: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to like post: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to like Bluesky post:', error);
      throw error;
    }
  }

  /**
   * Repost (rebluesky) a post
   */
  async repostPost(postUri: string, postCid: string): Promise<{ uri: string; cid: string }> {
    if (!this.session) {
      throw new Error('No active Bluesky session');
    }

    try {
      const response = await fetch(`${this.apiUrl}/com.atproto.repo.createRecord`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.session.accessJwt}`,
        },
        body: JSON.stringify({
          repo: this.session.did,
          collection: 'app.bsky.feed.repost',
          record: {
            subject: {
              uri: postUri,
              cid: postCid,
            },
            createdAt: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to repost: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to repost on Bluesky:', error);
      throw error;
    }
  }

  /**
   * Search for posts
   */
  async searchPosts(query: string, limit: number = 20): Promise<BlueskyPost[]> {
    if (!this.session) {
      throw new Error('No active Bluesky session');
    }

    try {
      const response = await fetch(
        `${this.apiUrl}/app.bsky.feed.searchPosts?q=${encodeURIComponent(query)}&limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${this.session.accessJwt}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to search posts: ${response.statusText}`);
      }

      const { posts } = await response.json();
      return posts;
    } catch (error) {
      console.error('Failed to search Bluesky posts:', error);
      throw error;
    }
  }

  /**
   * Get home feed
   */
  async getHomeFeed(limit: number = 30, cursor?: string): Promise<{ posts: BlueskyPost[]; cursor?: string }> {
    if (!this.session) {
      throw new Error('No active Bluesky session');
    }

    try {
      const url = new URL(`${this.apiUrl}/app.bsky.feed.getTimeline`);
      url.searchParams.append('limit', limit.toString());
      if (cursor) url.searchParams.append('cursor', cursor);

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${this.session.accessJwt}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get feed: ${response.statusText}`);
      }

      const { feed, cursor: nextCursor } = await response.json();
      return {
        posts: feed.map((item: any) => item.post),
        cursor: nextCursor,
      };
    } catch (error) {
      console.error('Failed to get Bluesky feed:', error);
      throw error;
    }
  }

  /**
   * Follow a user
   */
  async followUser(did: string): Promise<{ uri: string; cid: string }> {
    if (!this.session) {
      throw new Error('No active Bluesky session');
    }

    try {
      const response = await fetch(`${this.apiUrl}/com.atproto.repo.createRecord`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.session.accessJwt}`,
        },
        body: JSON.stringify({
          repo: this.session.did,
          collection: 'app.bsky.graph.follow',
          record: {
            subject: did,
            createdAt: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to follow: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to follow user on Bluesky:', error);
      throw error;
    }
  }

  /**
   * Get user followers
   */
  async getFollowers(did: string, limit: number = 50, cursor?: string): Promise<any> {
    if (!this.session) {
      throw new Error('No active Bluesky session');
    }

    try {
      const url = new URL(`${this.apiUrl}/app.bsky.graph.getFollowers`);
      url.searchParams.append('actor', did);
      url.searchParams.append('limit', limit.toString());
      if (cursor) url.searchParams.append('cursor', cursor);

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${this.session.accessJwt}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get followers: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get followers:', error);
      throw error;
    }
  }

  isAuthenticated(): boolean {
    return !!this.session;
  }

  getSession(): BlueskySession | null {
    return this.session;
  }
}

export default BlueskyService;
