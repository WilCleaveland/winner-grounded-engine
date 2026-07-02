# Winner-Grounded Copy Engine

**Live demo:** https://hooks.wilsbrain.cloud
**A direct-response copy tool that works like a DR marketer, not like ChatGPT with a marketing prompt.**

You give it a proven winner. It finds the *mechanism* that made it convert, fires fresh hooks in your voice off that same mechanism, then stress-tests each one like a skeptical buyer before it survives. And it can go get the winner for you: type a competitor's name and it pulls their live Meta ads, or point it at a video sales letter and it pulls the hook off the page.

Built for the It's Today Media Marketing Development Engineer contest. It's live, the code is public, and you can run it on a winner of your own right now.

## Try it in 90 seconds

1. Open https://hooks.wilsbrain.cloud and type a competitor into **Pull a competitor's live ads** (try `Ridge Wallet`). ~30s later their currently-running Meta ads appear — hit **Use top 3 →**.
2. Type what *you* sell into the offer field (one line is enough), or paste your own sales page URL and it reads your voice and real proof off the page.
3. Hit **Generate hooks**. You get the mechanism behind each winner, then a stress-tested matrix of fresh hooks: proven re-fires plus adjacent angles worth testing.
4. On any hook that survives, hit **Expand to a full email** or **Expand to a Meta ad**, then **Copy** and paste it into your ESP or Ads Manager.

---

## What does this tool do?

A media buyer's bottleneck on cold traffic isn't volume, it's **fresh creative that converts and still sounds human**. Most "AI copy tools" are a generic model with a marketing prompt, so they regress to the AI-average voice that quietly kills response.

This one works the way a direct-response marketer actually works:

1. **Feed it 1 to 3 proven winners** (see the four ways to do that below).
2. **It extracts the mechanism** of each winner: the *structural* reason it pulled (the tension it opens, the enemy it names, the curiosity gap, the specificity that makes it credible), not the surface words.
3. **It generates a test matrix of fresh hooks** that re-fire those mechanisms for your offer, in your voice: proven re-fires plus adjacent angles worth A/B testing, each tagged with its lever and a one-line read on why it should pull.
4. **It stress-tests every hook**: a skeptical-buyer pass that names the single strongest objection a cold reader raises, decides whether the hook survives, and gives a keep / sharpen / cut verdict.
5. **It expands any survivor** into a full promo email (snapshot doctrine, one CTA) or a ready-to-run Meta Feed ad (primary text written for the "See more" fold, a real button, a creative-direction brief, and a check against the rules that get ads rejected).

Every reader-facing line runs through a silent unslop gate before you see it, a scanner ported from a study of 89,239 Reddit posts on how people spot machine writing. Hook-first, grounded in what already worked, and nothing ships without surviving a stress test.

## Feed it a winner however you've got it

The pipeline is input-agnostic: every input normalizes to source text, then runs the same mechanism engine. Four ways in, all working:

- **Paste it.** Drop in the email, ad, or landing-page copy that converted.
- **Screenshot it.** Drag or ⌘V-paste an image and Claude vision reads the whole creative, the copy *and* the visual hook.
- **Pull a competitor's live ads.** Type a brand into the **Meta Ad Library** tool and it scrapes their currently-running Feed ads, distills each into structured copy (primary text, headline, CTA, destination, run date), and lets you load any as a winner. "Currently running" is real signal: those are the ads a competitor is actually spending on. This is the dream input for a media buyer, and the official Meta API only returns political ads, so this is the only route to their commercial creative.
- **Model a VSL / sales page.** Paste a video-sales-letter or long-form sales-page URL and it pulls the spoken hook and persuasion beats off the page. DR VSL pages almost always print the script for SEO and skimmers, so the transcript is usually recoverable. When it isn't, the tool distills the hook and beats from the written sales copy instead, and tells you which it did rather than pretending it read the video.

## Why did I build THIS one?

I'm a direct-response lifecycle marketer: email/SMS, hooks, the DR strategy under the funnel. It's the exact copy that turns cold, media-bought traffic into lists and buyers, which is the motion an affiliate shop runs on. Every day the hard part isn't *more* copy, it's copy that's **on-voice and built on a proven mechanism** instead of starting from a blank prompt. That's the gap between AI slop and creative a buyer will put spend behind.

So this isn't a generic generator. The mechanism-extraction step and the adversarial stress-test step are a marketer's mental model turned into software: study the winner, lift the *why*, re-fire it, then try to break it before money does. The auto-source inputs are the other half of the job, keeping the engine grounded in what's working *now* instead of whatever you last remembered to paste.

## What would I build next if this were my full-time job?

**Close the loop: a response-learning engine.** Right now the tool is grounded in winners you hand it, or pull. The next build wires live send/campaign performance back in:

- Ingest performance by sub-id / placement (the same `sub1`-level data an affiliate shop already reports on), auto-label sends winner vs loser, and extract *why* the winners converted.
- Feed those proven mechanisms back into the engine automatically, so it stops guessing and starts compounding on **real ROI from your own traffic**. The creative gets sharper every cycle instead of staying static.
- Surface "this mechanism is pulling on cold traffic this week, here are 10 fresh hooks that re-fire it" without anyone re-pasting a thing.

For an ROI-obsessed affiliate shop, that turns every dollar of spend into a lesson the creative engine keeps. It's the natural payoff of starting from winners: first you ground creative in proven winners, then you let live performance decide what "proven" means.

## How it works

- **Next.js** (App Router) + **Claude** (`claude-opus-4-8`) with **structured outputs**, so the JSON the model returns is schema-valid every time.
- The core is two passes per run: extract mechanisms + generate the hook matrix, then an adversarial stress-test. See [`lib/anthropic.ts`](lib/anthropic.ts) for the engine and [`lib/prompts.ts`](lib/prompts.ts) for the DR philosophy it's built on.
- The auto-source inputs render a page through **Firecrawl** ([`lib/adlibrary.ts`](lib/adlibrary.ts), [`lib/scrape.ts`](lib/scrape.ts)), then a faithful extraction pass turns the messy markdown into structured winners. Those passes are pure transcription with a hard no-fabrication rule: a field that isn't on the page comes back empty, never invented.
- **Never falsify** is wired through every prompt: the engine lifts *devices* from winners (the hidden-cause villain, the quiz hook, the nicknamed mechanism), never their fabricated numbers, authorities, or claims. Real proof only comes from what's actually on your own sales page.
- The public routes are rate-limited per IP, since each call spends real Anthropic and Firecrawl credits.

## Run it locally

```bash
npm install
cp .env.example .env.local      # add your keys
npm run dev                     # http://localhost:3000
```

- `ANTHROPIC_API_KEY` powers generation, the vision reader, and every extraction pass.
- `FIRECRAWL_API_KEY` powers the URL-based inputs (Meta Ad Library pull, VSL / sales-page scrape). Paste and screenshot work without it.
