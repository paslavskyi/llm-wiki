import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { loadConfig } from '../lib/config.mjs';
import { makeTmpDir, writeFileDeep, cleanup } from './helpers.mjs';

test('loadConfig reads mode/language/owner', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'kb.config.yml'),
      'mode: autonomous\nlanguage: en\nowner: Sam\n');
    const cfg = await loadConfig(dir);
    assert.equal(cfg.mode, 'autonomous');
    assert.equal(cfg.language, 'en');
    assert.equal(cfg.owner, 'Sam');
  } finally {
    await cleanup(dir);
  }
});

test('loadConfig falls back to defaults when file missing', async () => {
  const dir = await makeTmpDir();
  try {
    const cfg = await loadConfig(dir);
    assert.equal(cfg.mode, 'debug');
    assert.equal(cfg.language, 'uk');
  } finally {
    await cleanup(dir);
  }
});

test('loadConfig provides health.duplicates defaults when absent', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'kb.config.yml'), 'mode: debug\n');
    const cfg = await loadConfig(dir);
    assert.equal(cfg.health.duplicates.enabled, false);
    assert.equal(cfg.health.duplicates.threshold, 0.92);
  } finally { await cleanup(dir); }
});

test('loadConfig merges a partial health.duplicates section', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'kb.config.yml'),
      'health:\n  duplicates:\n    enabled: true\n');
    const cfg = await loadConfig(dir);
    assert.equal(cfg.health.duplicates.enabled, true);   // from file
    assert.equal(cfg.health.duplicates.threshold, 0.92); // from default
  } finally { await cleanup(dir); }
});

test('loadConfig health defaults present even with no file', async () => {
  const dir = await makeTmpDir();
  try {
    const cfg = await loadConfig(dir);
    assert.equal(cfg.health.duplicates.enabled, false);
    assert.equal(cfg.health.duplicates.threshold, 0.92);
    assert.equal(cfg.mode, 'debug'); // existing defaults intact
  } finally { await cleanup(dir); }
});

test('loadConfig provides persistence defaults when absent', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'kb.config.yml'), 'mode: debug\n');
    const cfg = await loadConfig(dir);
    assert.equal(cfg.persistence.autocommit, 'manual');
    assert.equal(cfg.persistence.threshold, 10);
    assert.equal(cfg.persistence.max_age_hours, 24);
    assert.equal(cfg.persistence.remind_every_hours, 4);
    assert.equal(cfg.persistence.hard_safety_net, false);
    assert.equal(cfg.persistence.hard_threshold, 50);
  } finally { await cleanup(dir); }
});

test('loadConfig merges a partial persistence section', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'kb.config.yml'),
      'persistence:\n  autocommit: auto\n  threshold: 5\n');
    const cfg = await loadConfig(dir);
    assert.equal(cfg.persistence.autocommit, 'auto');   // from file
    assert.equal(cfg.persistence.threshold, 5);         // from file
    assert.equal(cfg.persistence.max_age_hours, 24);    // default
    assert.equal(cfg.health.duplicates.threshold, 0.92); // unrelated default intact
  } finally { await cleanup(dir); }
});
