'use client';

import { useEffect, useState } from 'react';

type Hook = {
  hook: string;
  mechanism: string;
  tier: 'proven' | 'adjacent';
  whyItPulls: string;
  stress: { weakness: string; survives: boolean; verdict: string } | null;
};
type SalesPage = {
  url: string;
  title: string;
  voiceProfile: string;
  product: string;
  proofOnPage: string[];
};
type Result = {
  mechanisms: { source: string; mechanism: string }[];
  hooks: Hook[];
  salesPage?: SalesPage;
  mock?: boolean;
};
type Source = { label: string; copy: string };
type StrengthenState = {
  loading: boolean;
  error: string | null;
  result: { body: string; moves: string[] } | null;
};
type EmailState = {
  loading: boolean;
  error: string | null;
  draft: { skeleton: string; subject: string; body: string } | null;
  strengthen: StrengthenState;
};
const freshStrengthen = (): StrengthenState => ({
  loading: false,
  error: null,
  result: null,
});

type MetaAd = {
  primaryTexts: string[];
  headline: string;
  description: string;
  cta: string;
  creativeDirection: string;
  compliance: string[];
};
type MetaAdState = {
  loading: boolean;
  error: string | null;
  ad: MetaAd | null;
};

// A competitor ad pulled from the Meta Ad Library, ready to load as a winner.
type PulledAd = {
  id: string;
  primaryText: string;
  headline: string;
  cta: string;
  startedRunning: string;
  destination: string;
};
type AdLibState = {
  loading: boolean;
  error: string | null;
  advertiser: string;
  ads: PulledAd[];
};
type VslState = {
  loading: boolean;
  error: string | null;
  note: string | null;
};

// Meta Feed truncates primary text at ~125 chars ("See more"); headline shows
// ~27 (40 hard max); description ~25-30 and is often hidden.
const META = { seeMore: 125, headlineMax: 40, descMax: 30 };

// The default voice draws entirely from the user's scraped sales page; the
// presets below are only a light tweak layered on top of it.
const SALESPAGE_VOICE = '__salespage';

const VOICES = [
  {
    label: 'Punchy, plain-spoken direct response',
    guide:
      'Punchy, plain-spoken, blue-collar direct response. Short sentences, concrete nouns, a little rough. No corporate gloss, no hedging.',
  },
  {
    label: 'Urgent preparedness / survival',
    guide:
      'Urgent, high-stakes preparedness voice. Name the threat, the closing window, the cost of waiting. Serious and grounded, never hypey.',
  },
  {
    label: 'Premium DTC — confident & clean',
    guide:
      'Premium DTC. Confident, clean, lightly aspirational. Sell craft and quality over urgency. Tasteful and assured.',
  },
  {
    label: 'Feminine & empathetic',
    guide:
      'Feminine, warm, and feeling-led. Lead with the emotion and the lived experience; reassuring, intimate, conversational — like a trusted friend who genuinely gets it.',
  },
  {
    label: 'Coaching / biz-opp',
    guide:
      'Coaching and business-opportunity voice. Aspirational and future-pacing — paint the after-state vividly. Benefit-driven, full of momentum and possibility.',
  },
];

// The nine strengthen passes, in order — shown next to the button so the user
// knows what the pass actually does. Mirrors STRENGTHEN_SYSTEM in lib/prompts.ts.
const STRENGTHEN_STEPS = [
  'Dimensionalize',
  'Proof',
  'Concision',
  'Reading level',
  'Clarity',
  'Flow & rapport',
  'Power words',
  'Progressive tense',
  'Cut qualifiers',
];

// Which words in `b` carry over from `a` unchanged (LCS). Used to highlight the
// strengthen edits: anything NOT common is something the pass changed or added.
function lcsCommon(a: string[], b: string[]): boolean[] {
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const common = new Array<boolean>(m).fill(false);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      common[j] = true;
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return common;
}

// Render `next` with the words the strengthen pass changed/added highlighted.
// Whitespace (including paragraph breaks) is preserved so <pre> formatting holds.
function highlightEdits(prev: string, next: string) {
  const segs = next.split(/(\s+)/);
  const prevWords = prev.split(/\s+/).filter(Boolean);
  const nextWords = segs.filter((s) => s.trim().length > 0);
  const common = lcsCommon(prevWords, nextWords);
  let wi = 0;
  return segs.map((seg, idx) => {
    if (seg.trim().length === 0) return seg;
    const changed = !common[wi];
    wi += 1;
    return changed ? (
      <mark className="edit" key={idx}>
        {seg}
      </mark>
    ) : (
      <span key={idx}>{seg}</span>
    );
  });
}

export default function Engine() {
  const [offer, setOffer] = useState('');
  const [salesPageUrl, setSalesPageUrl] = useState('');
  const [prospect, setProspect] = useState('');
  const [market, setMarket] = useState('');
  const [voice, setVoice] = useState(SALESPAGE_VOICE);
  const [customVoice, setCustomVoice] = useState('');
  const [sources, setSources] = useState<Source[]>([{ label: '', copy: '' }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [ingesting, setIngesting] = useState<number | null>(null);
  // Which copy-button was just clicked (its key), for the "Copied ✓" flash.
  const [copied, setCopied] = useState<string | null>(null);
  // Auto-source a winner: Meta Ad Library pull + VSL / sales-page pull.
  const [adQuery, setAdQuery] = useState('');
  const [adLib, setAdLib] = useState<AdLibState>({
    loading: false,
    error: null,
    advertiser: '',
    ads: [],
  });
  const [loadedAdIds, setLoadedAdIds] = useState<string[]>([]);
  const [vslUrl, setVslUrl] = useState('');
  const [vsl, setVsl] = useState<VslState>({ loading: false, error: null, note: null });
  // Per-hook email drafts (+ their strengthen pass), keyed by the hook text.
  const [emails, setEmails] = useState<Record<string, EmailState>>({});
  // Per-hook Meta ad drafts, keyed by the hook text.
  const [metaAds, setMetaAds] = useState<Record<string, MetaAdState>>({});

  // Persist the inputs so a refresh never wipes them — restore on mount, save on
  // every change. Loading after mount (not in the initial state) keeps the first
  // client render matching the server render, so there's no hydration mismatch.
  // Results stay ephemeral; only the inputs are saved.
  useEffect(() => {
    try {
      const saved = localStorage.getItem('wge:inputs');
      if (!saved) return;
      const s = JSON.parse(saved);
      if (typeof s.offer === 'string') setOffer(s.offer);
      if (typeof s.salesPageUrl === 'string') setSalesPageUrl(s.salesPageUrl);
      if (typeof s.prospect === 'string') setProspect(s.prospect);
      if (typeof s.market === 'string') setMarket(s.market);
      if (typeof s.voice === 'string') setVoice(s.voice);
      if (typeof s.customVoice === 'string') setCustomVoice(s.customVoice);
      if (Array.isArray(s.sources) && s.sources.length) setSources(s.sources);
    } catch {
      // corrupt or unavailable storage — fall back to the empty defaults
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        'wge:inputs',
        JSON.stringify({ offer, salesPageUrl, prospect, market, voice, customVoice, sources }),
      );
    } catch {
      // private mode / quota — persistence is best-effort, never block the UI
    }
  }, [offer, salesPageUrl, prospect, market, voice, customVoice, sources]);

  const clearInputs = () => {
    setOffer('');
    setSalesPageUrl('');
    setProspect('');
    setMarket('');
    setVoice(SALESPAGE_VOICE);
    setCustomVoice('');
    setSources([{ label: '', copy: '' }]);
    setResult(null);
    try {
      localStorage.removeItem('wge:inputs');
    } catch {
      // ignore — already cleared in memory
    }
  };

  // The voice the user *picked*. The sales-page voice (when there's a page) is
  // applied server-side; here '' means "no preset — draw from the page only".
  const resolveVoice = () => {
    if (voice === SALESPAGE_VOICE) return '';
    if (voice === '__custom') return customVoice;
    const selected = VOICES.find((x) => x.label === voice);
    return selected ? selected.guide : voice;
  };

  const setSource = (i: number, field: keyof Source, val: string) =>
    setSources((s) => s.map((x, j) => (j === i ? { ...x, [field]: val } : x)));
  const addSource = () =>
    setSources((s) => (s.length < 3 ? [...s, { label: '', copy: '' }] : s));
  const removeSource = (i: number) =>
    setSources((s) => (s.length > 1 ? s.filter((_, j) => j !== i) : s));

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1] || '');
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  const ingestImage = async (i: number, file: File) => {
    if (!file.type.startsWith('image/')) return;
    setIngesting(i);
    setError(null);
    try {
      const image = await fileToBase64(file);
      const res = await fetch('/api/ingest-image', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image, mediaType: file.type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not read the image.');
      const visual = data.visualHook ? `\n\n[Visual: ${data.visualHook}]` : '';
      setSources((s) =>
        s.map((x, j) =>
          j === i
            ? {
                label: data.label || x.label || 'Creative (from image)',
                copy: (data.copy || '') + visual,
              }
            : x,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the image.');
    } finally {
      setIngesting(null);
    }
  };

  // Drop an auto-sourced winner into the first empty slot, or append a new one
  // (up to the 3-winner cap). Returns false when the winners are already full.
  // The placement decision reads the current `sources` (this render's value) so
  // the caller gets a synchronous answer — a flag mutated inside the setState
  // updater would still be stale when we returned it.
  const loadWinner = (label: string, copy: string): boolean => {
    const emptyAt = sources.findIndex((x) => !x.copy.trim());
    if (emptyAt >= 0) {
      setSources((s) => s.map((x, j) => (j === emptyAt ? { label, copy } : x)));
      return true;
    }
    if (sources.length < 3) {
      setSources((s) => [...s, { label, copy }]);
      return true;
    }
    return false; // full
  };

  // Fold a pulled ad's fields into one source-copy block, so the mechanism
  // engine sees the headline + CTA + destination as context, not just the body.
  const adToCopy = (ad: PulledAd): string => {
    const bits = [ad.primaryText.trim()];
    if (ad.headline.trim()) bits.push(`Headline: ${ad.headline.trim()}`);
    if (ad.cta.trim()) bits.push(`CTA button: ${ad.cta.trim()}`);
    if (ad.destination.trim()) bits.push(`Destination: ${ad.destination.trim()}`);
    return bits.join('\n');
  };

  const adLabel = (ad: PulledAd) =>
    `${adLib.advertiser} — live ad${ad.startedRunning ? ` (since ${ad.startedRunning})` : ''}`;

  const useAd = (ad: PulledAd) => {
    const ok = loadWinner(adLabel(ad), adToCopy(ad));
    if (!ok) {
      setError('Your 3 winner slots are full — remove one to load another.');
      return;
    }
    setLoadedAdIds((ids) => (ids.includes(ad.id) ? ids : [...ids, ad.id]));
  };

  // One click: load the advertiser's top ads (by impressions) into the winner
  // slots and jump to Generate. Fills empty slots, then appends to the 3-cap —
  // computed in one pass off the current sources (loadWinner in a loop would
  // read a stale emptyAt for the second and third ad).
  const useTopAds = () => {
    const next = sources.slice();
    const added: string[] = [];
    for (const ad of adLib.ads.filter((a) => !loadedAdIds.includes(a.id))) {
      const emptyAt = next.findIndex((x) => !x.copy.trim());
      if (emptyAt >= 0) next[emptyAt] = { label: adLabel(ad), copy: adToCopy(ad) };
      else if (next.length < 3) next.push({ label: adLabel(ad), copy: adToCopy(ad) });
      else break;
      added.push(ad.id);
    }
    if (added.length === 0) {
      setError('Your 3 winner slots are full — remove one to load another.');
      return;
    }
    setSources(next);
    setLoadedAdIds((ids) => [...ids, ...added]);
    document.querySelector('.generate-row')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const pullAdLibrary = async () => {
    const query = adQuery.trim();
    if (!query) return;
    setAdLib({ loading: true, error: null, advertiser: '', ads: [] });
    setLoadedAdIds([]);
    try {
      const res = await fetch('/api/ad-library', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not pull the ads.');
      setAdLib({ loading: false, error: null, advertiser: data.advertiser, ads: data.ads });
    } catch (e) {
      setAdLib({
        loading: false,
        error: e instanceof Error ? e.message : 'Could not pull the ads.',
        advertiser: '',
        ads: [],
      });
    }
  };

  const pullVsl = async () => {
    const url = vslUrl.trim();
    if (!url) return;
    setVsl({ loading: true, error: null, note: null });
    try {
      const res = await fetch('/api/vsl', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not read that VSL page.');
      const ok = loadWinner(data.label || 'VSL winner', data.copy);
      if (!ok) {
        setVsl({
          loading: false,
          error: 'Your 3 winner slots are full — remove one to load the VSL.',
          note: null,
        });
        return;
      }
      setVsl({ loading: false, error: null, note: data.note || 'Loaded into a winner slot.' });
    } catch (e) {
      setVsl({
        loading: false,
        error: e instanceof Error ? e.message : 'Could not read that VSL page.',
        note: null,
      });
    }
  };

  const run = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setEmails({});
    setMetaAds({});
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          offer,
          salesPageUrl: salesPageUrl.trim() || undefined,
          voice: resolveVoice(),
          prospect: prospect.trim() || undefined,
          market: market.trim() || undefined,
          sources: sources.filter((s) => s.copy.trim()),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed.');
      setResult(data as Result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed.');
    } finally {
      setLoading(false);
    }
  };

  const expandEmail = async (h: Hook) => {
    const k = h.hook;
    setEmails((e) => ({
      ...e,
      [k]: { loading: true, error: null, draft: null, strengthen: freshStrengthen() },
    }));
    try {
      const res = await fetch('/api/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          hook: h.hook,
          offer,
          voice: resolveVoice(),
          salesPage: result?.salesPage,
          prospect: prospect.trim() || undefined,
          market: market.trim() || undefined,
          sources: sources.filter((s) => s.copy.trim()),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not build the email.');
      setEmails((e) => ({
        ...e,
        [k]: { loading: false, error: null, draft: data, strengthen: freshStrengthen() },
      }));
    } catch (err) {
      setEmails((e) => ({
        ...e,
        [k]: {
          loading: false,
          error: err instanceof Error ? err.message : 'Could not build the email.',
          draft: null,
          strengthen: freshStrengthen(),
        },
      }));
    }
  };

  const expandMetaAd = async (h: Hook) => {
    const k = h.hook;
    setMetaAds((m) => ({ ...m, [k]: { loading: true, error: null, ad: null } }));
    try {
      const res = await fetch('/api/meta-ad', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          hook: h.hook,
          offer,
          voice: resolveVoice(),
          salesPage: result?.salesPage,
          prospect: prospect.trim() || undefined,
          market: market.trim() || undefined,
          sources: sources.filter((s) => s.copy.trim()),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not build the Meta ad.');
      setMetaAds((m) => ({ ...m, [k]: { loading: false, error: null, ad: data } }));
    } catch (err) {
      setMetaAds((m) => ({
        ...m,
        [k]: {
          loading: false,
          error: err instanceof Error ? err.message : 'Could not build the Meta ad.',
          ad: null,
        },
      }));
    }
  };

  const strengthen = async (k: string) => {
    const st = emails[k];
    if (!st?.draft) return;
    setEmails((e) => ({
      ...e,
      [k]: { ...e[k], strengthen: { loading: true, error: null, result: null } },
    }));
    try {
      const res = await fetch('/api/strengthen', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          body: st.draft.body,
          voice: resolveVoice(),
          salesPage: result?.salesPage,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not strengthen the draft.');
      setEmails((e) => ({
        ...e,
        [k]: { ...e[k], strengthen: { loading: false, error: null, result: data } },
      }));
    } catch (err) {
      setEmails((e) => ({
        ...e,
        [k]: {
          ...e[k],
          strengthen: {
            loading: false,
            error: err instanceof Error ? err.message : 'Could not strengthen the draft.',
            result: null,
          },
        },
      }));
    }
  };

  // A small "Copy" action for any output the user will paste into an ESP or
  // Ads Manager. Keyed so only the clicked button flashes "Copied ✓".
  const copyBtn = (key: string, text: string) => (
    <button
      className="btn-copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          // Clipboard API needs focus/permission; fall back to the old way.
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }
        setCopied(key);
        setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
      }}
    >
      {copied === key ? 'Copied ✓' : 'Copy'}
    </button>
  );

  const emailPanel = (h: Hook) => {
    const em = emails[h.hook];
    return (
      <div className="email-zone">
        <button
          className="btn-email"
          onClick={() => expandEmail(h)}
          disabled={em?.loading}
        >
          {em?.loading
            ? 'Building the email…'
            : em?.draft
              ? '↻ Rebuild email'
              : 'Expand to a full email →'}
        </button>
        {em?.error && <div className="error">{em.error}</div>}
        {em?.draft && (
          <div className="emaildraft">
            <div className="email-skeleton">
              <span className="tag">{em.draft.skeleton}</span>
              <span className="label-inline">skeleton</span>
              {copyBtn(
                `email:${h.hook}`,
                `Subject: ${em.draft.subject}\n\n${em.strengthen.result?.body ?? em.draft.body}`,
              )}
            </div>
            <p className="email-subject">
              <span className="email-k">Subject</span> {em.draft.subject}
            </p>
            <pre className="email-body">
              {em.strengthen.result
                ? highlightEdits(em.draft.body, em.strengthen.result.body)
                : em.draft.body}
            </pre>
            <div className="strengthen-row">
              <button
                className="btn"
                onClick={() => strengthen(h.hook)}
                disabled={em.strengthen.loading}
              >
                {em.strengthen.loading
                  ? 'Running the 9-step pass…'
                  : em.strengthen.result
                    ? '↻ Re-run strengthen pass'
                    : 'Strengthen this draft (9-step pass)'}
              </button>
              <p className="strengthen-explain">
                Runs the draft through the house copy-chief checklist — nine passes
                that sharpen the copy without touching the offer, structure, or
                voice, and never inventing proof:{' '}
                {STRENGTHEN_STEPS.map((s, i) => (
                  <span key={s}>
                    <span className="step">{s}</span>
                    {i < STRENGTHEN_STEPS.length - 1 ? ', ' : '.'}
                  </span>
                ))}{' '}
                It applies only what helps and lists the passes it used.
              </p>
            </div>
            {em.strengthen.error && <div className="error">{em.strengthen.error}</div>}
            {em.strengthen.result && (
              <div className="moves">
                <span className="label-inline">
                  Strengthened — <mark className="edit">highlighted</mark> text is
                  what the pass changed. Moves applied:
                </span>
                <ul>
                  {em.strengthen.result.moves.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const charNote = (len: number, max: number, ideal: number) => (
    <span className={`charcount ${len > max ? 'over' : ''}`}>
      {len} chars · aim ~{ideal}, max {max}
    </span>
  );

  // Show the primary text with Meta's "See more" fold marked, so the user sees
  // exactly what shows before the tap.
  const primaryWithCutoff = (text: string) => {
    if (text.length <= META.seeMore) return <span>{text}</span>;
    return (
      <>
        <span>{text.slice(0, META.seeMore)}</span>
        <span className="see-more"> … See more</span>
        <span className="pt-folded">{text.slice(META.seeMore)}</span>
      </>
    );
  };

  const metaAdPanel = (h: Hook) => {
    const ma = metaAds[h.hook];
    return (
      <div className="metaad-zone">
        <button
          className="btn-email"
          onClick={() => expandMetaAd(h)}
          disabled={ma?.loading}
        >
          {ma?.loading
            ? 'Building the Meta ad…'
            : ma?.ad
              ? '↻ Rebuild Meta ad'
              : 'Expand to a Meta ad →'}
        </button>
        {ma?.error && <div className="error">{ma.error}</div>}
        {ma?.ad && (
          <div className="metaad">
            <div className="metaad-block">
              <span className="label-inline">Primary text · 3 variations</span>
              <p className="metaad-note">
                The first ~125 chars show before &ldquo;See more&rdquo; — line one
                has to stop the scroll on its own.
              </p>
              {ma.ad.primaryTexts.map((t, i) => (
                <div className="pt-variant" key={i}>
                  <div className="pt-head">
                    <span className="pt-num">{i + 1}</span>
                    <span className="charcount">{t.length} chars</span>
                    {copyBtn(`pt:${h.hook}:${i}`, t)}
                  </div>
                  <p className="pt-body">{primaryWithCutoff(t)}</p>
                </div>
              ))}
            </div>

            <div className="metaad-grid">
              <div className="metaad-field">
                <span className="label-inline">Headline</span>
                <p className="metaad-val">{ma.ad.headline}</p>
                {charNote(ma.ad.headline.length, META.headlineMax, 27)}
              </div>
              <div className="metaad-field">
                <span className="label-inline">Description</span>
                <p className="metaad-val">
                  {ma.ad.description || <span className="muted">(none)</span>}
                </p>
                {charNote(ma.ad.description.length, META.descMax, 25)}
              </div>
            </div>

            <div className="metaad-row">
              <span className="label-inline">CTA button</span>
              <span className="cta-badge">{ma.ad.cta}</span>
            </div>

            <div className="metaad-block">
              <span className="label-inline">Creative direction</span>
              <p className="metaad-val">{ma.ad.creativeDirection}</p>
            </div>

            <div className="metaad-block">
              <span className="label-inline">Meta compliance</span>
              {ma.ad.compliance.length === 0 ? (
                <p className="compliance-clean">
                  No policy flags — reads clean against the common rejection rules.
                </p>
              ) : (
                <ul className="compliance-flags">
                  {ma.ad.compliance.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const hookCard = (h: Hook, key: number) => (
    <div className="hookcard" key={key}>
      <div className="hookline-row">
        <p className="hookline">{h.hook}</p>
        {copyBtn(`hook:${h.hook}`, h.hook)}
      </div>
      <div className="meta">
        <span className="tag">{h.mechanism}</span>
      </div>
      <p className="why">{h.whyItPulls}</p>
      {h.stress && (
        <div className="stress">
          <div className="row1">
            <span className={`badge ${h.stress.survives ? 'good' : 'cut'}`}>
              {h.stress.survives ? 'Survives' : 'Cut / rework'}
            </span>
            <span className="label-inline">Stress test</span>
          </div>
          <p className="weak">
            <strong>Weakest point:</strong> {h.stress.weakness}
          </p>
          <p className="verdict">
            <strong>Verdict:</strong> {h.stress.verdict}
          </p>
        </div>
      )}
      {emailPanel(h)}
      {metaAdPanel(h)}
    </div>
  );

  const canRun =
    !loading &&
    (offer.trim().length > 0 || salesPageUrl.trim().length > 0) &&
    sources.some((s) => s.copy.trim());

  return (
    <>
      {/* Sales page — the primary voice + product source */}
      <div className="field">
        <label className="label">
          Your product sales page URL <span className="opt">optional, but highly recommended for voice guidance</span>
        </label>
        <input
          className="input"
          value={salesPageUrl}
          placeholder="https://… — we read it for your real voice and what proof is actually on the page"
          onChange={(e) => setSalesPageUrl(e.target.value)}
        />
        <p className="fieldnote">
          When set, the page becomes the voice the hooks are written in, and grounds
          them in your real offer (no invented proof).{' '}
          <strong>The voice picker below then only nudges it.</strong>
        </p>
      </div>

      {/* Offer — the target of the hooks. Optional when a sales page is supplied
          (we draw it from the page); fill it to narrow to one product/angle. */}
      <div className="field">
        <label className="label">
          The offer — what are you selling?{' '}
          <span className="opt">
            Only required if sales page URL isn&rsquo;t supplied
          </span>
        </label>
        <input
          className="input"
          value={offer}
          placeholder="e.g. A solar power bank for blackouts, list-building lead magnet"
          onChange={(e) => setOffer(e.target.value)}
        />
      </div>

      {/* Sparse priming — optional context that sharpens the hooks */}
      <div className="field">
        <label className="label">
          Who&rsquo;s the prospect? <span className="opt">optional</span>
        </label>
        <input
          className="input"
          value={prospect}
          placeholder="Who reads this, their pain, what they want, e.g. 'suburban dad, worried about grid-down, wants to protect his family'"
          onChange={(e) => setProspect(e.target.value)}
        />
      </div>

      <div className="field">
        <label className="label">
          Market mood <span className="opt">optional</span>
        </label>
        <input
          className="input"
          value={market}
          placeholder="The belief/mood they're in right now, e.g. 'sick of preparedness hype, been burned by cheap gear'"
          onChange={(e) => setMarket(e.target.value)}
        />
      </div>

      {/* Voice */}
      <div className="field">
        <label className="label">
          Voice {salesPageUrl.trim() && voice !== SALESPAGE_VOICE && (
            <span className="opt">a light tweak on your sales-page voice</span>
          )}
        </label>
        <select
          className="select"
          value={voice}
          onChange={(e) => setVoice(e.target.value)}
        >
          <option value={SALESPAGE_VOICE}>
            Draw from sales page only {salesPageUrl.trim() ? '(recommended)' : ''}
          </option>
          {VOICES.map((v) => (
            <option key={v.label} value={v.label}>
              {v.label}
            </option>
          ))}
          <option value="__custom">Custom…</option>
        </select>
        {voice === SALESPAGE_VOICE && !salesPageUrl.trim() && (
          <p className="fieldnote">
            Add a sales page URL above to use its voice. With no page, this falls
            back to a plain, direct-response voice.
          </p>
        )}
        {voice === '__custom' && (
          <input
            className="input"
            style={{ marginTop: 10 }}
            value={customVoice}
            placeholder="Describe the voice in a sentence"
            onChange={(e) => setCustomVoice(e.target.value)}
          />
        )}
      </div>

      {/* Auto-source a winner — pull one instead of pasting it */}
      <div className="field autosource">
        <label className="label">
          Source a winner automatically{' '}
          <span className="opt">optional — or just paste one below</span>
        </label>

        {/* Meta Ad Library — pull a competitor's live ads */}
        <div className="tool">
          <div className="tool-head">
            <span className="tool-title">Pull a competitor&rsquo;s live ads</span>
            <span className="tool-sub">
              Meta Ad Library — their currently-running Feed ads, by brand name
            </span>
          </div>
          <div className="tool-row">
            <input
              className="input"
              value={adQuery}
              placeholder="Competitor / brand, e.g. Ridge Wallet"
              onChange={(e) => setAdQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !adLib.loading) pullAdLibrary();
              }}
            />
            <button
              className="btn"
              onClick={pullAdLibrary}
              disabled={adLib.loading || !adQuery.trim()}
            >
              {adLib.loading ? 'Pulling…' : 'Pull live ads'}
            </button>
          </div>
          {adLib.loading && (
            <p className="fieldnote">
              Rendering the Ad Library and reading the running ads (~20-40s)…
            </p>
          )}
          {adLib.error && <div className="error">{adLib.error}</div>}
          {adLib.ads.length > 0 && (
            <div className="pulled-ads">
              <div className="pulled-ads-head">
                <p className="fieldnote">
                  {adLib.ads.length} running ad{adLib.ads.length === 1 ? '' : 's'} for{' '}
                  <strong>{adLib.advertiser}</strong>, most-shown first. Load any as a
                  winner:
                </p>
                <button className="btn" onClick={useTopAds}>
                  Use top {Math.min(3, adLib.ads.length)} →
                </button>
              </div>
              {adLib.ads.map((ad) => {
                const added = loadedAdIds.includes(ad.id);
                return (
                  <div className="pulled-ad" key={ad.id || ad.primaryText.slice(0, 24)}>
                    <p className="pulled-ad-copy">{ad.primaryText}</p>
                    <div className="pulled-ad-meta">
                      {ad.headline && <span className="pa-headline">{ad.headline}</span>}
                      {ad.cta && <span className="pa-cta">{ad.cta}</span>}
                      {ad.startedRunning && (
                        <span className="pa-date">since {ad.startedRunning}</span>
                      )}
                      <button
                        className="btn-link"
                        onClick={() => useAd(ad)}
                        disabled={added}
                      >
                        {added ? 'Added ✓' : 'Use as winner →'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* VSL / video sales page — model the spoken hook */}
        <div className="tool">
          <div className="tool-head">
            <span className="tool-title">Model a VSL / video sales page</span>
            <span className="tool-sub">
              Pulls the spoken hook and persuasion beats off the page
            </span>
          </div>
          <div className="tool-row">
            <input
              className="input"
              value={vslUrl}
              placeholder="https://… a video sales letter or long-form sales page"
              onChange={(e) => setVslUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !vsl.loading) pullVsl();
              }}
            />
            <button className="btn" onClick={pullVsl} disabled={vsl.loading || !vslUrl.trim()}>
              {vsl.loading ? 'Reading…' : 'Pull the hook'}
            </button>
          </div>
          {vsl.loading && (
            <p className="fieldnote">Reading the page and pulling the script (~20-40s)…</p>
          )}
          {vsl.error && <div className="error">{vsl.error}</div>}
          {vsl.note && <p className="fieldnote vsl-note">Loaded a winner. {vsl.note}</p>}
        </div>
      </div>

      {/* Sources */}
      <div className="field">
        <div className="srchead">
          <label className="label">Proven winners — paste, or load from above</label>
        </div>

        {sources.map((s, i) => (
          <div className="srcblock" key={i}>
            <div className="srchead">
              <span className="label">Winner {i + 1}</span>
              {sources.length > 1 && (
                <button className="btn-link" onClick={() => removeSource(i)}>
                  remove
                </button>
              )}
            </div>
            <input
              className="input"
              value={s.label}
              placeholder="Label (optional) — e.g. 'Q3 blackout email, 31% open'"
              onChange={(e) => setSource(i, 'label', e.target.value)}
            />
            <textarea
              className="textarea"
              value={s.copy}
              placeholder="Paste the winning email, ad, or landing-page copy here…"
              onChange={(e) => setSource(i, 'copy', e.target.value)}
              onPaste={(e) => {
                const item = Array.from(e.clipboardData.items).find((it) =>
                  it.type.startsWith('image/'),
                );
                const file = item?.getAsFile();
                if (file) {
                  e.preventDefault();
                  ingestImage(i, file);
                }
              }}
            />
            <div
              className="dropzone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) ingestImage(i, file);
              }}
            >
              {ingesting === i ? (
                <span>Reading the image — copy + visual…</span>
              ) : (
                <span>
                  …or drop a screenshot, paste an image (⌘V), or{' '}
                  <label className="filelink">
                    browse
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) ingestImage(i, file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  . Vision reads the copy and the visual.
                </span>
              )}
            </div>
          </div>
        ))}

        {sources.length < 3 && (
          <div className="row">
            <button className="btn" onClick={addSource}>
              + Add another winner
            </button>
          </div>
        )}
      </div>

      <div className="generate-row">
        <button className="btn-accent" onClick={run} disabled={!canRun}>
          {loading ? 'Working…' : 'Generate hooks'}
        </button>
        {loading && (
          <span className="spinner">
            Extracting mechanisms → generating → stress-testing (~20s)
          </span>
        )}
        {!loading &&
          (offer.trim() || salesPageUrl.trim() || sources.some((s) => s.copy.trim())) && (
            <button className="btn-link" onClick={clearInputs}>
              Clear inputs
            </button>
          )}
      </div>

      {error && <div className="error">{error}</div>}

      {result && (
        <section className="results">
          {result.mock && (
            <div className="demo-note">
              Demo mode — canned sample output, no API call (no credits spent)
            </div>
          )}
          {result.salesPage && (
            <div className="salespage-read">
              <span className="label-inline">
                Read from your sales page —{' '}
                <a href={result.salesPage.url} target="_blank" rel="noreferrer">
                  {result.salesPage.title}
                </a>
              </span>
              <p className="sp-voice">
                <strong>Voice:</strong> {result.salesPage.voiceProfile}
              </p>
              {result.salesPage.proofOnPage.length > 0 && (
                <p className="sp-proof">
                  <strong>Proof on the page (the only specifics reused):</strong>{' '}
                  {result.salesPage.proofOnPage.join(' · ')}
                </p>
              )}
            </div>
          )}
          <h2 className="sectionhead">Why these won — the mechanism</h2>
          {result.mechanisms.map((m, i) => (
            <div className="mech" key={i}>
              <div className="src">{m.source}</div>
              <div className="body">{m.mechanism}</div>
            </div>
          ))}

          <h2 className="sectionhead">Re-firing what won — proven mechanism</h2>
          {result.hooks
            .filter((h) => h.tier === 'proven')
            .map((h, i) => hookCard(h, i))}

          {result.hooks.some((h) => h.tier === 'adjacent') && (
            <>
              <h2 className="sectionhead">
                Adjacent angles — related levers to test
              </h2>
              {result.hooks
                .filter((h) => h.tier === 'adjacent')
                .map((h, i) => hookCard(h, 1000 + i))}
            </>
          )}
        </section>
      )}
    </>
  );
}
