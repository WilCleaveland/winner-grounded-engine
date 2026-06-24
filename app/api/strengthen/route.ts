import { NextResponse } from 'next/server';
import { strengthenDraft } from '@/lib/anthropic';
import type { StrengthenRequest } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as StrengthenRequest;

    if (!body?.body?.trim()) {
      return NextResponse.json({ error: 'A draft is required.' }, { status: 400 });
    }
    const voice = body.voice?.trim() || 'punchy, plain-spoken direct response';

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
