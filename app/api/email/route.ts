import { NextResponse } from 'next/server';
import { generateEmail } from '@/lib/anthropic';
import { composeVoice } from '@/lib/voice';
import type { EmailRequest } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as EmailRequest;

    if (!body?.hook?.trim()) {
      return NextResponse.json({ error: 'A hook is required.' }, { status: 400 });
    }
    if (!body?.offer?.trim()) {
      return NextResponse.json({ error: 'An offer is required.' }, { status: 400 });
    }
    const sources = (body.sources ?? []).filter((s) => s.copy?.trim());
    // Same voice blend as generate, reusing the sales-page profile the client
    // already has (no re-scrape).
    const voice = composeVoice(body.salesPage, body.voice);

    const draft = await generateEmail({ ...body, voice, sources });
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
