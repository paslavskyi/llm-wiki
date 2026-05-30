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
  };
}
