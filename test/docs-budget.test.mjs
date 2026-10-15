// CLAUDE.md is loaded into every session, so it stays small (BMAD project-
// context rule: keep a line only if removing it changes agent behaviour; detail
// goes to on-demand docs like kb-capture/formats.md). The docs' tables must not
// drift from the data they describe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { VOCABULARY } from '../lib/vocabulary.mjs';
import { RELATIONS } from '../lib/relations.mjs';

const read = (p) => readFile(new URL(`../${p}`, import.meta.url), 'utf8');
const MAX_LINES = 100;
const MAX_BYTES = 6000;

test(`CLAUDE.md stays within budget (${MAX_LINES} lines / ${MAX_BYTES} bytes)`, async () => {
  const text = await read('CLAUDE.md');
  const lines = text.trimEnd().split('\n').length;
  const bytes = Buffer.byteLength(text);
  assert.ok(lines <= MAX_LINES && bytes <= MAX_BYTES,
    `CLAUDE.md is ${lines} lines / ${bytes} bytes — move detail to an on-demand doc instead of raising the budget`);
});

test('CLAUDE.md vocabulary table lists every type and prefix in lib/vocabulary.mjs', async () => {
  const text = await read('CLAUDE.md');
  for (const [type, { prefixes }] of Object.entries(VOCABULARY)) {
    assert.match(text, new RegExp(`\\b${type}\\b`), `type ${type} missing from CLAUDE.md`);
    for (const p of prefixes) assert.ok(text.includes(`${p}-`), `prefix ${p}- missing from CLAUDE.md`);
  }
});

test('formats.md relation table matches lib/relations.mjs', async () => {
  const text = await read('.claude/skills/kb-capture/formats.md');
  for (const [name, { inverse }] of Object.entries(RELATIONS)) {
    assert.match(text, new RegExp(`^\\| ${name} \\|.*\\| ${inverse} \\|$`, 'm'), `relation ${name} row missing/stale`);
  }
});
