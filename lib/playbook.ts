import playbookData from '@/data/playbook.json';

export type Lever = {
  name: string;
  category: string;
  type: 'do' | 'avoid';
  pattern: string;
  genericExample: string;
};

// Distilled from a large library of real, market-tested direct-response sends,
// then abstracted to transferable levers and scrubbed of any brand/niche/verbatim
// content (see data/playbook.json). Public-safe.
export const PLAYBOOK = playbookData.levers as unknown as Lever[];

const dos = PLAYBOOK.filter((l) => l.type === 'do');
const avoids = PLAYBOOK.filter((l) => l.type === 'avoid');

// Compact reference injected into the generation system prompt.
export const PLAYBOOK_PROMPT = `PROVEN LEVER PLAYBOOK — distilled from a large library of real, market-tested direct-response sends. These are abstract levers, not templates. Draw on them when generating — especially to find genuinely different ADJACENT angles — but adapt to the offer and voice; never paste them.

LEVERS THAT WIN:
${dos.map((l) => `- ${l.name} [${l.category}]: ${l.pattern}`).join('\n')}

ANTI-PATTERNS TO AVOID:
${avoids.map((l) => `- ${l.name} [${l.category}]: ${l.pattern}`).join('\n')}`;
