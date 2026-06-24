// AI-writing "tells" — ported from the unslop-text skill's Python scanner
// (~/.claude/skills/unslop-text/scripts/unslop_text_scan.py). The detection
// patterns and severity come from a Reddit analysis (89,239 posts pulled,
// 7,984 on-topic, ~50 AI/writing/SaaS subreddits) of what people name as a
// giveaway that text was machine-written. Severity follows how often each tell
// is cited, so a consumer can weight effort.
//
// This is a VERSIONED data file on purpose: the tells drift year to year, so it
// stays separate from the scanner logic and can be refreshed when the upstream
// skill updates. MIT licensed (c) 2026 Carter Johnson — see SKILL.md.
//
// A note for anyone extending this: keep `raw` true ONLY for the em dash. Every
// other rule lints the author's own prose and must skip quoted/code material
// (the scanner handles that); the em dash is flagged everywhere because the
// rule is simply not to ship one.

export type Severity = 'high' | 'medium' | 'low';

export type Rule = {
  id: string;
  label: string;
  sev: Severity;
  share: string; // the data % it carries, surfaced so output can be weighted
  fix: string;
  raw?: boolean; // flagged everywhere, including inside quotes (em dash only)
  pats: RegExp[];
};

export const SEVERITY_WEIGHT: Record<Severity, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

// Emoji code-point ranges, mirroring the Python EMOJI class. JS needs the `u`
// flag and \u{...} escapes for astral ranges, so the emoji rule below compiles
// its patterns with `iu` while every other rule uses `i`.
const EMOJI =
  '\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{1F000}-\\u{1F0FF}' +
  '\\u{2190}-\\u{21FF}\\u{2B00}-\\u{2BFF}\\u{FE00}-\\u{FE0F}\\u{2764}';

const emoji = (body: string) => new RegExp(body, 'iu');

export const RULES: Rule[] = [
  // ---------- HIGH: the strongest, most-cited tells ----------
  {
    id: 'em-dash',
    label: 'Em dash (the single most-cited AI tell)',
    sev: 'high',
    share: 'cited 7.1% / matched 4.5%',
    raw: true,
    fix: 'Cut it. Use a comma, a period, or parentheses. Do not just swap in a colon; people flag that now too.',
    pats: [/—/i, /––/i, /\s–\s/i],
  },
  {
    id: 'not-just-x-y',
    label: '"It\'s not just X, it\'s Y" / "not X, but Y" antithesis cadence',
    sev: 'high',
    share: 'cited 2.8% / matched 1.9%',
    fix: "State the thing plainly. The negate-then-assert rhythm is the clearest 'AI accent'.",
    pats: [
      /\b(it'?s|its|it is|that'?s|this is|they'?re)\s+not\s+(just|only|merely|simply)\b[^.?!\n]{0,60}\bit'?s\b/i,
      /\bnot\s+(just|only|merely|simply)\s+(a |an |the )?[\w-]+,?\s+but\b/i,
      /\bisn'?t\s+(just|only|merely)\b[^.?!\n]{0,60}\bit'?s\b/i,
    ],
  },
  {
    id: 'assistant-boilerplate',
    label:
      'Leftover assistant boilerplate ("as an AI language model", a knowledge-cutoff line, a refusal)',
    sev: 'high',
    share: 'cited 1.2%, the ultimate proof when present',
    fix: 'Delete every trace of the assistant voice before publishing: disclaimers, refusals, cutoff dates.',
    pats: [
      /\bas an?\s+(ai|a\.i\.)\s+(language\s+)?model\b/i,
      /\bas a large language model\b/i,
      /\bi (cannot|can'?t|am unable to)\s+(assist|help|fulfil|fulfill|comply|provide)\b/i,
      /\bknowledge cut[- ]?off\b/i,
      /\bas of my last (knowledge )?(update|training)\b/i,
      /\bi (do not|don'?t) have (personal|the ability|access|feelings|opinions)\b/i,
    ],
  },
  {
    id: 'sycophancy-opener',
    label:
      'Sycophantic opener ("Great question!", "Certainly!", "I\'d be happy to")',
    sev: 'high',
    share: 'cited 2.5% (sycophancy is the #4 cited tell)',
    fix: 'Drop the flattery and the reflexive agreement. Open with the actual point. Disagree when warranted.',
    pats: [
      /\b(great|good|excellent|that'?s a (great|good))\s+question\b/i,
      /(^|["'`(]\s*)(certainly|absolutely|sure thing|of course)\s*[!,]/i,
      /\bi'?d be (happy|glad|delighted) to\b/i,
      /\bhappy to help\b/i,
      /\byou'?re absolutely right\b/i,
      /\bwhat a (great|fascinating|wonderful)\b/i,
    ],
  },
  {
    id: 'bolded-lead-in',
    label:
      'Bolded lead-in label (**Word:** then a sentence) / title-case mini-headings',
    sev: 'high',
    share: 'matched 2.8% (n=220), rank 3 by keyword pass',
    fix: 'Write a normal sentence without the boldface label. The **Bold:** then clause pattern is a giveaway.',
    pats: [
      /(^|\s)\*\*[^*\n]{2,40}:\*\*\s/i,
      /(^|\s)\*\*[^*\n]{2,40}\*\*\s*:/i,
      /(^|\s)__[^_\n]{2,40}:?__\s*:?\s/i,
    ],
  },
  {
    id: 'assistant-offer',
    label:
      'Trailing assistant offer ("Would you like me to ...", "Let me know if ...", "I hope this helps!")',
    sev: 'high',
    share: 'cited 0.4% each, but unmistakable when present',
    fix: 'Delete the meta-offer and the sign-off. A person finishing a thought does not ask if you want a revision.',
    pats: [
      /\bwould you like me to\b/i,
      /\blet me know if you'?d?\s*(like|need|want|have)\b/i,
      /\bi hope this helps\b/i,
      /\bhope (this|you'?re|it) .{0,20}finds? you well\b/i,
      /\bfeel free to (ask|reach|let me)\b/i,
      /\bis there anything else\b/i,
    ],
  },

  // ---------- MEDIUM: diction memes and formatting tics ----------
  {
    id: 'ai-diction',
    label:
      'AI diction memes (delve, tapestry, leverage, seamless, game-changer, ...)',
    sev: 'medium',
    share: 'cited ~1.3% as a cluster; the keyword pass inflates it (listicle copying)',
    fix: "Swap for the plain word you would actually say. 'delve into' is 'look at'; 'leverage' is 'use'.",
    pats: [
      /\b(delv(e|es|ing|ed))\b/i,
      /\btapestr(y|ies)\b/i,
      /\bgame[- ]?chang(er|ers|ing)\b/i,
      /\bseamless(ly)?\b/i,
      /\bleverag(e|es|ing|ed)\b/i,
      /\bunleash(es|ing|ed)?\b/i,
      /\bunderscore(s|d|ing)?\b/i,
      /\btestament\b/i,
      /\bembark(s|ing|ed)?\b/i,
      /\bmeticulous(ly)?\b/i,
      /\bnuanc(e|es|ed)\b/i,
      /\belevat(e|es|ing|ed)\b/i,
      /\bharness(es|ing|ed)?\b/i,
      /\bshowcas(e|es|ing|ed)\b/i,
      /\bcaptivat(e|es|ing|ed)\b/i,
      /\bever[- ]?(evolving|changing)\b/i,
    ],
  },
  {
    id: 'dive-in',
    label: '"Dive in" / "deep dive" / "let\'s dive"',
    sev: 'medium',
    share: 'cited 2.0% / matched 1.6%',
    fix: 'Cut the metaphor and just start the topic. You do not need to announce that you are starting.',
    pats: [/\b(deep dive|dives? in(to)?|let'?s dive|diving in|dive deep)\b/i],
  },
  {
    id: 'listicle-scaffold',
    label: 'Listicle scaffolding ("5 ways to ...", "7 signs ...", "3 reasons ...")',
    sev: 'medium',
    share: 'cited 1.7% (everything turned into a list)',
    fix: 'Write prose paragraphs. Reserve bullets for genuinely list-like content, not as the default shape.',
    pats: [
      /(^|\s)#{0,4}\s*\d+\s+(ways|tips|signs|reasons|things|steps|tricks|secrets|lessons|mistakes|rules)\b/i,
    ],
  },
  {
    id: 'fast-paced-opener',
    label: 'Hollow scene-setting opener ("In today\'s fast-paced world ...")',
    sev: 'medium',
    share: 'cited 0.7%, iconic',
    fix: 'Delete it and start with something specific. The opener says nothing.',
    pats: [
      /\bin today'?s\s+(fast[- ]?paced|digital|ever[- ]?changing|modern|competitive)?\s*(world|age|landscape|era|society|market)\b/i,
      /\bin (the|this) (modern|digital) (world|age|era)\b/i,
    ],
  },
  {
    id: 'unlock-potential',
    label: '"Unlock / unleash the power / potential"',
    sev: 'medium',
    share: 'cited 0.8%',
    fix: "Say what the thing actually does. The hype verb plus 'potential' is marketing filler.",
    pats: [
      /\b(unlock|unleash|harness|tap into)\w*\s+(the\s+|your\s+|its\s+|their\s+|full\s+)*(power|potential|capabilities|secrets)\b/i,
    ],
  },
  {
    id: 'emoji-decoration',
    label: 'Emoji used as bullets, icons, or in headings',
    sev: 'medium',
    share: 'cited 0.8% (emoji bullets / headers)',
    fix: 'Use plain text headers and real list markers. Decorative emoji in headings reads as templated.',
    pats: [
      emoji('^\\s{0,3}#{1,6}\\s*[' + EMOJI + ']'),
      emoji('^\\s{0,3}[' + EMOJI + ']\\s+\\S'),
      emoji('[' + EMOJI + ']\\s*\\*\\*'),
      emoji('\\*\\*\\s*[' + EMOJI + ']'),
    ],
  },
  {
    id: 'in-conclusion',
    label: '"In conclusion" / "in summary" / "to summarize" closer',
    sev: 'medium',
    share: 'cited 0.2% / matched 1.0%, a classic giveaway',
    fix: 'End on a real last point, not a signposted recap. If the reader needs a summary, the piece is too long.',
    pats: [
      /\bin (conclusion|summary)\b/i,
      /\bto (summari[sz]e|conclude|wrap (this |it )?up)\b/i,
      /\bin closing\b/i,
    ],
  },

  // ---------- LOW: real but minor; fix if cheap ----------
  {
    id: 'transition-stack',
    label: 'Stacked formal connectives (Moreover, Furthermore, Additionally, ...)',
    sev: 'low',
    share: 'matched 1.7%, but the keyword pass over-counts (often the poster\'s own prose)',
    fix: 'Let ideas connect without scaffolding. As a sentence opener these read as machine-smoothed.',
    pats: [
      /(^|\.\s+|\n)\s*(moreover|furthermore|additionally|consequently)\b/i,
      /\b(firstly|secondly|thirdly|lastly)\b/i,
    ],
  },
  {
    id: 'generic-diction',
    label:
      'Inflated generic diction (utilize, comprehensive, robust, crucial, navigate, ...)',
    sev: 'low',
    share: 'matched 1 to 2% each, but mostly the poster\'s own prose',
    fix: "Prefer the plain word: 'utilize' is 'use', 'comprehensive' is 'full', 'navigate' is 'handle'.",
    pats: [
      /\butili[sz](e|es|ing|ed|ation)\b/i,
      /\bcomprehensive\b/i,
      /\brobust\b/i,
      /\bfacilitat(e|es|ing|ed)\b/i,
      /\bstreamlin(e|es|ing|ed)\b/i,
      /\bempower(s|ing|ed|ment)?\b/i,
      /\bmyriad\b/i,
      /\bplethora\b/i,
      /\bparamount\b/i,
      /\bpivotal\b/i,
      /\bholistic\b/i,
      /\bsynerg(y|ies|istic)\b/i,
      /\bmultifaceted\b/i,
      /\bintricac(y|ies)\b/i,
    ],
  },
  {
    id: 'hype-marketing',
    label: 'Marketing hype (revolutionary, transformative, take it to the next level)',
    sev: 'low',
    share: 'cited 0.3% (broader marketing-language category)',
    fix: 'Strip the promotional adjectives and state plain facts about what it does.',
    pats: [
      /\brevolution(ary|i[sz]e)\b/i,
      /\btransform(ative|s your| ative)\b/i,
      /\btransform your (life|business|workflow)\b/i,
      /\bto the next level\b/i,
      /\bsupercharge\b/i,
      /\bsay goodbye to\b/i,
      /\blook no further\b/i,
      /\bbuckle up\b/i,
      /\bgame[- ]?changer\b/i,
      /\bwithout further ado\b/i,
    ],
  },
  {
    id: 'hedge-cliche',
    label: 'Hedging / both-sides cliche ("it depends", "on one hand ... on the other")',
    sev: 'low',
    share: 'cited 0.3% (the regex sees the phrase, not the hedging)',
    fix: 'Take a position. Listing every option instead of committing is a tell.',
    pats: [
      /\bon (the )?one hand\b[^.\n]{0,120}\bon the other\b/i,
      /\bit (really )?depends\b/i,
      /\bthere'?s no (one[- ]?size[- ]?fits[- ]?all|right answer)\b/i,
    ],
  },
  {
    id: 'note-hedge',
    label: '"It\'s worth noting" / "it\'s important to note" filler',
    sev: 'low',
    share: 'cited 0.4 to 0.6%',
    fix: 'If it is worth noting, just note it. The preamble adds nothing.',
    pats: [
      /\bit'?s worth (noting|mentioning|pointing out)\b/i,
      /\b(it'?s |it is )?important to (note|remember|understand|recognize)\b/i,
      /\bthat being said\b/i,
      /\bneedless to say\b/i,
    ],
  },
  {
    id: 'hr-divider',
    label: 'Horizontal-rule dividers (---, ***) between sections',
    sev: 'low',
    share: "novel, from a vivid citation ('another obvious AI writing marker')",
    fix: 'Use a paragraph break. The rule between every section reads as generated markdown.',
    // The Python source used \1 inside the char class, which `re` reads as the
    // octal escape \x01 (not a backreference); mirror that exactly here — a JS
    // regex literal rejects a backreference in a class, \x01 is the faithful read.
    pats: [/^\s{0,3}([-*_])\s*\1\s*\1[\s\x01]*$/i],
  },
  {
    id: 'honestly-opener',
    label: 'Fake-relatability opener ("Honestly, ...", "Look, I get it", "Imagine this")',
    sev: 'low',
    share: "novel; a top thread is devoted to 'Honestly' being 'zombified by AI'",
    fix: 'Cut the throat-clearing and start with the actual point.',
    pats: [
      /(^|\n)\s*honestly,\s/i,
      /\blook,\s+i (get it|know)\b/i,
      /(^|\n)\s*(imagine|picture) this\b/i,
      /\blet'?s be (honest|real)\b/i,
    ],
  },
];
