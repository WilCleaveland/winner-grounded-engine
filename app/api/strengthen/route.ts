import { NextResponse } from 'next/server';
import { strengthenDraft } from '@/lib/anthropic';
import { composeVoice } from '@/lib/voice';
import { rateLimited } from '@/lib/ratelimit';
import type { StrengthenRequest } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    // A single Claude call; looser cap than generate, still abuse-proof.
    const limited = rateLimited(req, 'strengthen', 24, 10 * 60_000);
    if (limited) return limited;

    const body = (await req.json()) as StrengthenRequest;

    if (!body?.body?.trim()) {
      return NextResponse.json({ error: 'A draft is required.' }, { status: 400 });
    }
    const voice = composeVoice(body.salesPage, body.voice);

    const result = await strengthenDraft({ body: body.body, voice });
    return NextResponse.json(result);
  } catch (err) {
    const raw = err instanceof Error ? err.message : 'Could not strengthen the draft.';
    const overloaded = /overloaded|\b429\b|\b529\b|rate.?limit/i.test(raw);
    const message = overloaded
      ? 'Claude is briefly overloaded — give it a few seconds and try again.'
      : raw;
    return NextResponse.json({ error: message }, { status: overloaded ? 503 : 500 });
  }
}
