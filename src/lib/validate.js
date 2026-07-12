import fs from 'node:fs/promises';
import path from 'node:path';
import { execa } from 'execa';
import { repoRoot } from './paths.js';

const REQUIRED_FILES = [
  'Dockerfile',
  'railway.json',
  '.railway/railway.ts',
  '.env.example',
  'config/openclaw.example.json',
  'config/openclaw.bootstrap.json',
  'config/openclaw-distribution-state.bootstrap.json',
  'config/distribution.yaml',
  'package.json',
  'package-lock.json',
  'extensions/apt.txt',
  'extensions/npm.txt',
  'extensions/pip.txt',
  'extensions/requirements.txt',
  'deploy/install-extensions.sh',
  '.github/dependabot.yml',
  '.github/workflows/validate.yml',
  '.github/workflows/build.yml',
  '.github/workflows/smoke-test.yml',
  '.github/workflows/dependabot-automerge.yml',
  '.github/workflows/weekly-upgrade.yml',
  'bin/railclaw.js',
  'src/cli/index.js',
  'src/container/entrypoint.js',
  'README.md',
  'AGENTS.md',
  'skills/BOOTSTRAP.md',
  'tools/README.md',
];

export async function validateRepository({ root = repoRoot() } = {}) {
  const failures = [];
  for (const file of REQUIRED_FILES) {
    if (!await exists(path.join(root, file))) failures.push(`missing required file: ${file}`);
  }

  await validateJson(root, 'railway.json', failures);
  await validateJson(root, 'config/openclaw.example.json', failures);
  await validateJson(root, 'config/openclaw.bootstrap.json', failures);
  await validateJson(root, 'config/openclaw-distribution-state.bootstrap.json', failures);
  await validateJson(root, 'package.json', failures);

  const dockerfile = await read(root, 'Dockerfile');
  const railway = await read(root, 'railway.json');
  const railwayTemplate = await read(root, '.railway/railway.ts');
  const agents = await read(root, 'AGENTS.md');
  const bootstrap = await read(root, 'skills/BOOTSTRAP.md');
  const dependabot = await read(root, '.github/dependabot.yml');
  const weeklyUpgrade = await read(root, '.github/workflows/weekly-upgrade.yml');

  requireContains(dockerfile, 'ARG OPENCLAW_IMAGE=alpine/openclaw:latest', 'Dockerfile must inherit the public OpenClaw image by default', failures);
  requireContains(dockerfile, 'FROM ${OPENCLAW_IMAGE}', 'Dockerfile must use the configured OpenClaw base image', failures);
  requireContains(dockerfile, 'OPENCLAW_IMAGE_APT_PACKAGES', 'Dockerfile must expose the official apt package build arg', failures);
  requireContains(dockerfile, 'OPENCLAW_IMAGE_PIP_PACKAGES', 'Dockerfile must expose the official pip package build arg', failures);
  requireContains(dockerfile, 'OPENCLAW_INSTALL_BROWSER', 'Dockerfile must expose the official browser install build arg', failures);
  requireContains(dockerfile, 'COPY extensions /tmp/openclaw-extensions', 'Dockerfile must copy extension manifests into the build', failures);
  requireContains(dockerfile, 'COPY --chown=node:node config /opt/railclaw/config', 'Dockerfile must copy bootstrap config templates into the image', failures);
  requireContains(dockerfile, 'install-openclaw-extensions', 'Dockerfile must install packages through the extension installer', failures);
  requireContains(dockerfile, '/usr/local/bin/openclaw-railway', 'Dockerfile must expose the openclaw-railway command', failures);
  requireContains(dockerfile, 'OPENCLAW_CONFIG_DIR=/data/.openclaw', 'Dockerfile must pin config to /data', failures);
  requireContains(dockerfile, 'OPENCLAW_WORKSPACE_DIR=/data/workspace', 'Dockerfile must pin workspace to /data', failures);
  requireContains(dockerfile, 'src/container/entrypoint.js', 'Dockerfile must use the Railclaw container entrypoint', failures);
  requireContains(railway, '"healthcheckPath": "/healthz"', 'Railway healthcheck must use /healthz', failures);
  requireContains(railwayTemplate, 'volume("openclaw-volume"', 'Railway IaC must define the OpenClaw volume', failures);
  requireContains(railwayTemplate, '"/data": data', 'Railway IaC must mount the volume at /data', failures);
  requireContains(railwayTemplate, 'source: github(repo', 'Railway IaC must connect the service to a GitHub source', failures);
  requireContains(agents, 'skills/BOOTSTRAP.md', 'AGENTS.md must point bootstrap work to skills/BOOTSTRAP.md', failures);
  requireContains(bootstrap, 'railway config apply', 'Bootstrap skill must document Railway IaC apply', failures);
  requireContains(bootstrap, 'openclaw-volume', 'Bootstrap skill must document the Railway volume', failures);
  requireContains(bootstrap, 'Dockerfile', 'Bootstrap skill must document Dockerfile-based service builds', failures);
  requireContains(bootstrap, 'OPENCLAW_GATEWAY_PORT=8080', 'Bootstrap skill must document required Railway variables', failures);
  requireContains(bootstrap, '/home/node/.openclaw -> /data/.openclaw', 'Bootstrap skill must document runtime path links', failures);
  requireContains(bootstrap, 'Do not use `railway deploy`', 'Bootstrap skill must document the Railway deploy caveat', failures);
  requireContains(dependabot, 'interval: weekly', 'Dependabot must keep the default weekly update cadence', failures);
  requireContains(weeklyUpgrade, 'cron: "0 0 * * 1"', 'Weekly upgrade workflow must run on the default weekly schedule', failures);

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
