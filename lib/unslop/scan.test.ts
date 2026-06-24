// Unit tests for the ported scanner. Run with Node's built-in runner (Node 24
// strips the types natively, no toolchain needed):
//   node --test lib/unslop/scan.test.ts
//
// These pin the load-bearing behaviors the handoff flagged: the em dash is
// flagged everywhere (even inside quotes), prose rules skip quoted/code spans,
// and the score/verdict reflect the matched tells.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanText } from './scan.ts';

const ids = (text: string) => scanText(text).findings.map((f) => f.rule);

test('flags the antithesis cadence', () => {
  const res = scanText("It's not just a tool, it's a partner.");
  assert.ok(
    res.findings.some((f) => f.rule === 'not-just-x-y'),
    'expected not-just-x-y to fire',
  );
  assert.equal(res.highCount, 1);
});

test('em dash is flagged everywhere — including inside quotes', () => {
  // The quoted span would normally be stripped; the em dash is the exception.
  const res = scanText('She said "the future—finally—is here" to the room.');
  assert.ok(res.findings.some((f) => f.rule === 'em-dash'));
});

test('prose rules SKIP a quoted line (leading >)', () => {
  // "delve" inside a blockquote is being quoted, not written — must not fire.
  const quoted = '> We should delve into the seamless tapestry of options.';
  assert.equal(ids(quoted).includes('ai-diction'), false);
  // …but the same words in the author's own line DO fire.
  const own = 'We should delve into the seamless tapestry of options.';
  assert.ok(ids(own).includes('ai-diction'));
});

test('inline-code and double-quoted spans are stripped for prose rules', () => {
  assert.equal(ids('Use `leverage` as the function name.').includes('ai-diction'), false);
  assert.equal(ids('The word "delve" is overused.').includes('ai-diction'), false);
});

test('clean copy returns the clean verdict and zero score', () => {
  const res = scanText('Power goes out. This bank keeps your phone alive for three days.');
  assert.equal(res.score, 0);
  assert.equal(res.highCount, 0);
  assert.equal(res.verdict, 'Clean, no tells detected');
});

test('frontmatter is skipped, body is scanned', () => {
  const doc = ['---', 'title: not just a test', '---', 'Honestly, this is fine.'].join('\n');
  const res = scanText(doc);
  // the frontmatter "not just a test" must NOT trip not-just-x-y…
  assert.equal(res.findings.some((f) => f.rule === 'not-just-x-y'), false);
  // …but the body's "Honestly," opener should.
  assert.ok(res.findings.some((f) => f.rule === 'honestly-opener'));
});

test('severity weighting: a high + a medium scores 3 + 2', () => {
  // em dash (high) + "deep dive" (medium), each on its own line so spans reset.
  const res = scanText('The deep dive starts now.\nResults—finally—shipped.');
  assert.equal(res.bySev.high, 1);
  assert.equal(res.bySev.medium, 1);
  assert.equal(res.score, 5);
});

test('unslop-ignore opts a line out', () => {
  const res = scanText("It's not just X, it's Y. <!-- unslop-ignore -->");
  assert.equal(res.findings.length, 0);
});
