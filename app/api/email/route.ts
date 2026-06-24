import { NextResponse } from 'next/server';
import { generateEmail } from '@/lib/anthropic';
import { composeVoice } from '@/lib/voice';
import { rateLimited } from '@/lib/ratelimit';
import type { EmailRequest } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    // A single Claude call; looser cap than generate, still abuse-proof.
    const limited = rateLimited(req, 'email', 24, 10 * 60_000);
    if (limited) return limited;

    const body = (await req.json()) as EmailRequest;

    if (!body?.hook?.trim()) {
      return NextResponse.json({ error: 'A hook is required.' }, { status: 400 });
    }
    // Offer falls back to the page's product, same as generate (so a page-driven
    // session with a blank offer can still expand a hook into an email).
    const offer = body.offer?.trim() || body.salesPage?.product || '';
    if (!offer) {
      return NextResponse.json({ error: 'An offer is required.' }, { status: 400 });
    }
    const sources = (body.sources ?? []).filter((s) => s.copy?.trim());
    // Same voice blend as generate, reusing the sales-page profile the client
    // already has (no re-scrape).
    const voice = composeVoice(body.salesPage, body.voice);

    const draft = await generateEmail({ ...body, offer, voice, sources });
    return NextResponse.json(draft);
  } catch (err) {
    const raw = err instanceof Error ? err.message : 'Could not build the email.';
    const overloaded = /overloaded|\b429\b|\b529\b|rate.?limit/i.test(raw);
    const message = overloaded
      ? 'Claude is briefly overloaded — give it a few seconds and try again.'
      : raw;
    return NextResponse.json({ error: message }, { status: overloaded ? 503 : 500 });
  }
}
