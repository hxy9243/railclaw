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
  'extensions/package.json',
  'extensions/package-lock.json',
  'extensions/requirements.in',
  'extensions/requirements.txt',
  'deploy/install-extensions.sh',
  'tools/extensions/lock.sh',
  '.github/dependabot.yml',
  '.github/workflows/validate.yml',
  '.github/workflows/build.yml',
  '.github/workflows/lock-extensions.yml',
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
  await validateJson(root, 'extensions/package.json', failures);
  await validateJson(root, 'extensions/package-lock.json', failures);
  await validateExactNpmExtensions(root, failures);

  const dockerfile = await read(root, 'Dockerfile');
  const railway = await read(root, 'railway.json');
  const railwayTemplate = await read(root, '.railway/railway.ts');
  const agents = await read(root, 'AGENTS.md');
  const bootstrap = await read(root, 'skills/BOOTSTRAP.md');
  const dependabot = await read(root, '.github/dependabot.yml');
  const weeklyUpgrade = await read(root, '.github/workflows/weekly-upgrade.yml');
  const lockExtensions = await read(root, '.github/workflows/lock-extensions.yml');

  requireContains(dockerfile, 'FROM ubuntu:${UBUNTU_VERSION}', 'Dockerfile must use the configured Ubuntu base image', failures);
  requireMatch(dockerfile, /^ARG OPENCLAW_VERSION=\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/m, 'Dockerfile must pin an explicit OpenClaw package version', failures);
  requireContains(dockerfile, 'openclaw@${OPENCLAW_VERSION}', 'Dockerfile must install OpenClaw from npm', failures);
  requireContains(dockerfile, 'OPENCLAW_INSTALL_BROWSER', 'Dockerfile must expose the official browser install build arg', failures);
  requireContains(dockerfile, 'COPY extensions /tmp/openclaw-extensions', 'Dockerfile must copy extension manifests into the build', failures);
  requireContains(dockerfile, 'COPY --chown=node:node config /opt/railclaw/config', 'Dockerfile must copy bootstrap config templates into the image', failures);
  requireContains(dockerfile, 'install-openclaw-extensions', 'Dockerfile must install packages through the extension installer', failures);
  requireContains(dockerfile, 'NPM_CONFIG_PREFIX=/opt/openclaw-extensions', 'Dockerfile must configure the global npm prefix', failures);
  requireContains(dockerfile, 'PATH=/opt/openclaw-extensions/bin:$PATH', 'Dockerfile must expose global extension commands on PATH', failures);
  requireContains(dockerfile, 'PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers', 'Dockerfile must expose root-installed browsers to node', failures);
  requireContains(dockerfile, '/usr/local/bin/openclaw-railway', 'Dockerfile must expose the openclaw-railway command', failures);
  requireContains(dockerfile, 'OPENCLAW_CONFIG_DIR=/data/.openclaw', 'Dockerfile must pin config to /data', failures);
  requireContains(dockerfile, 'OPENCLAW_WORKSPACE_DIR=/data/workspace', 'Dockerfile must pin workspace to /data', failures);
  requireContains(dockerfile, 'src/container/entrypoint.js', 'Dockerfile must use the Railclaw container entrypoint', failures);
  const entrypoint = await read(root, 'src/container/entrypoint.js');
  requireContains(entrypoint, "await runCommand('openclaw', ['doctor', '--fix']", 'Container entrypoint must repair OpenClaw config before startup', failures);
  requireContains(railway, '"healthcheckPath": "/healthz"', 'Railway healthcheck must use /healthz', failures);
  requireContains(railwayTemplate, 'volume("openclaw-volume"', 'Railway IaC must define the OpenClaw volume', failures);
  requireContains(railwayTemplate, '"/data": data', 'Railway IaC must mount the volume at /data', failures);
  requireContains(railwayTemplate, 'RAILWAY_RUN_UID: "0"', 'Railway IaC must enable root-owned volume initialization', failures);
  requireContains(railwayTemplate, 'source: github(repo', 'Railway IaC must connect the service to a GitHub source', failures);
  requireContains(agents, 'skills/BOOTSTRAP.md', 'AGENTS.md must point bootstrap work to skills/BOOTSTRAP.md', failures);
  requireContains(bootstrap, 'railway config apply', 'Bootstrap skill must document Railway IaC apply', failures);
  requireContains(bootstrap, 'openclaw-volume', 'Bootstrap skill must document the Railway volume', failures);
  requireContains(bootstrap, 'Dockerfile', 'Bootstrap skill must document Dockerfile-based service builds', failures);
  requireContains(bootstrap, 'OPENCLAW_GATEWAY_PORT=8080', 'Bootstrap skill must document required Railway variables', failures);
  requireContains(bootstrap, '/home/node/.openclaw -> /data/.openclaw', 'Bootstrap skill must document runtime path links', failures);
  requireContains(bootstrap, 'Do not use `railway deploy`', 'Bootstrap skill must document the Railway deploy caveat', failures);
  requireContains(dependabot, 'interval: weekly', 'Dependabot must keep the default weekly update cadence', failures);
  requireContains(dependabot, 'directory: /extensions', 'Dependabot must update locked npm extensions', failures);
  requireContains(lockExtensions, 'npm run lock:extensions', 'Extension workflow must regenerate dependency locks', failures);
  requireContains(weeklyUpgrade, 'cron: "0 0 * * 1"', 'Weekly upgrade workflow must run on the default weekly schedule', failures);
  requireContains(weeklyUpgrade, 'check-openclaw-package.js --write', 'Weekly upgrade workflow must update the OpenClaw pin', failures);
  requireContains(weeklyUpgrade, 'peter-evans/create-pull-request@v8', 'Weekly upgrade workflow must create an OpenClaw update pull request', failures);

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

async function validateExactNpmExtensions(root, failures) {
  try {
    const manifest = JSON.parse(await fs.readFile(path.join(root, 'extensions/package.json'), 'utf8'));
    for (const [name, version] of Object.entries(manifest.dependencies || {})) {
      if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
        failures.push(`npm extension must use an exact version: ${name}@${version}`);
      }
    }
  } catch {
    // validateJson reports malformed or missing manifests.
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

function requireMatch(text, pattern, message, failures) {
  if (!pattern.test(text)) failures.push(message);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
