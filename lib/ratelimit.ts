// Tiny in-memory per-IP rate limiter. Every paid route spends real Anthropic
// (and, for generate, Firecrawl) credits per call, and the app is public — so
// this caps how fast one visitor can drain the keys. A real user never hits
// these limits; a bot looping the endpoint gets a 429 after a few tries.
//
// The app runs as a single long-lived process (systemd `next start`), so a
// module-level Map persists across requests — no Redis needed at contest scale.

import { NextResponse } from 'next/server';

const buckets = new Map<string, number[]>();

export type RateVerdict = { ok: boolean; retryAfterSec: number };

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateVerdict {
  const now = Date.now();
  const cutoff = now - windowMs;
  const hits = (buckets.get(key) ?? []).filter((t) => t > cutoff);

  if (hits.length >= limit) {
    buckets.set(key, hits);
    const retryAfterSec = Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000));
    return { ok: false, retryAfterSec };
  }

  hits.push(now);
  buckets.set(key, hits);
  return { ok: true, retryAfterSec: 0 };
}

// The client's IP, read from the header Caddy sets. Caddy APPENDS the real peer
// to X-Forwarded-For, so the LAST entry is the one it observed — taking the
// first would let a client spoof the header and dodge the limit.
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return req.headers.get('x-real-ip') || 'unknown';
}

// Shared helper for the routes: returns a 429 Response when over the limit,
// or null to proceed. Keeps the per-route call to one line.
export function rateLimited(
  req: Request,
  bucket: string,
  limit: number,
  windowMs: number,
): NextResponse | null {
  const v = rateLimit(`${bucket}:${clientIp(req)}`, limit, windowMs);
  if (v.ok) return null;
  const mins = Math.round(windowMs / 60000);
  return NextResponse.json(
    {
      error: `Rate limit: ${limit} per ${mins} min. Give it about ${v.retryAfterSec}s and try again.`,
    },
    { status: 429, headers: { 'retry-after': String(v.retryAfterSec) } },
  );
}
