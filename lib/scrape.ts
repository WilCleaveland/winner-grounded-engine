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

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 45_000);
  let res: Response;
  try {
    res = await fetch(FIRECRAWL_SCRAPE, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
      }),
      signal: ac.signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('The sales page took too long to load.');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) {
    const detail = data?.error || `HTTP ${res.status}`;
    throw new Error(`Couldn't read that sales page (${detail}).`);
  }

  const markdown: string = (data.data?.markdown || '').trim();
  if (!markdown) {
    throw new Error("That URL loaded but had no readable copy to draw from.");
  }
  const title: string = data.data?.metadata?.title || url;
  return { url, title, markdown: markdown.slice(0, MAX_MARKDOWN) };
}
