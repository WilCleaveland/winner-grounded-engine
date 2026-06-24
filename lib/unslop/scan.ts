// scanText() — the unslop-text scanner ported to TypeScript. Same behavior as
// the Python scanner (unslop_text_scan.py): it lints the author's running prose
// and SKIPS material that is quoted (a line starting with `>`, or text inside
// "double quotes") or shown as a literal example (inside `backticks` / fenced
// code), because flagging a cliche you are merely quoting would be a false
// positive. The one exception is the em dash, which is flagged everywhere.
//
// In this app the scanner runs on a single block of generated copy (a hook), so
// it takes a string rather than walking a filesystem. Everything else — the
// line-walker state, the severity weights, the density read, the verdict
// ladder — is the Python logic.

import { RULES, SEVERITY_WEIGHT, type Severity } from './rules.ts';

export type Finding = {
  rule: string;
  label: string;
  sev: Severity;
  share: string;
  fix: string;
  line: number;
  match: string;
  snippet: string;
};

export type ScanResult = {
  findings: Finding[];
  bySev: Record<Severity, number>;
  score: number; // weighted slop score (Python's "slop_score")
  highCount: number; // the gate signal (Python uses it as the exit code)
  words: number;
  density: number; // weighted score per 1,000 words
  verdict: string;
};

// Blank out what the author is quoting or showing as a literal example, carrying
// the open/closed state across calls so a span that wraps onto the next line is
// still skipped. Mirrors strip_noise() in the Python.
function stripNoise(
  line: string,
  inCode: boolean,
  inQuote: boolean,
): [string, boolean, boolean] {
  const out: string[] = [];
  for (const ch of line) {
    if (inCode) {
      if (ch === '`') inCode = false;
      out.push(' ');
    } else if (ch === '`') {
      inCode = true;
      out.push(' ');
    } else if (ch === '"' || ch === '“' || ch === '”') {
      inQuote = !inQuote;
      out.push(' ');
    } else {
      out.push(inQuote ? ' ' : ch);
    }
  }
  return [out.join(''), inCode, inQuote];
}

function density(weighted: number, words: number): number {
  // Concentration is the real signal: the same six "comprehensive"s mean slop
  // in a 200-word paragraph and nothing in a 5,000-word essay.
  return (weighted / Math.max(words, 1)) * 1000;
}

function verdict(
  bySev: Record<Severity, number>,
  weighted: number,
  words: number,
): string {
  const hi = bySev.high;
  const med = bySev.medium;
  if (weighted === 0) return 'Clean, no tells detected';
  const dens = density(weighted, words);
  // The LOW tier on its own never escalates past "minor"; it is mostly the
  // writer's own ordinary prose.
  if (hi === 0 && med === 0) return 'Mostly clean, minor tells';
  if (hi >= 3 || weighted >= 15 || (words >= 300 && dens >= 10)) {
    return 'STRONG AI-writing tells';
  }
  if (hi >= 1) return 'Some AI tells present';
  if (weighted >= 6 && !(words >= 600 && dens < 2.0)) {
    return 'Some AI tells present';
  }
  return 'Mostly clean, minor tells';
}

export function scanText(text: string): ScanResult {
  const lines = text.split(/\r?\n/);
  const findings: Finding[] = [];
  let words = 0;

  // Skip a leading YAML frontmatter block; it is metadata, not prose.
  let fmEnd = 0;
  if (lines.length && lines[0].trim() === '---') {
    for (let j = 1; j < lines.length; j++) {
      if (lines[j].trim() === '---') {
        fmEnd = j + 1;
        break;
      }
    }
  }

  let inFence = false;
  let inCode = false;
  let inQuote = false;

  for (let idx = 0; idx < lines.length; idx++) {
    const lineNo = idx + 1;
    if (lineNo <= fmEnd) continue;
    const raw = lines[idx];
    const stripped = raw.trim();

    if (!stripped) {
      // a blank line ends any open span
      inCode = false;
      inQuote = false;
      continue;
    }
    if (stripped.startsWith('```') || stripped.startsWith('~~~')) {
      inFence = !inFence;
      inCode = false;
      inQuote = false;
      continue;
    }
    if (inFence) continue;

    words += stripped.split(/\s+/).length; // denominator for density

    if (raw.toLowerCase().includes('unslop-ignore')) {
      // respect intentional choices, but keep the span state honest
      [, inCode, inQuote] = stripNoise(raw, inCode, inQuote);
      continue;
    }

    const isQuote = stripped.startsWith('>');
    let prose: string;
    [prose, inCode, inQuote] = stripNoise(raw, inCode, inQuote);

    for (const rule of RULES) {
      // the em dash (raw) is flagged everywhere; prose rules skip quotes
      const target = rule.raw ? raw : prose;
      if (!rule.raw && isQuote) continue;
      for (const rx of rule.pats) {
        const m = rx.exec(target);
        if (m) {
          findings.push({
            rule: rule.id,
            label: rule.label,
            sev: rule.sev,
            share: rule.share,
            fix: rule.fix,
            line: lineNo,
            match: m[0].trim().slice(0, 60),
            snippet: stripped.slice(0, 160),
          });
          break; // first matching pattern per rule is enough
        }
      }
    }
  }

  const bySev: Record<Severity, number> = { high: 0, medium: 0, low: 0 };
  for (const f of findings) bySev[f.sev] += 1;
  const score =
    SEVERITY_WEIGHT.high * bySev.high +
    SEVERITY_WEIGHT.medium * bySev.medium +
    SEVERITY_WEIGHT.low * bySev.low;

  return {
    findings,
    bySev,
    score,
    highCount: bySev.high,
    words,
    density: Math.round(density(score, words) * 10) / 10,
    verdict: verdict(bySev, score, words),
  };
}
