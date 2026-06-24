import type { SalesPageProfile } from './types';

// The fallback when there's no sales page and no preset chosen.
const DEFAULT_VOICE = 'punchy, plain-spoken direct response';

// Resolve the final voice instruction the prompts run on.
//
// The sales page is the PRIMARY voice source. A preset (the `tweak`) is only a
// light seasoning on top of it, never a takeover. With no page, the preset (or
// the default) carries the voice on its own — the original behavior.
//
//   page + preset → page voice dominates, preset nudges it
//   page only     → match the page voice, full stop
//   preset only   → the preset, as before
//   neither       → plain DR default
export function composeVoice(
  page: SalesPageProfile | undefined,
  tweak: string | undefined,
): string {
  const t = tweak?.trim();
  const profile = page?.voiceProfile?.trim();

  if (profile && t) {
    return `PRIMARY VOICE — the brand's own, taken from their sales page. Match it closely; this is the voice readers already know:
${profile}

Then apply only a LIGHT seasoning toward: ${t}. The sales-page voice dominates; the preset is a slight tweak, not a takeover. If the two ever conflict, the sales-page voice wins.`;
  }
  if (profile) {
    return `VOICE — match the brand's own voice, taken from their sales page. Stay inside it; do not drift to a generic direct-response tone:
${profile}`;
  }
  return t || DEFAULT_VOICE;
}
