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
  // Per-hook email drafts (+ their strengthen pass), keyed by the hook text.
  const [emails, setEmails] = useState<Record<string, EmailState>>({});

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

  const run = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setEmails({});
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

  const hookCard = (h: Hook, key: number) => (
    <div className="hookcard" key={key}>
      <p className="hookline">{h.hook}</p>
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

      {/* Sources */}
      <div className="field">
        <div className="srchead">
          <label className="label">Proven winners — paste copy that converted</label>
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
