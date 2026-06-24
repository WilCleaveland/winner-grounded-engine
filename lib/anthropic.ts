import Anthropic from '@anthropic-ai/sdk';
import {
  ENGINE_SYSTEM,
  CRAFT_FRAMEWORKS,
  GENERATE_INSTRUCTIONS,
  STRESS_SYSTEM,
  VISION_SYSTEM,
  EMAIL_SYSTEM,
  EMAIL_INSTRUCTIONS,
  STRENGTHEN_SYSTEM,
  STRENGTHEN_INSTRUCTIONS,
  SALESPAGE_SYSTEM,
  SALESPAGE_INSTRUCTIONS,
} from './prompts';
import { PLAYBOOK_PROMPT } from './playbook';
import { scanText } from './unslop/scan';
import type { ScrapedPage } from './scrape';
import type {
  GenerateRequest,
  GenerateResponse,
  Hook,
  StressResult,
  EmailRequest,
  EmailDraft,
  StrengthenRequest,
  StrengthenResult,
  SalesPageProfile,
} from './types';

const MODEL = 'claude-opus-4-8';

function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
  // The API can briefly 429/529 under load; the SDK retries these with
  // backoff. 4 covers transient blips during a live demo.
  return new Anthropic({ apiKey, maxRetries: 4 });
}

// Create a structured-output message and parse its JSON. With json_schema the
// text block is almost always valid JSON, but a response can occasionally come
// back truncated or malformed — rare and transient. The calls are side-effect
// free, so retry once before surfacing a clean, actionable error instead of the
// raw "Unterminated string in JSON …" the V8 parser throws.
async function createJson<T>(
  params: Anthropic.MessageCreateParamsNonStreaming,
): Promise<T> {
  let lastErr: unknown = new Error('Generation failed.');
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await client().messages.create(params);
    const block = res.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') {
      lastErr = new Error('No text content returned from the model.');
      continue;
    }
    try {
      return JSON.parse(block.text) as T;
    } catch {
      // Log which call truncated (the system prompt identifies it) so a recurring
      // ceiling is diagnosable from the server log.
      const sysHint =
        typeof params.system === 'string' ? params.system.slice(0, 48) : 'call';
      console.error(
        `[createJson] parse fail attempt=${attempt} stop=${res.stop_reason} len=${block.text.length} sys="${sysHint}"`,
      );
      lastErr =
        res.stop_reason === 'max_tokens'
          ? new Error('That response ran long and got cut off. Hit Generate again.')
          : new Error('The model returned a cut-off response. Hit Generate again.');
    }
  }
  throw lastErr;
}

// ---- 0. Read the user's own sales page (voice + product) -------------------
// The page is the PRIMARY voice source and grounds the product so hooks stay
// true to the real offer. Run once per generate; the profile is reused by the
// email + strengthen passes without re-scraping.

const SALESPAGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    voiceProfile: { type: 'string' },
    product: { type: 'string' },
    proofOnPage: { type: 'array', items: { type: 'string' } },
  },
  required: ['voiceProfile', 'product', 'proofOnPage'],
};

export async function analyzeSalesPage(
  page: ScrapedPage,
): Promise<SalesPageProfile> {
  const user = `SALES PAGE — ${page.title}\nURL: ${page.url}\n"""\n${page.markdown}\n"""\n\n${SALESPAGE_INSTRUCTIONS}`;

  const out = await createJson<Omit<SalesPageProfile, 'url' | 'title'>>({
    model: MODEL,
    max_tokens: 4096,
    system: SALESPAGE_SYSTEM,
    messages: [{ role: 'user', content: user }],
    output_config: { format: { type: 'json_schema', schema: SALESPAGE_SCHEMA } },
  } as Anthropic.MessageCreateParamsNonStreaming);
  return { url: page.url, title: page.title, ...out };
}

// The product-context block injected into generation/email when a sales page is
// in play. proofOnPage is the ONLY proof downstream copy may reuse (never-falsify).
function salesPageContext(page: SalesPageProfile | undefined): string {
  if (!page) return '';
  const proof = page.proofOnPage.length
    ? `\n\nPROOF/SPECIFICS ACTUALLY ON THE PAGE (you MAY reuse these real specifics; invent NOTHING beyond them):\n${page.proofOnPage.map((p) => `- ${p}`).join('\n')}`
    : '\n\n(The page states no hard proof — so use NO invented numbers, authorities, or testimonials.)';
  return `THE PRODUCT (from the brand's own sales page — ground every hook in this real offer):\n${page.product}${proof}`;
}

// ---- 1. Extract mechanisms + generate hooks -------------------------------

const GENERATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    mechanisms: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          source: { type: 'string' },
          mechanism: { type: 'string' },
        },
        required: ['source', 'mechanism'],
      },
    },
    hooks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          hook: { type: 'string' },
          mechanism: { type: 'string' },
          tier: { type: 'string', enum: ['proven', 'adjacent'] },
          whyItPulls: { type: 'string' },
        },
        required: ['hook', 'mechanism', 'tier', 'whyItPulls'],
      },
    },
  },
  required: ['mechanisms', 'hooks'],
};

export async function generateHooks(
  req: GenerateRequest,
): Promise<GenerateResponse> {
  const count = req.count ?? 10;
  const winners = req.sources
    .map((s, i) => {
      const label = s.label?.trim() || `Winner ${i + 1}`;
      return `WINNER ${i + 1} — ${label}\n"""\n${s.copy.trim()}\n"""`;
    })
    .join('\n\n');

  // Optional Sparse-Priming context — only included when supplied.
  const priming = [
    salesPageContext(req.salesPage),
    req.prospect?.trim() && `PROSPECT (who they are, their pain/goal):\n${req.prospect.trim()}`,
    req.market?.trim() && `MARKET (the mood/belief they're in right now):\n${req.market.trim()}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const user = `OFFER:\n${req.offer}\n\nVOICE:\n${req.voice}${priming ? `\n\n${priming}` : ''}\n\nPROVEN WINNERS (${req.sources.length}):\n\n${winners}\n\n${GENERATE_INSTRUCTIONS}\n\nGenerate ${count} hooks.`;

  return createJson<GenerateResponse>({
    model: MODEL,
    max_tokens: 6144,
    system: `${ENGINE_SYSTEM}\n\n${PLAYBOOK_PROMPT}\n\n${CRAFT_FRAMEWORKS}`,
    messages: [{ role: 'user', content: user }],
    output_config: { format: { type: 'json_schema', schema: GENERATE_SCHEMA } },
  } as Anthropic.MessageCreateParamsNonStreaming);
}

// ---- 1b. Silent unslop gate -----------------------------------------------
// The generation prompt already bans the AI-writing tells, so most hooks come
// back clean. This is the deterministic backstop: the ported scanner reads each
// hook, and anything that still trips an actionable (high/medium) tell gets one
// rewrite pass with the matched tells as guardrails. Invisible to the user —
// they just get clean copy. Low-tier "tells" (ordinary diction) are left alone;
// over-correcting is its own tell.

const CLEAN_SYSTEM = `You are a line editor for a direct-response team. Each piece of copy below tripped specific AI-writing tells. Rewrite each to remove ONLY those tells while preserving its meaning, mechanism, structure, voice, and roughly its length. Do NOT add any new claim, number, authority, testimonial, or fact — rewrites that invent specifics are failures, and keep any [bracketed placeholders] intact. Do not introduce an em dash, the "not X, it's Y" cadence, or any AI diction (delve, leverage, seamless, elevate, unleash, dive in, unlock the potential, etc.). Return one rewrite per item, in the same order.`;

const CLEAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { text: { type: 'string' } },
        required: ['text'],
      },
    },
  },
  required: ['items'],
};

const isActionable = (sev: string) => sev === 'high' || sev === 'medium';

const actionableTells = (text: string): string[] =>
  Array.from(
    new Set(
      scanText(text)
        .findings.filter((f) => isActionable(f.sev))
        .map((f) => f.label),
    ),
  );

// Shared cleanup: rewrite each {text, tells} item to strip its tells, in order.
// Returns cleaned strings aligned to the input; falls back to the original on
// any gap so a cleanup miss never drops copy.
async function cleanCopy(
  items: { text: string; tells: string[] }[],
): Promise<string[]> {
  const list = items
    .map(
      (it, n) =>
        `${n + 1}. COPY:\n${it.text}\n   REMOVE THESE TELLS: ${it.tells.join('; ')}`,
    )
    .join('\n\n');

  const cleaned = (
    await createJson<{ items: { text: string }[] }>({
      model: MODEL,
      max_tokens: 6144,
      system: CLEAN_SYSTEM,
      messages: [
        { role: 'user', content: `${list}\n\nReturn one cleaned item per input, in order.` },
      ],
      output_config: { format: { type: 'json_schema', schema: CLEAN_SCHEMA } },
    } as Anthropic.MessageCreateParamsNonStreaming)
  ).items;
  return items.map((it, n) => cleaned[n]?.text?.trim() || it.text);
}

// Silent gate for the hook matrix — scans each hook, cleans only the ones that
// trip an actionable tell.
export async function unslopHooks(hooks: Hook[]): Promise<Hook[]> {
  const flagged = hooks
    .map((h, i) => ({ i, h, tells: actionableTells(h.hook) }))
    .filter((x) => x.tells.length > 0);

  if (flagged.length === 0) return hooks;

  const cleaned = await cleanCopy(
    flagged.map((x) => ({ text: x.h.hook, tells: x.tells })),
  );

  const out = hooks.slice();
  flagged.forEach((x, n) => {
    out[x.i] = { ...x.h, hook: cleaned[n] };
  });
  return out;
}

// Silent gate for a single block of prose (an email body, a strengthened
// draft). No-op when nothing actionable trips.
async function scrubText(text: string): Promise<string> {
  const tells = actionableTells(text);
  if (tells.length === 0) return text;
  const [cleaned] = await cleanCopy([{ text, tells }]);
  return cleaned;
}

// ---- 2. Stress-test each hook ---------------------------------------------

const STRESS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          hook: { type: 'string' },
          weakness: { type: 'string' },
          survives: { type: 'boolean' },
          verdict: { type: 'string' },
        },
        required: ['hook', 'weakness', 'survives', 'verdict'],
      },
    },
  },
  required: ['results'],
};

export async function stressTest(
  hooks: string[],
  voice: string,
): Promise<StressResult[]> {
  const list = hooks.map((h, i) => `${i + 1}. ${h}`).join('\n');
  const user = `VOICE CONTEXT: ${voice}\n\nHOOKS TO STRESS-TEST:\n${list}\n\nReturn one result per hook, in the same order.`;

  return (
    await createJson<{ results: StressResult[] }>({
      model: MODEL,
      max_tokens: 6144,
      system: STRESS_SYSTEM,
      messages: [{ role: 'user', content: user }],
      output_config: { format: { type: 'json_schema', schema: STRESS_SCHEMA } },
    } as Anthropic.MessageCreateParamsNonStreaming)
  ).results;
}

// ---- Vision: read a creative (copy + visual) from an image -----------------

const CREATIVE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    label: { type: 'string' },
    copy: { type: 'string' },
    visualHook: { type: 'string' }, // "" if the creative is pure text
  },
  required: ['label', 'copy', 'visualHook'],
};

export type ExtractedCreative = {
  label: string;
  copy: string;
  visualHook: string;
};

export type ImageMediaType =
  | 'image/png'
  | 'image/jpeg'
  | 'image/webp'
  | 'image/gif';

export async function extractCreativeFromImage(
  base64: string,
  mediaType: ImageMediaType,
): Promise<ExtractedCreative> {
  return createJson<ExtractedCreative>({
    model: MODEL,
    max_tokens: 3000,
    system: VISION_SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: 'Extract this creative. Return: label (3-5 word descriptor, or the brand if visible), copy (transcribe the actual marketing words — headline, body, CTA), and visualHook (1-2 lines on what the image/visual is doing and why it pulls; "" if it is pure text).',
          },
        ],
      },
    ],
    output_config: { format: { type: 'json_schema', schema: CREATIVE_SCHEMA } },
  } as Anthropic.MessageCreateParamsNonStreaming);
}

// ---- 3. Expand a chosen hook into a full email -----------------------------

const EMAIL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    skeleton: { type: 'string' },
    subject: { type: 'string' },
    body: { type: 'string' },
  },
  required: ['skeleton', 'subject', 'body'],
};

export async function generateEmail(req: EmailRequest): Promise<EmailDraft> {
  const winners = req.sources
    .map((s, i) => {
      const label = s.label?.trim() || `Winner ${i + 1}`;
      return `WINNER ${i + 1} — ${label}\n"""\n${s.copy.trim()}\n"""`;
    })
    .join('\n\n');
  const priming = [
    salesPageContext(req.salesPage),
    req.prospect?.trim() && `PROSPECT:\n${req.prospect.trim()}`,
    req.market?.trim() && `MARKET:\n${req.market.trim()}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const user = `OFFER:\n${req.offer}\n\nVOICE:\n${req.voice}${priming ? `\n\n${priming}` : ''}\n\nTHE WINNING HOOK to build the email from:\n"${req.hook}"\n\nVOICE REFERENCE — model the energy of these proven winners:\n\n${winners}\n\n${EMAIL_INSTRUCTIONS}`;

  const draft = await createJson<EmailDraft>({
    model: MODEL,
    max_tokens: 4096,
    system: `${EMAIL_SYSTEM}\n\n${CRAFT_FRAMEWORKS}`,
    messages: [{ role: 'user', content: user }],
    output_config: { format: { type: 'json_schema', schema: EMAIL_SCHEMA } },
  } as Anthropic.MessageCreateParamsNonStreaming);
  // Silent gate: scrub the subject and body before they're shown.
  const [subject, body] = await Promise.all([
    scrubText(draft.subject),
    scrubText(draft.body),
  ]);
  return { ...draft, subject, body };
}

// ---- 4. The visible 9-step strengthen-a-draft pass -------------------------

const STRENGTHEN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    body: { type: 'string' },
    moves: { type: 'array', items: { type: 'string' } },
  },
  required: ['body', 'moves'],
};

export async function strengthenDraft(
  req: StrengthenRequest,
): Promise<StrengthenResult> {
  const user = `VOICE:\n${req.voice}\n\nDRAFT TO STRENGTHEN:\n"""\n${req.body}\n"""\n\n${STRENGTHEN_INSTRUCTIONS}`;

  const out = await createJson<StrengthenResult>({
    model: MODEL,
    max_tokens: 4096,
    system: STRENGTHEN_SYSTEM,
    messages: [{ role: 'user', content: user }],
    output_config: { format: { type: 'json_schema', schema: STRENGTHEN_SCHEMA } },
  } as Anthropic.MessageCreateParamsNonStreaming);
  return { ...out, body: await scrubText(out.body) };
}
