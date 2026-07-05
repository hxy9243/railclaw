import os from 'node:os';
import path from 'node:path';

export function expandHome(value) {
  if (!value) return value;
  if (value === '~') return os.homedir();
  if (value.startsWith('~/')) return path.join(os.homedir(), value.slice(2));
  return value;
}

export function repoRoot() {
  return path.resolve(new URL('../..', import.meta.url).pathname);
}
