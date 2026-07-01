import { FediverseActor, FediverseActivity, FediverseObject, FederatedIdentity } from './types';
import crypto from 'crypto';

export class FederationService {
  private baseUrl: string;
  private privateKey: string;
  private publicKey: string;

  constructor(baseUrl: string, privateKey: string, publicKey: string) {
    this.baseUrl = baseUrl;
    this.privateKey = privateKey;
    this.publicKey = publicKey;
  }

  /**
   * Create a new ActivityPub actor (user profile)
   */
  createActor(userId: string, username: string, name: string, summary?: string): FediverseActor {
    const actorId = `${this.baseUrl}/users/${userId}`;
    
    return {
      id: actorId,
      type: 'Person',
      preferredUsername: username,
      name,
      summary: summary || '',
      inbox: `${actorId}/inbox`,
      outbox: `${actorId}/outbox`,
      followers: `${actorId}/followers`,
      following: `${actorId}/following`,
      url: `${this.baseUrl}/profile/${username}`,
      publicKey: {
        id: `${actorId}#main-key`,
        owner: actorId,
        publicKeyPem: this.publicKey,
      },
      discoverable: true,
      manuallyApprovesFollowers: false,
      endpoints: {
        sharedInbox: `${this.baseUrl}/inbox`,
      },
    };
  }

  /**
   * Create an ActivityPub Create activity for a new post
   */
  createPostActivity(userId: string, post: any): FediverseActivity {
    const postId = `${this.baseUrl}/posts/${post.id}`;
    const actorId = `${this.baseUrl}/users/${userId}`;

    const fediverseObject: FediverseObject = {
      id: postId,
      type: 'Note',
      attributedTo: actorId,
      content: post.content,
      published: new Date(post.created_at).toISOString(),
      url: `${this.baseUrl}/post/${post.id}`,
      tag: this.extractTags(post.content),
      attachment: post.media_urls?.map((url: string) => ({
        type: 'Document',
        url,
      })) || [],
      sensitive: post.sensitive || false,
      summary: post.summary,
    };

    return {
      '@context': [
        'https://www.w3.org/ns/activitystreams',
        'https://w3id.org/security/v1',
      ],
      id: `${postId}/activity`,
      type: 'Create',
      actor: actorId,
      object: fediverseObject,
      published: new Date().toISOString(),
      to: ['https://www.w3.org/ns/activitystreams#Public'],
      cc: [`${actorId}/followers`],
    };
  }

  /**
   * Sign HTTP request with HTTP Signature
   */
  signRequest(method: string, path: string, body?: string): {
    signature: string;
    digest: string;
  } {
    const date = new Date().toUTCString();
    const host = new URL(this.baseUrl).hostname;
    
    let digest = '';
    if (body) {
      const hash = crypto.createHash('sha256').update(body).digest('base64');
      digest = `SHA-256=${hash}`;
    }

    const signingString = [
      `(request-target): ${method.toLowerCase()} ${path}`,
      `host: ${host}`,
      `date: ${date}`,
      ...(digest ? [`digest: ${digest}`] : []),
    ].join('\n');

    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signingString);
    const signature = signer.sign(this.privateKey, 'base64');

    return {
      signature: `keyId="${this.baseUrl}#main-key",algorithm="rsa-sha256",headers="(request-target) host date${digest ? ' digest' : ''}",signature="${signature}"`,
      digest,
    };
  }

  /**
   * Extract hashtags and mentions from content
   */
  private extractTags(content: string): any[] {
    const tags: any[] = [];

    // Extract hashtags
    const hashtagRegex = /#\w+/g;
    const hashtags = content.match(hashtagRegex) || [];
    hashtags.forEach((tag) => {
      const name = tag.substring(1);
      tags.push({
        type: 'Hashtag',
        href: `${this.baseUrl}/tags/${name}`,
        name: tag,
      });
    });

    // Extract mentions
    const mentionRegex = /@([a-zA-Z0-9_.]+)@?([a-zA-Z0-9.]+)?/g;
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
      const username = match[1];
      const domain = match[2] || new URL(this.baseUrl).hostname;
      tags.push({
        type: 'Mention',
        href: `https://${domain}/users/${username}`,
        name: `@${username}@${domain}`,
      });
    }

    return tags;
  }

  /**
   * Verify HTTP Signature from incoming request
   */
  verifySignature(headers: Record<string, string>, body?: string): boolean {
    const signature = headers['signature'];
    if (!signature) return false;

    // Parse signature header
    const sigParams = this.parseSignatureHeader(signature);
    if (!sigParams) return false;

    // Reconstruct signing string
    const headerNames = sigParams.headers.split(' ');
    const signingString = headerNames
      .map((header) => {
        if (header === '(request-target)') {
          return '(request-target): get /inbox'; // Simplified
        }
        return `${header}: ${headers[header]}`;
      })
      .join('\n');

    // Verify signature (simplified - in production, fetch public key from keyId)
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(signingString);
    return verifier.verify(this.publicKey, sigParams.signature, 'base64');
  }

  private parseSignatureHeader(header: string): any {
    const match = header.match(
      /keyId="([^"]+)",algorithm="([^"]+)",headers="([^"]+)",signature="([^"]+)"/
    );
    if (!match) return null;

    return {
      keyId: match[1],
      algorithm: match[2],
      headers: match[3],
      signature: match[4],
    };
  }
}

export default FederationService;
