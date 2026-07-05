import fs from 'node:fs/promises';
import { execa } from 'execa';

export async function doctor({ url } = {}) {
  const checks = [];
  checks.push(await commandCheck('node', ['--version'], 'Node.js'));
  checks.push(await commandCheck('npm', ['--version'], 'npm'));
  checks.push(await commandCheck('docker', ['--version'], 'Docker'));
  checks.push(await commandCheck('railway', ['--version'], 'Railway CLI'));
  checks.push(await pathCheck('Dockerfile'));
  checks.push(await pathCheck('railway.json'));
  checks.push(await pathCheck('package.json'));

  for (const check of checks) {
    console.log(`${check.ok ? 'ok' : 'warn'}: ${check.label}${check.detail ? ` (${check.detail})` : ''}`);
  }

  if (url) {
    const { smoke } = await import('./smoke.js');
    await smoke(url);
  } else {
    console.log('info: pass --url to verify /healthz and /readyz on a running instance');
  }

  const failed = checks.filter((check) => !check.ok && check.required);
  if (failed.length > 0) throw new Error(`doctor found missing required tools: ${failed.map((c) => c.label).join(', ')}`);
}

async function commandCheck(command, args, label) {
  try {
    const result = await execa(command, args);
    return { ok: true, label, detail: result.stdout.split('\n')[0], required: command !== 'railway' && command !== 'docker' };
  } catch {
    return { ok: false, label, detail: 'not available', required: command !== 'railway' && command !== 'docker' };
  }
}

async function pathCheck(file) {
  try {
    await fs.access(file);
    return { ok: true, label: file };
  } catch {
    return { ok: false, label: file, detail: 'missing', required: true };
  }
}
