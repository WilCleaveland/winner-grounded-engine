import { NextResponse } from 'next/server';
import { scrapeAdLibrary } from '@/lib/adlibrary';
import { extractAdsFromLibrary } from '@/lib/anthropic';
import { rateLimited } from '@/lib/ratelimit';
import type { AdLibraryRequest } from '@/lib/types';

export const runtime = 'nodejs';
// Firecrawl render of a heavy JS page + one Claude extraction call.
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    // Firecrawl + a Claude call per pull — cap it like the generate path.
    const limited = rateLimited(req, 'adlib', 12, 10 * 60_000);
    if (limited) return limited;

    const body = (await req.json()) as AdLibraryRequest;
    const query = body?.query?.trim();
    if (!query) {
      return NextResponse.json(
        { error: 'Enter a competitor or brand name to search.' },
        { status: 400 },
      );
    }
    const country = (body.country?.trim() || 'US').toUpperCase();

    const lib = await scrapeAdLibrary(query, country);
    const ads = await extractAdsFromLibrary(lib);
    if (ads.length === 0) {
      return NextResponse.json(
        {
          error: `Found ads for "${query}", but none had readable text copy (image/video-only). Try a brand that runs text-heavy ads.`,
        },
        { status: 404 },
      );
    }

    return NextResponse.json({ advertiser: query, ads });
  } catch (err) {
    const raw = err instanceof Error ? err.message : 'Could not pull the ads.';
    const overloaded = /overloaded|\b429\b|\b529\b|rate.?limit/i.test(raw);
    const message = overloaded
      ? 'Claude is briefly overloaded — give it a few seconds and try the pull again.'
      : raw;
    return NextResponse.json({ error: message }, { status: overloaded ? 503 : 500 });
  }
}
