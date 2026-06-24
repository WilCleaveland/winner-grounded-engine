# Winner-Grounded Copy Engine

**Live demo:** https://hooks.wilsbrain.cloud
**A direct-response copy tool that works like a DR marketer — not like ChatGPT with a marketing prompt.**

You paste a proven winner. It finds the *mechanism* that made it convert, fires fresh hooks in your voice off that same mechanism, then stress-tests each one like a skeptical buyer before it survives.

---

## What does this tool do?

A media buyer's bottleneck on cold traffic isn't volume — it's **fresh creative that converts and still sounds human**. Most "AI copy tools" are a generic model with a marketing prompt; they regress to the AI-average voice that quietly kills response.

This tool works the way a direct-response marketer actually works:

1. **Give it 1–3 proven winners** — paste the copy, *or drop / ⌘V-paste a screenshot* and Claude vision reads the whole creative (copy **and** the visual hook) — plus the offer and the voice.
2. **It extracts the mechanism** of each winner — the *structural* reason it pulled (the tension it opens, the enemy it names, the curiosity gap, the specificity that makes it credible), not the surface words.
3. **It generates fresh hooks** that re-fire those mechanisms for your offer, in your voice, each tagged with its angle and a one-line read on why it should pull.
4. **It stress-tests every hook** — a skeptical-buyer pass that names the single strongest objection a cold reader raises, decides whether the hook survives it, and gives a keep / sharpen / cut verdict.

Hook-first, grounded in what already worked, and nothing ships without surviving a stress test.

## Why did I build THIS one?

I'm a direct-response lifecycle marketer — email/SMS, hooks, the DR strategy under the funnel. Every day the hard part isn't *more* copy, it's copy that's **on-voice and built on a proven mechanism** instead of starting from a blank prompt. That's the exact gap between "AI slop" and creative a buyer will actually put spend behind.

So this isn't a generic generator. The mechanism-extraction step and the adversarial stress-test step are a marketer's mental model turned into software: study the winner, lift the *why*, re-fire it, then try to break it before money does. It's the piece of my own workflow I most wanted to make repeatable.

## What would I build next if this were my full-time job?

**Close the loop — a response-learning engine.** Right now the tool is grounded in winners *you* hand it. The next build wires live send/campaign performance back in:

- Ingest performance by sub-id / placement (the same `sub1`-level data an affiliate shop already reports on), auto-label sends winner vs loser, and extract *why* the winners converted.
- Feed those proven mechanisms back into the engine automatically, so it stops guessing and starts compounding on **real ROI from your own traffic** — the creative gets sharper every cycle instead of staying static.
- Surface "this mechanism is pulling on cold traffic this week; here are 10 fresh hooks that re-fire it" without anyone re-pasting a thing.

For an ROI-obsessed affiliate shop, that turns every dollar of spend into a lesson the creative engine keeps. It's the natural payoff of starting from winners: first you ground creative in proven winners, then you let live performance decide what "proven" means.

(See also the **input roadmap** below — the same engine, fed winners however you've got them.)

---

## Roadmap — feed it a winner *however you've got it*

V1 takes **pasted copy and screenshot upload** (vision reads the copy + the visual). The same pipeline is input-agnostic; each remaining input just normalizes to source text:

- **Paste a URL** → scrape a competitor landing page / "view in browser" email, or pull a **VSL / YouTube transcript** and model the hook from the video sales letter.
- **Meta Ad Library by advertiser** → type a competitor's name, pull their live ads as source winners (the dream input for a media buyer).

## How it works

- **Next.js** (App Router) + **Claude** (`claude-opus-4-8`) with **structured outputs**, so the JSON the model returns is schema-valid every time.
- Two passes per run: (1) extract mechanisms + generate hooks, (2) adversarial stress-test. See [`lib/anthropic.ts`](lib/anthropic.ts) for the engine and [`lib/prompts.ts`](lib/prompts.ts) for the DR philosophy it's built on.
- **Clean-room:** ships with synthetic sample winners in [`data/sampleWinners.ts`](data/sampleWinners.ts) so it's clickable cold, with zero real client data.

## Run it locally

```bash
npm install
cp .env.example .env.local      # add your ANTHROPIC_API_KEY
npm run dev                     # http://localhost:3000
```

Only secret required for V1 is `ANTHROPIC_API_KEY`.
