import fs from 'node:fs/promises';
import path from 'node:path';
import { execa } from 'execa';
import { repoRoot } from './paths.js';

const REQUIRED_FILES = [
  'Dockerfile',
  'Dockerfile.official-image',
  'railway.json',
  '.env.example',
  'config/openclaw.example.json',
  'package.json',
  'package-lock.json',
  'bin/railclaw.js',
  'src/cli/index.js',
  'src/container/entrypoint.js',
  'README.md',
  'INSTRUCTION.md',
];

export async function validateRepository({ root = repoRoot() } = {}) {
  const failures = [];
  for (const file of REQUIRED_FILES) {
    if (!await exists(path.join(root, file))) failures.push(`missing required file: ${file}`);
  }

  await validateJson(root, 'railway.json', failures);
  await validateJson(root, 'config/openclaw.example.json', failures);
  await validateJson(root, 'package.json', failures);

  const dockerfile = await read(root, 'Dockerfile');
  const officialDockerfile = await read(root, 'Dockerfile.official-image');
  const railway = await read(root, 'railway.json');
  const makefile = await read(root, 'Makefile');

  requireContains(dockerfile, 'FROM node:24-bookworm-slim', 'Dockerfile must use the npm-install Node base', failures);
  requireContains(dockerfile, 'OPENCLAW_NPM_PACKAGE=openclaw@', 'Dockerfile must pin an OpenClaw npm package by default', failures);
  requireContains(officialDockerfile, 'FROM ${OPENCLAW_IMAGE}', 'official-image variant must inherit the configured official OpenClaw image', failures);
  requireContains(dockerfile, 'OPENCLAW_CONFIG_DIR=/data/.openclaw', 'Dockerfile must pin config to /data', failures);
  requireContains(dockerfile, 'OPENCLAW_WORKSPACE_DIR=/data/workspace', 'Dockerfile must pin workspace to /data', failures);
  requireContains(dockerfile, 'src/container/entrypoint.js', 'Dockerfile must use the Railclaw container entrypoint', failures);
  requireContains(railway, '"healthcheckPath": "/healthz"', 'Railway healthcheck must use /healthz', failures);
  requireContains(makefile, 'node bin/railclaw.js deploy', 'Makefile deploy target must use the Railclaw deploy helper', failures);
  if (makefile.includes(`railclaw ${'railway'}`)) {
    failures.push('Makefile must not expose Railway wrapper commands through railclaw');
  }

  const tracked = await gitFiles(root);
  const trackedArtifact = tracked.find((file) => /(^|\/)(\.env|data|state|workspace|migration-out|.*\.tar(\.gz)?(\.enc)?)$/.test(file));
  if (trackedArtifact) failures.push(`secret/state artifact is tracked by git: ${trackedArtifact}`);

  const home = process.env.HOME ? escapeRegExp(process.env.HOME) : null;
  const secretPattern = /(OPENCLAW_GATEWAY_TOKEN=[A-Za-z0-9+/=]{20,}|sk-[A-Za-z0-9_-]{20,})/;
  for (const file of tracked) {
    const fullPath = path.join(root, file);
    let text;
    try {
      text = await fs.readFile(fullPath, 'utf8');
    } catch {
      continue;
    }
    if (home && new RegExp(home).test(text)) failures.push(`tracked file contains a personal home path: ${file}`);
    if (secretPattern.test(text)) failures.push(`tracked file contains a secret-looking value: ${file}`);
  }

  if (failures.length > 0) {
    throw new Error(failures.join('\n'));
  }
  console.log('validate: ok');
}

async function validateJson(root, file, failures) {
  try {
    JSON.parse(await fs.readFile(path.join(root, file), 'utf8'));
  } catch (error) {
    failures.push(`${file} is not valid JSON: ${error.message}`);
  }
}

async function gitFiles(root) {
  const result = await execa('git', ['ls-files'], { cwd: root });
  return result.stdout.split('\n').filter(Boolean);
}

async function read(root, file) {
  return fs.readFile(path.join(root, file), 'utf8');
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function requireContains(text, needle, message, failures) {
  if (!text.includes(needle)) failures.push(message);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
