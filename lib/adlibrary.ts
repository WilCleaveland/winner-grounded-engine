// Pull a competitor's currently-running ads from the Meta Ad Library via
// Firecrawl. The Library is a public, JS-heavy page; Firecrawl renders it and
// returns the ad cards as markdown, which the analysis pass distills into
// structured ads. Meta's official ads_archive API only returns political/issue
// ads, so scraping the public Library is the only route to commercial ads.

const FIRECRAWL_SCRAPE = 'https://api.firecrawl.dev/v2/scrape';

// The rendered Library page is large (nav, filters, ~30 cards). Cap what we
// feed the analysis pass; the cards we want are all in the first slice.
const MAX_MARKDOWN = 60_000;

export type ScrapedLibrary = { url: string; advertiser: string; markdown: string };

// Build the public Ad Library search URL for an advertiser, sorted by total
// impressions so the biggest spend (the winners) come first.
function libraryUrl(query: string, country: string): string {
  const params = new URLSearchParams({
    active_status: 'active',
    ad_type: 'all',
    country,
    q: query,
    search_type: 'keyword_unordered',
    media_type: 'all',
  });
  // sort_data uses bracket keys the URLSearchParams encoder handles fine.
  params.set('sort_data[mode]', 'total_impressions');
  params.set('sort_data[direction]', 'desc');
  return `https://www.facebook.com/ads/library/?${params.toString()}`;
}

export async function scrapeAdLibrary(
  query: string,
  country = 'US',
): Promise<ScrapedLibrary> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error('FIRECRAWL_API_KEY is not set');

  const url = libraryUrl(query, country);
  // onlyMainContent:false because the ad cards live outside the page's <main>;
  // waitFor lets the client-rendered cards paint before capture. maxAge serves a
  // recent cache instantly so repeat pulls on the same advertiser are fast.
  const body = JSON.stringify({
    url,
    formats: ['markdown'],
    onlyMainContent: false,
    waitFor: 6000,
    maxAge: 60 * 60 * 1000,
    timeout: 90_000,
  });

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
      throw new Error('The Ad Library took too long to load. Give it another try.');
    }
    throw new Error('Could not reach the Ad Library scraper.');
  } finally {
    clearTimeout(timer);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) {
    throw new Error(`Couldn't read the Ad Library (${data?.error || `HTTP ${res.status}`}).`);
  }

  const markdown: string = (data.data?.markdown || '').trim();
  if (!markdown) {
    throw new Error('The Ad Library loaded but returned nothing to read.');
  }
  // "~N results" with no cards means the advertiser matched nothing runnable.
  if (!/Library ID/i.test(markdown)) {
    throw new Error(
      `No running ads found for "${query}". Check the spelling, or try the brand's exact page name.`,
    );
  }
  return { url, advertiser: query, markdown: markdown.slice(0, MAX_MARKDOWN) };
}
