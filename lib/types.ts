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
  count?: number;
};

export type GenerateResponse = {
  mechanisms: Mechanism[];
  hooks: Hook[];
};

// Expand a chosen hook into a full email (the snapshot doctrine).
export type EmailRequest = {
  hook: string;
  offer: string;
  voice: string;
  sources: { label: string; copy: string }[];
  prospect?: string;
  market?: string;
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
};

export type StrengthenResult = {
  body: string;
  moves: string[]; // the passes that actually changed something
};
