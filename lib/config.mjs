import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import yaml from 'js-yaml';

const DEFAULTS = {
  mode: 'debug',
  language: 'uk',
  owner: '',
  health: {
    duplicates: { enabled: false, threshold: 0.92 },
  },
  persistence: {
    autocommit: 'manual',     // off | manual | auto
    threshold: 10,
    max_age_hours: 24,
    remind_every_hours: 4,
    hard_safety_net: false,
    hard_threshold: 50,
  },
};

export async function loadConfig(rootDir) {
  let parsed = {};
  try {
    const raw = await readFile(join(rootDir, 'kb.config.yml'), 'utf8');
    parsed = yaml.load(raw) ?? {};
  } catch {
    parsed = {};
  }
  return {
    ...DEFAULTS,
    ...parsed,
    health: {
      ...DEFAULTS.health,
      ...(parsed.health ?? {}),
      duplicates: {
        ...DEFAULTS.health.duplicates,
        ...((parsed.health ?? {}).duplicates ?? {}),
      },
    },
    persistence: {
      ...DEFAULTS.persistence,
      ...(parsed.persistence ?? {}),
    },
  };
}
