// Canned output captured from a REAL generation (Feminine & empathetic voice,
// blackout solar-power-bank offer). Served when ENGINE_MOCK=1 so the UI can be
// exercised end to end locally without spending API credits. Production does
// not set the flag, so it always does real generations.
export const MOCK_RESULT = {
  mock: true,
  mechanisms: [
    {
      source: 'WINNER 1 — Blackout email',
      mechanism:
        "It drops the reader into a vivid, sensory present-tense moment of loss (the house going silent, the phone at 4%) so she lives the helplessness before the product appears, then twists the knife with the relatable truth that the emergency kit fails at the exact moment it's needed.",
    },
  ],
  hooks: [
    {
      hook: 'the moment the lights go out and your kids go quiet, looking at you to fix it',
      mechanism: 'Second-person present-tense danger scene',
      tier: 'proven',
      whyItPulls:
        'Casts her as the one everyone turns to — the responsibility lands before any pitch does.',
      stress: {
        weakness: 'Assumes a parent reader; a childless reader skims past it.',
        survives: true,
        verdict: 'Keep for parent audience; sharpen by hinting at the fix to come.',
      },
    },
    {
      hook: "you reach for the flashlight in the junk drawer. dead. of course it's dead.",
      mechanism: 'Second-person present-tense danger scene',
      tier: 'proven',
      whyItPulls:
        "A near-universal, faintly embarrassing memory — instant 'that's me' recognition.",
      stress: {
        weakness: 'Familiar enough that it risks reading like every other blackout email.',
        survives: true,
        verdict:
          "Keep — universally true; sharpen by tying to a bigger 'what if it's more than a flashlight' turn.",
      },
    },
    {
      hook: "it's the quiet that scares you, not the dark",
      mechanism: 'Story-tension cold open',
      tier: 'proven',
      whyItPulls:
        'Reframes the fear in a fresh register — the silence, not the dark — which earns a second look.',
      stress: {
        weakness: 'Abstract; with no concrete anchor it floats past the scanner.',
        survives: false,
        verdict:
          "Sharpen — anchor the 'quiet' to a real moment (kids stop talking, fridge dies silent) or cut.",
      },
    },
    {
      hook: "the storm knocks the power out at 9pm. your phone's at 12%. now what?",
      mechanism: 'Stakes-escalation intro (mundane → life consequence)',
      tier: 'proven',
      whyItPulls:
        "Concrete time, a dwindling battery, and an open 'now what?' that demands the body.",
      stress: {
        weakness: 'The open loop frustrates unless the body pays it off fast.',
        survives: true,
        verdict: "Keep — concrete and tense; strong open-loop with 'now what?'",
      },
    },
    {
      hook: 'can you charge your phone right now without the wall? be honest.',
      mechanism: 'The unpassable self-diagnostic hook',
      tier: 'adjacent',
      whyItPulls:
        "Hands her a test she quietly fails — the felt gap sells before the product appears.",
      stress: {
        weakness: "Someone who already owns a power bank answers 'yes' and bounces.",
        survives: true,
        verdict:
          "Keep — the 'be honest' forces a pause; sharpen for the person whose power bank is also dead.",
      },
    },
    {
      hook: "a 'toy-looking' little panel that kept a whole family's phones alive for three days",
      mechanism: 'Dismissive-label paradox',
      tier: 'adjacent',
      whyItPulls:
        "The throwaway 'toy' label collides with a serious three-day payoff — a clean curiosity gap.",
      stress: {
        weakness: "'Three days for a whole family' strains belief without proof.",
        survives: false,
        verdict:
          "Sharpen — soften the claim or add proof; 'three days' for a whole family strains credibility.",
      },
    },
    {
      hook: "nobody tells you the flashlight isn't the problem",
      mechanism: "Cognitive-trap reframe ('you think X, but…')",
      tier: 'adjacent',
      whyItPulls:
        'Names the comfortable assumption and breaks it — she reads on to find what she is missing.',
      stress: {
        weakness: "Has to pay off the 'real problem' quickly or it reads as a tease.",
        survives: true,
        verdict: 'Keep — strong contrarian open loop; pairs well with a power/communication reveal.',
      },
    },
    {
      hook: 'the one thing every blackout kit is missing (mine was too)',
      mechanism: 'Singular-mistake / one-thing fixation',
      tier: 'adjacent',
      whyItPulls:
        "Narrow scope plus the 'mine was too' confession adds warmth and lowers her guard.",
      stress: {
        weakness: "The 'one thing' list-tease is well-worn; the honesty is what rescues it.",
        survives: true,
        verdict: "Keep — the 'mine was too' adds warmth/honesty that rescues a tired format.",
      },
    },
  ],
};
