/**
 * HTTP Signature Engine (RFC 7235 / Mastodon-compatible)
 * Signs outgoing AP requests, verifies incoming AP requests
 */

export interface SignedRequestOptions {
  method: string;
  url: string;
  body?: string;
  privateKeyPem: string;
  keyId: string;
}

export interface SignatureComponents {
  keyId: string;
  algorithm: string;
  headers: string;
  signature: string;
}

/** Import a PEM-encoded RSA private key */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemBody = pem
    .replace(/-----BEGIN (RSA )?PRIVATE KEY-----/, '')
    .replace(/-----END (RSA )?PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    der.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

/** Import a PEM-encoded RSA public key */
async function importPublicKey(pem: string): Promise<CryptoKey> {
  const pemBody = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'spki',
    der.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
}

/** Compute SHA-256 Digest header value */
export async function computeDigest(body: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(body);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  const base64 = btoa(String.fromCharCode(...hashArray));
  return `SHA-256=${base64}`;
}

/** Sign an outgoing HTTP request with HTTP Signatures */
export async function signRequest(opts: SignedRequestOptions): Promise<Record<string, string>> {
  const { method, url, body, privateKeyPem, keyId } = opts;
  const parsedUrl = new URL(url);
  const date = new Date().toUTCString();
  const target = `${method.toLowerCase()} ${parsedUrl.pathname}${parsedUrl.search}`;

  const headers: Record<string, string> = {
    host: parsedUrl.host,
    date,
  };

  let signedHeaders = '(request-target) host date';

  if (body) {
    const digest = await computeDigest(body);
    headers['digest'] = digest;
    headers['content-type'] = 'application/activity+json';
    signedHeaders += ' digest content-type';
  }

  const signingString = [
    `(request-target): ${target}`,
    `host: ${headers.host}`,
    `date: ${headers.date}`,
    ...(body ? [`digest: ${headers.digest}`, `content-type: ${headers['content-type']}`] : []),
  ].join('\n');

  const privateKey = await importPrivateKey(privateKeyPem);
  const encoder = new TextEncoder();
  const sigBuffer = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    privateKey,
    encoder.encode(signingString)
  );

  const sigBase64 = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));

  headers['signature'] = [
    `keyId="${keyId}"`,
    `algorithm="rsa-sha256"`,
    `headers="${signedHeaders}"`,
    `signature="${sigBase64}"`,
  ].join(',');

  return headers;
}

/** Parse Signature header into components */
export function parseSignatureHeader(sigHeader: string): SignatureComponents | null {
  try {
    const parts: Record<string, string> = {};
    sigHeader.split(',').forEach((part) => {
      const eqIdx = part.indexOf('=');
      const key = part.slice(0, eqIdx).trim();
      const val = part.slice(eqIdx + 1).trim().replace(/^"|"$/g, '');
      parts[key] = val;
    });
    if (!parts.keyId || !parts.signature || !parts.headers) return null;
    return {
      keyId: parts.keyId,
      algorithm: parts.algorithm ?? 'rsa-sha256',
      headers: parts.headers,
      signature: parts.signature,
    };
  } catch {
    return null;
  }
}

/** Fetch public key from remote actor */
export async function fetchPublicKey(keyId: string): Promise<string | null> {
  try {
    const res = await fetch(keyId.split('#')[0], {
      headers: { Accept: 'application/activity+json, application/ld+json' },
    });
    if (!res.ok) return null;
    const actor = await res.json();
    return actor.publicKey?.publicKeyPem ?? null;
  } catch {
    return null;
  }
}

/** Verify an incoming HTTP Signature */
export async function verifySignature(req: Request, bodyText: string): Promise<boolean> {
  try {
    const sigHeader = req.headers.get('signature');
    if (!sigHeader) return false;

    const parsed = parseSignatureHeader(sigHeader);
    if (!parsed) return false;

    const publicKeyPem = await fetchPublicKey(parsed.keyId);
    if (!publicKeyPem) return false;

    // Verify digest if present
    const digestHeader = req.headers.get('digest');
    if (digestHeader) {
      const computedDigest = await computeDigest(bodyText);
      if (computedDigest !== digestHeader) return false;
    }

    // Reconstruct signing string
    const url = new URL(req.url);
    const target = `${req.method.toLowerCase()} ${url.pathname}${url.search}`;
    const headerNames = parsed.headers.split(' ');

    const signingLines = headerNames.map((h) => {
      if (h === '(request-target)') return `(request-target): ${target}`;
      const val = req.headers.get(h);
      return `${h}: ${val ?? ''}`;
    });
    const signingString = signingLines.join('\n');

    const publicKey = await importPublicKey(publicKeyPem);
    const sigBuffer = Uint8Array.from(atob(parsed.signature), (c) => c.charCodeAt(0));

    return crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5' },
      publicKey,
      sigBuffer,
      new TextEncoder().encode(signingString)
    );
  } catch {
    return false;
  }
}
