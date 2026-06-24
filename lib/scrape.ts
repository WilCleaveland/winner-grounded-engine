// Pull the markdown of a single sales page via Firecrawl. Single page, not a
// crawl — we want the one page the user is selling from, as clean text the
// analysis pass can read for voice + product facts.

const FIRECRAWL_SCRAPE = 'https://api.firecrawl.dev/v2/scrape';

// Sales letters get long; cap what we feed the analysis pass so token cost and
// latency stay bounded. The analysis distills it anyway.
const MAX_MARKDOWN = 24_000;

export type ScrapedPage = { url: string; title: string; markdown: string };

export async function scrapeSalesPage(url: string): Promise<ScrapedPage> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error('FIRECRAWL_API_KEY is not set');

  // DR / VSL sales pages are heavy (long, video-laden, JS) — a fresh render can
  // take 80s+. blockAds trims junk; maxAge serves a recent cache instantly so
  // repeat runs on the same URL are fast; Firecrawl's `timeout` bounds the
  // render and the abort below is a backstop a few seconds later.
  const body = JSON.stringify({
    url,
    formats: ['markdown'],
    onlyMainContent: true,
    blockAds: true,
    maxAge: 4 * 60 * 60 * 1000,
    timeout: 90_000,
  });

  const retryHint =
    ' Try again — it should be faster now — or remove the URL to generate without page-voice.';
  let lastErr = new Error("Couldn't read that sales page.");

  for (let attempt = 0; attempt < 2; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 95_000);
    let res: Response;
    try {
      res = await fetch(FIRECRAWL_SCRAPE, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body,
        signal: ac.signal,
      });
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        // A render this slow won't speed up on an immediate retry, and the double
        // wait risks the request budget. Firecrawl usually finishes and caches it
        // server-side, so the user's next try lands on the cache (maxAge).
        throw new Error('The sales page took too long to read.' + retryHint);
      }
      lastErr = new Error('Could not reach the scraper.'); // network blip — retry
      continue;
    } finally {
      clearTimeout(timer);
    }

    const data = await res.json().catch(() => null);

    // Transient Firecrawl-side failure (5xx) — retry once before giving up.
    if (res.status >= 500) {
      lastErr = new Error(`Couldn't read that sales page (${data?.error || `HTTP ${res.status}`}).`);
      continue;
    }
    if (!res.ok || !data?.success) {
      throw new Error(`Couldn't read that sales page (${data?.error || `HTTP ${res.status}`}).` + retryHint);
    }

    const markdown: string = (data.data?.markdown || '').trim();
    if (!markdown) {
      throw new Error('That URL loaded but had no readable copy to draw from.');
    }
    const title: string = data.data?.metadata?.title || url;
    return { url, title, markdown: markdown.slice(0, MAX_MARKDOWN) };
  }

  throw new Error(lastErr.message + retryHint);
}
