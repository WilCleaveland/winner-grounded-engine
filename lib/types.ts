// Shared types. Every input method normalizes to a SourceWinner, then the
// engine runs the same pipeline regardless of where the copy came from.

export type InputOrigin =
  | 'paste'
  | 'url'
  | 'vsl'
  | 'screenshot'
  | 'adlibrary'
  | 'sample';

export type SourceWinner = {
  id: string;
  label: string; // short human label, e.g. "Ridge — wallet bulk hook"
  copy: string; // the proven winning copy
  origin: InputOrigin;
  meta?: Record<string, string>; // e.g. { advertiser, url, startedRunning }
};

export type Mechanism = {
  source: string; // which winner this was drawn from
  mechanism: string; // WHY it won — the structural reason, not the surface words
};

export type HookTier = 'proven' | 'adjacent';

export type Hook = {
  hook: string; // the fresh hook line
  mechanism: string; // the single lever this hook pulls
  tier: HookTier; // "proven" re-fire of the winner vs "adjacent" angle to test
  whyItPulls: string; // one line: why this should convert cold traffic
};

export type StressResult = {
  hook: string;
  weakness: string; // the strongest objection a skeptical reader/buyer raises
  survives: boolean; // does it hold up under the stress test?
  verdict: string; // one-line keep / cut / sharpen call
};

export type GenerateRequest = {
  offer: string;
  voice: string;
  sources: { label: string; copy: string }[];
  prospect?: string; // optional Sparse-Priming: who the reader is, their pain/goal
  market?: string; // optional Sparse-Priming: the market's current mood/belief
  salesPage?: SalesPageProfile; // the scraped page: primary voice + product source
  count?: number;
};

// Distilled from the user's own sales page (scraped). The page is the PRIMARY
// voice source and grounds the product facts so hooks stay true to the real
// offer (never-falsify: proofOnPage is the only proof generation may reuse).
export type SalesPageProfile = {
  url: string;
  title: string;
  voiceProfile: string; // the brand's actual voice, concrete enough to imitate
  product: string; // what's sold, the core promise/mechanism, the audience
  proofOnPage: string[]; // real specifics on the page that copy MAY reuse
};

export type GenerateResponse = {
  mechanisms: Mechanism[];
  hooks: Hook[];
  salesPage?: SalesPageProfile; // echoed back so the client can reuse it
};

// Expand a chosen hook into a full email (the snapshot doctrine).
export type EmailRequest = {
  hook: string;
  offer: string;
  voice: string;
  sources: { label: string; copy: string }[];
  prospect?: string;
  market?: string;
  salesPage?: SalesPageProfile; // reused from generate; no re-scrape
};

export type EmailDraft = {
  skeleton: string; // which of the 5 body skeletons (or "Epiphany-Bridge")
  subject: string;
  body: string;
};

// The visible 9-step strengthen-a-draft pass.
export type StrengthenRequest = {
  body: string;
  voice: string;
  salesPage?: SalesPageProfile; // keep the brand voice through the strengthen pass
};

export type StrengthenResult = {
  body: string;
  moves: string[]; // the passes that actually changed something
};

// Expand a chosen hook into a single-image Meta (Facebook/Instagram) Feed ad.
export type MetaAdRequest = {
  hook: string;
  offer: string;
  voice: string;
  sources: { label: string; copy: string }[];
  prospect?: string;
  market?: string;
  salesPage?: SalesPageProfile;
};

// ---- Input source: pull a competitor's live ads from the Meta Ad Library ----
// Type an advertiser, scrape their currently-running Feed ads, and load any of
// them as a proven winner. The Ad Library only lists ads a competitor is
// actually spending on, so "live" is a real signal — the dream input for a
// media buyer.
export type AdLibraryRequest = {
  query: string; // the advertiser / brand to search
  country?: string; // ISO-2, defaults to US
};

export type PulledAd = {
  id: string; // Meta Library ID
  primaryText: string; // the ad body copy (above the creative)
  headline: string; // the headline under the creative ("" if none)
  cta: string; // the button label ("" if none)
  startedRunning: string; // when it started running ("" if not shown)
  destination: string; // the landing domain/URL ("" if none)
};

export type AdLibraryResponse = {
  advertiser: string; // the advertiser label the search resolved to
  ads: PulledAd[];
};

// ---- Input source: model a VSL / video sales page --------------------------
// Scrape a competitor's video-sales-letter page and pull the spoken hook +
// persuasion beats as a source winner. DR VSL pages almost always print the
// script on-page (SEO + skimmers), so the transcript is usually recoverable;
// when it isn't, we distill from the page's written sales copy and say so.
export type VslRequest = { url: string };

export type VslWinner = {
  label: string; // short human label, e.g. "BeamDreams VSL — sleep hook"
  copy: string; // the VSL hook + key persuasion beats, as source copy
  transcriptFound: boolean; // true = pulled an actual video script off the page
  note: string; // one line on what was pulled (transcript vs page copy)
};

export type MetaAd = {
  primaryTexts: string[]; // 3 variations; first line is the scroll-stopper
  headline: string; // benefit line under the creative (~27 ideal, 40 max)
  description: string; // optional reinforcement (~25-30), often hidden
  cta: string; // one of Meta's preset button labels
  creativeDirection: string; // what the image/video should show
  compliance: string[]; // Meta policy risks the copy still carries; [] if clean
};
