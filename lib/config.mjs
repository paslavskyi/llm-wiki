import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import yaml from 'js-yaml';

const DEFAULTS = { mode: 'debug', language: 'uk', owner: '' };

export async function loadConfig(rootDir) {
  try {
    const raw = await readFile(join(rootDir, 'kb.config.yml'), 'utf8');
    const parsed = yaml.load(raw) ?? {};
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}
