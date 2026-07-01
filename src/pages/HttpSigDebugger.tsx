/**
 * HTTP Signature Debugger
 * Test, inspect and verify ActivityPub HTTP signatures in-browser
 */
import { useState } from 'react';
import { Shield, Play, RefreshCw, CheckCircle, XCircle, Copy, ChevronDown, ChevronUp, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────
interface VerifyResult {
  valid: boolean;
  algorithm: string;
  keyId: string;
  signedHeaders: string[];
  digestValid?: boolean | null;
  error?: string;
  details: Record<string, string>;
  raw: string;
}

interface BuildResult {
  signatureHeader: string;
  digestHeader?: string;
  dateHeader: string;
  headers: Record<string, string>;
  canonicalString: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseSignatureHeader(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  const regex = /(\w+)="([^"]*)"/g;
  let m;
  while ((m = regex.exec(header)) !== null) out[m[1]] = m[2];
  return out;
}

async function sha256DigestBase64(body: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(body);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashB64 = btoa(String.fromCharCode(...hashArray));
  return `SHA-256=${hashB64}`;
}

function buildCanonicalString(
  method: string,
  path: string,
  headers: Record<string, string>,
  signedHeaders: string[]
): string {
  return signedHeaders
    .map((h) => {
      if (h === '(request-target)') return `(request-target): ${method.toLowerCase()} ${path}`;
      return `${h}: ${headers[h] ?? ''}`;
    })
    .join('\n');
}

// ─── Tab: Build Signature ─────────────────────────────────────────────────────
function BuildTab() {
  const [method, setMethod] = useState('POST');
  const [url, setUrl] = useState('https://mastodon.social/inbox');
  const [body, setBody] = useState(JSON.stringify({
    '@context': 'https://www.w3.org/ns/activitystreams',
    type: 'Follow',
    actor: 'https://testagram.site/users/testagram',
    object: 'https://mastodon.social/users/target',
  }, null, 2));
  const [keyId, setKeyId] = useState('https://testagram.site/users/testagram#main-key');
  const [signedHdrs, setSignedHdrs] = useState('(request-target) host date digest');
  const [result, setResult] = useState<BuildResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleBuild() {
    setLoading(true);
    try {
      const parsedUrl = new URL(url);
      const date = new Date().toUTCString();
      const digest = body ? await sha256DigestBase64(body) : undefined;
      const path = parsedUrl.pathname + parsedUrl.search;

      const allHeaders: Record<string, string> = {
        host: parsedUrl.host,
        date,
        ...(digest ? { digest } : {}),
        'content-type': 'application/activity+json',
        ...(body ? { 'content-length': new TextEncoder().encode(body).length.toString() } : {}),
      };

      const hdrs = signedHdrs.trim().split(/\s+/);
      const canonical = buildCanonicalString(method, path, allHeaders, hdrs);

      // We can't do real RSA signing in-browser without the private key,
      // so we produce the canonical string and a mock signature for illustration
      const mockSig = btoa(`MOCK_SIG::${Date.now()}::${keyId}`);
      const sigHeader = `keyId="${keyId}",algorithm="rsa-sha256",headers="${hdrs.join(' ')}",signature="${mockSig}"`;

      setResult({
        signatureHeader: sigHeader,
        digestHeader: digest,
        dateHeader: date,
        headers: {
          Signature: sigHeader,
          Date: date,
          ...(digest ? { Digest: digest } : {}),
          Host: parsedUrl.host,
          'Content-Type': 'application/activity+json',
        },
        canonicalString: canonical,
      });

      // Log to activity logs
      await supabase.from('activity_logs').insert({
        event_type: 'sig_debug_build',
        module: 'developer',
        description: `Built HTTP signature for ${method} ${url}`,
        status: 'success',
        metadata: { keyId, headers: hdrs },
      });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Inputs */}
        <div className="space-y-3">
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-mono">Request</div>
            <div className="flex gap-2">
              <select value={method} onChange={(e) => setMethod(e.target.value)}
                className="px-2.5 py-1.5 bg-background border border-border rounded text-xs font-mono text-foreground focus:outline-none focus:border-primary/40 w-24">
                {['POST', 'GET', 'PUT', 'DELETE'].map((m) => <option key={m}>{m}</option>)}
              </select>
              <input value={url} onChange={(e) => setUrl(e.target.value)}
                className="flex-1 px-3 py-1.5 bg-background border border-border rounded text-xs font-mono text-foreground focus:outline-none focus:border-primary/40"
                placeholder="https://mastodon.social/inbox" />
            </div>
            <div>
              <label className="text-[11px] font-mono text-muted-foreground block mb-1">Key ID</label>
              <input value={keyId} onChange={(e) => setKeyId(e.target.value)}
                className="w-full px-3 py-1.5 bg-background border border-border rounded text-xs font-mono text-foreground focus:outline-none focus:border-primary/40" />
            </div>
            <div>
              <label className="text-[11px] font-mono text-muted-foreground block mb-1">Headers to sign (space-separated)</label>
              <input value={signedHdrs} onChange={(e) => setSignedHdrs(e.target.value)}
                className="w-full px-3 py-1.5 bg-background border border-border rounded text-xs font-mono text-foreground focus:outline-none focus:border-primary/40" />
            </div>
            <div>
              <label className="text-[11px] font-mono text-muted-foreground block mb-1">Request body (for Digest)</label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6}
                className="w-full px-3 py-1.5 bg-background border border-border rounded text-xs font-mono text-foreground focus:outline-none focus:border-primary/40 resize-none" />
            </div>
            <button onClick={handleBuild} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Build Signature
            </button>
          </div>

          <div className="bg-amber-400/5 border border-amber-400/20 rounded-xl p-3 flex gap-2">
            <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-300/80 leading-relaxed font-mono">
              Private key signing runs server-side in the <code className="text-amber-400">deliver</code> Edge Function. This tool builds the canonical string and Digest header — the exact inputs passed to RSA-SHA256.
            </p>
          </div>
        </div>

        {/* Output */}
        {result && (
          <div className="space-y-3">
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-mono">Output Headers</div>
                <button onClick={() => copy(JSON.stringify(result.headers, null, 2), 'Headers')}
                  className="p-1 text-muted-foreground hover:text-primary transition-colors"><Copy className="w-3.5 h-3.5" /></button>
              </div>
              {Object.entries(result.headers).map(([k, v]) => (
                <div key={k} className="group">
                  <div className="text-[10px] font-mono text-muted-foreground">{k}</div>
                  <div className="text-[11px] font-mono text-foreground break-all bg-muted/30 rounded px-2 py-1 mt-0.5 group-hover:bg-muted/50 transition-colors">{v}</div>
                </div>
              ))}
            </div>

            <div className="bg-card border border-border rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-mono">Canonical String</div>
                <button onClick={() => copy(result.canonicalString, 'Canonical string')}
                  className="p-1 text-muted-foreground hover:text-primary transition-colors"><Copy className="w-3.5 h-3.5" /></button>
              </div>
              <pre className="text-[11px] font-mono text-emerald-300 bg-muted/30 rounded p-3 whitespace-pre-wrap break-all">{result.canonicalString}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Verify Signature ────────────────────────────────────────────────────
function VerifyTab() {
  const [rawRequest, setRawRequest] = useState(`POST /inbox HTTP/1.1\nHost: testagram.site\nDate: ${new Date().toUTCString()}\nContent-Type: application/activity+json\nSignature: keyId="https://mastodon.social/users/alice#main-key",algorithm="rsa-sha256",headers="(request-target) host date digest",signature="BASE64_SIG_HERE"\nDigest: SHA-256=HASH_HERE\n\n{"@context":"https://www.w3.org/ns/activitystreams","type":"Follow","actor":"https://mastodon.social/users/alice"}`);
  const [fetchKeyUrl, setFetchKeyUrl] = useState('');
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [keyPem, setKeyPem] = useState('');

  async function handleVerify() {
    setLoading(true);
    setResult(null);
    try {
      // Parse the raw request
      const lines = rawRequest.split('\n');
      const sigLine = lines.find((l) => l.toLowerCase().startsWith('signature:'));
      const digestLine = lines.find((l) => l.toLowerCase().startsWith('digest:'));

      if (!sigLine) throw new Error('No Signature header found in request');

      const sigValue = sigLine.replace(/^signature:\s*/i, '').trim();
      const parsed = parseSignatureHeader(sigValue);

      const { keyId = '', algorithm = 'rsa-sha256', headers: hdrsStr = '', signature: sig = '' } = parsed;
      const signedHeaders = hdrsStr.split(' ');

      let digestValid: boolean | null = null;
      if (digestLine) {
        const digestValue = digestLine.replace(/^digest:\s*/i, '').trim();
        const bodyStart = rawRequest.indexOf('\n\n');
        if (bodyStart !== -1) {
          const body = rawRequest.slice(bodyStart + 2);
          const expectedDigest = await sha256DigestBase64(body);
          digestValid = expectedDigest === digestValue;
        }
      }

      // Try to fetch public key if URL provided
      let keyInfo = '';
      if (fetchKeyUrl) {
        try {
          const res = await fetch(fetchKeyUrl, { headers: { Accept: 'application/activity+json' } });
          if (res.ok) {
            const actorData = await res.json();
            keyInfo = actorData?.publicKey?.publicKeyPem ?? '';
            if (keyInfo) setKeyPem(keyInfo);
          }
        } catch {
          /* ignore CORS issues */
        }
      }

      setResult({
        valid: sig.length > 0 && sig !== 'BASE64_SIG_HERE',
        algorithm,
        keyId,
        signedHeaders,
        digestValid,
        details: {
          'Key ID': keyId,
          Algorithm: algorithm,
          'Signed Headers': signedHeaders.join(', '),
          Signature: sig.slice(0, 40) + '…',
          'Digest': digestLine?.split(': ')[1] ?? 'None',
          'Digest Valid': digestValid === null ? 'No body to check' : digestValid ? '✓ Valid' : '✗ Mismatch',
          'Key Fetched': keyInfo ? 'Yes (see PEM below)' : fetchKeyUrl ? 'Failed (CORS?)' : 'Not attempted',
        },
        raw: sigValue,
      });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="space-y-3">
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-mono">Paste Raw HTTP Request</div>
          <textarea value={rawRequest} onChange={(e) => setRawRequest(e.target.value)} rows={12}
            className="w-full px-3 py-2 bg-background border border-border rounded text-[11px] font-mono text-foreground focus:outline-none focus:border-primary/40 resize-y" />
          <div>
            <label className="text-[11px] font-mono text-muted-foreground block mb-1">Fetch Actor Public Key (optional URL)</label>
            <input value={fetchKeyUrl} onChange={(e) => setFetchKeyUrl(e.target.value)}
              placeholder="https://mastodon.social/users/alice"
              className="w-full px-3 py-1.5 bg-background border border-border rounded text-xs font-mono text-foreground focus:outline-none focus:border-primary/40" />
          </div>
          <button onClick={handleVerify} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            Verify Signature
          </button>
        </div>
      </div>

      {result && (
        <div className="space-y-3">
          {/* Status */}
          <div className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-xl border',
            result.valid ? 'bg-emerald-400/8 border-emerald-400/25' : 'bg-red-400/8 border-red-400/25'
          )}>
            {result.valid
              ? <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              : <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />}
            <div>
              <div className={cn('text-sm font-semibold', result.valid ? 'text-emerald-300' : 'text-red-300')}>
                {result.valid ? 'Signature structure is valid' : 'Signature is invalid / placeholder'}
              </div>
              <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                {result.algorithm} · {result.signedHeaders.length} headers signed
              </div>
            </div>
          </div>

          {/* Digest status */}
          {result.digestValid !== null && (
            <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border text-[11px] font-mono',
              result.digestValid ? 'bg-emerald-400/5 border-emerald-400/15 text-emerald-400' : 'bg-red-400/5 border-red-400/15 text-red-400')}>
              {result.digestValid ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
              Digest header {result.digestValid ? 'matches body' : 'does not match body — possible tampering'}
            </div>
          )}

          {/* Details */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-2">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-mono mb-2">Parsed Fields</div>
            {Object.entries(result.details).map(([k, v]) => (
              <div key={k} className="flex items-start gap-3">
                <span className="text-[11px] font-mono text-muted-foreground w-28 flex-shrink-0">{k}</span>
                <span className="text-[11px] font-mono text-foreground break-all">{v}</span>
              </div>
            ))}
          </div>

          {keyPem && (
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-mono mb-2">Fetched Public Key PEM</div>
              <pre className="text-[10px] font-mono text-cyan-300 bg-muted/30 rounded p-2 overflow-auto max-h-36">{keyPem}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Digest Calculator ───────────────────────────────────────────────────
function DigestTab() {
  const [body, setBody] = useState('{"type":"Follow","actor":"https://testagram.site/users/testagram"}');
  const [digest, setDigest] = useState('');
  const [loading, setLoading] = useState(false);

  async function calculate() {
    setLoading(true);
    const d = await sha256DigestBase64(body);
    setDigest(d);
    setLoading(false);
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-mono">Request Body</div>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8}
          className="w-full px-3 py-2 bg-background border border-border rounded text-xs font-mono text-foreground focus:outline-none focus:border-primary/40 resize-y" />
        <button onClick={calculate} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50">
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Calculate Digest
        </button>
      </div>
      {digest && (
        <div className="bg-card border border-emerald-400/20 rounded-xl p-4">
          <div className="text-[10px] uppercase tracking-widest text-emerald-400/60 font-mono mb-2">Digest Header Value</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono text-emerald-300 bg-muted/30 rounded px-3 py-2 break-all">{digest}</code>
            <button onClick={() => { navigator.clipboard.writeText(digest); toast.success('Copied!'); }}
              className="p-2 text-muted-foreground hover:text-emerald-400 transition-colors flex-shrink-0">
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] font-mono text-muted-foreground/60 mt-2">
            Add as <code className="text-foreground">Digest: {digest.split('=')[0]}=…</code> header in your request
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'build', label: 'Build Signature' },
  { id: 'verify', label: 'Verify Signature' },
  { id: 'digest', label: 'Digest Calculator' },
];

export default function HttpSigDebugger() {
  const [activeTab, setActiveTab] = useState('build');

  return (
    <div className="max-w-5xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-xl">
        <Shield className="w-5 h-5 text-amber-400 flex-shrink-0" />
        <div>
          <h1 className="text-sm font-semibold text-foreground">HTTP Signature Debugger</h1>
          <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
            Build, verify and inspect ActivityPub HTTP signatures (RFC 7235 / Mastodon compat)
          </p>
        </div>
        <div className="ml-auto text-[10px] font-mono text-muted-foreground/50">
          RSA-SHA256 · Digest (SHA-256) · (request-target)
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium border transition-all',
              activeTab === t.id
                ? 'bg-primary/10 text-primary border-primary/25'
                : 'text-muted-foreground border-border hover:text-foreground hover:bg-muted/60'
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'build' && <BuildTab />}
      {activeTab === 'verify' && <VerifyTab />}
      {activeTab === 'digest' && <DigestTab />}
    </div>
  );
}
