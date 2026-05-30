import Ajv from 'ajv';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const schemaDir = join(here, '..', 'tools', 'schema');

async function readJson(file) {
  return JSON.parse(await readFile(join(schemaDir, file), 'utf8'));
}

export async function loadValidators() {
  const ajv = new Ajv({ allErrors: true });
  const baseValidate = ajv.compile(await readJson('base.json'));
  const registry = await readJson('registry.json');
  const typed = {};
  const compiledByFile = new Map();
  for (const [type, file] of Object.entries(registry)) {
    if (!compiledByFile.has(file)) {
      compiledByFile.set(file, ajv.compile(await readJson(file)));
    }
    typed[type] = compiledByFile.get(file);
  }
  function validatorFor(type) {
    return typed[type] ?? baseValidate;
  }
  return { validatorFor, ajv };
}
