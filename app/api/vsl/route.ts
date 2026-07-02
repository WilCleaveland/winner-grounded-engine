import { NextResponse } from 'next/server';
import { scrapeSalesPage } from '@/lib/scrape';
import { extractVslWinner } from '@/lib/anthropic';
import { rateLimited } from '@/lib/ratelimit';
import type { VslRequest } from '@/lib/types';

export const runtime = 'nodejs';
// A heavy VSL page render plus one Claude extraction call.
export const maxDuration = 150;

export async function POST(req: Request) {
  try {
    // Firecrawl + a Claude call per pull — same cap as the Ad Library path.
    const limited = rateLimited(req, 'vsl', 12, 10 * 60_000);
    if (limited) return limited;

    const body = (await req.json()) as VslRequest;
    const url = body?.url?.trim();
    if (!url) {
      return NextResponse.json(
        { error: 'Paste a VSL / sales-page URL.' },
        { status: 400 },
      );
    }
    if (!/^https?:\/\//i.test(url)) {
      return NextResponse.json(
        { error: 'That doesn’t look like a URL. Include https://' },
        { status: 400 },
      );
    }

    const page = await scrapeSalesPage(url);
    const winner = await extractVslWinner(page);
    if (!winner.copy.trim()) {
      return NextResponse.json(
        { error: 'That page loaded but had no sales copy to model.' },
        { status: 404 },
      );
    }

    return NextResponse.json(winner);
  } catch (err) {
    const raw = err instanceof Error ? err.message : 'Could not read that VSL page.';
    const overloaded = /overloaded|\b429\b|\b529\b|rate.?limit/i.test(raw);
    const message = overloaded
      ? 'Claude is briefly overloaded — give it a few seconds and try again.'
      : raw;
    return NextResponse.json({ error: message }, { status: overloaded ? 503 : 500 });
  }
}
