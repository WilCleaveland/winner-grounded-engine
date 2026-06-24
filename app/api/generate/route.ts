import { NextResponse } from 'next/server';
import {
  generateHooks,
  unslopHooks,
  stressTest,
  analyzeSalesPage,
} from '@/lib/anthropic';
import { scrapeSalesPage } from '@/lib/scrape';
import { composeVoice } from '@/lib/voice';
import { rateLimited } from '@/lib/ratelimit';
import { MOCK_RESULT } from '@/data/mockResult';
import type { GenerateRequest } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

type GenerateBody = GenerateRequest & { salesPageUrl?: string };

export async function POST(req: Request) {
  try {
    // The expensive path (Firecrawl + ~4 Claude calls). Cap it hardest.
    const limited = rateLimited(req, 'gen', 8, 10 * 60_000);
    if (limited) return limited;

    const body = (await req.json()) as GenerateBody;

    if (!body?.offer?.trim()) {
      return NextResponse.json({ error: 'An offer is required.' }, { status: 400 });
    }
    const sources = (body.sources ?? []).filter((s) => s.copy?.trim());
    if (sources.length === 0) {
      return NextResponse.json(
        { error: 'Paste at least one proven winner.' },
        { status: 400 },
      );
    }

    // Demo mode: serve canned output, no API call. Local-only (prod never sets it).
    if (process.env.ENGINE_MOCK === '1') {
      await new Promise((r) => setTimeout(r, 700));
      return NextResponse.json(MOCK_RESULT);
    }

    // The sales page (when supplied) is the primary voice + product source.
    // Scrape it, distill it, then let it drive the voice; the selected preset
    // (body.voice) is only a light tweak on top.
    let salesPage = body.salesPage;
    const url = body.salesPageUrl?.trim();
    if (url && !salesPage) {
      const page = await scrapeSalesPage(url);
      salesPage = await analyzeSalesPage(page);
    }
    const voice = composeVoice(salesPage, body.voice);

    const gen = await generateHooks({ ...body, voice, sources, salesPage });
    // Silent quality gate: scrub any AI-writing tells before the copy is shown
    // or stress-tested. The generation prompt already avoids them, so this is a
    // no-op for clean batches (no extra API call when nothing trips).
    const cleanHooks = await unslopHooks(gen.hooks);
    const stress = await stressTest(
      cleanHooks.map((h) => h.hook),
      voice,
    );
    const hooks = cleanHooks.map((h, i) => ({ ...h, stress: stress[i] ?? null }));

    return NextResponse.json({ mechanisms: gen.mechanisms, hooks, salesPage });
  } catch (err) {
    const raw = err instanceof Error ? err.message : 'Generation failed.';
    const overloaded = /overloaded|\b429\b|\b529\b|rate.?limit/i.test(raw);
    const message = overloaded
      ? 'Claude is briefly overloaded — give it a few seconds and hit Generate again.'
      : raw;
    return NextResponse.json(
      { error: message },
      { status: overloaded ? 503 : 500 },
    );
  }
}
