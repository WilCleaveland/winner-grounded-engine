import { NextResponse } from 'next/server';
import { generateMetaAd } from '@/lib/anthropic';
import { composeVoice } from '@/lib/voice';
import { rateLimited } from '@/lib/ratelimit';
import type { MetaAdRequest } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    // A single Claude call; same cap as the other expand routes.
    const limited = rateLimited(req, 'metaad', 24, 10 * 60_000);
    if (limited) return limited;

    const body = (await req.json()) as MetaAdRequest;

    if (!body?.hook?.trim()) {
      return NextResponse.json({ error: 'A hook is required.' }, { status: 400 });
    }
    // Offer falls back to the page's product, same as generate/email.
    const offer = body.offer?.trim() || body.salesPage?.product || '';
    if (!offer) {
      return NextResponse.json({ error: 'An offer is required.' }, { status: 400 });
    }
    const sources = (body.sources ?? []).filter((s) => s.copy?.trim());
    const voice = composeVoice(body.salesPage, body.voice);

    const ad = await generateMetaAd({ ...body, offer, voice, sources });
    return NextResponse.json(ad);
  } catch (err) {
    const raw = err instanceof Error ? err.message : 'Could not build the Meta ad.';
    const overloaded = /overloaded|\b429\b|\b529\b|rate.?limit/i.test(raw);
    const message = overloaded
      ? 'Claude is briefly overloaded — give it a few seconds and try again.'
      : raw;
    return NextResponse.json({ error: message }, { status: overloaded ? 503 : 500 });
  }
}
