import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('Dockerfile installs system dependencies as root and runs the image as node', async () => {
  const dockerfile = await fs.readFile(new URL('../Dockerfile', import.meta.url), 'utf8');
  const appInstall = dockerfile.match(/USER node[\s\S]*?RUN npm ci --omit=dev/);
  const effectiveUsers = [...dockerfile.matchAll(/^USER\s+(\S+)/gm)].map((match) => match[1]);
  const extensionInstall = dockerfile.indexOf('RUN OPENCLAW_VERSION="${OPENCLAW_VERSION}"');
  const nodeBuild = dockerfile.indexOf('\nUSER node\n');

  assert.ok(appInstall, 'npm install layer should run as node');
  assert.ok(extensionInstall >= 0, 'extension installer layer should be present');
  assert.ok(extensionInstall < nodeBuild, 'system extensions should be installed before switching to node');
  assert.equal(effectiveUsers.at(-1), 'node', 'the image runtime user should be node');
  assert.match(dockerfile, /COPY --chmod=0755 deploy\/install-extensions\.sh/);
  assert.match(dockerfile, /ENV PLAYWRIGHT_BROWSERS_PATH=\/opt\/playwright-browsers/);
  assert.match(dockerfile, /chown -R node:node \/data \/home\/node \/opt\/railclaw/);
});

test('Dockerfile installs a pinned OpenClaw package on Ubuntu', async () => {
  const dockerfile = await fs.readFile(new URL('../Dockerfile', import.meta.url), 'utf8');
  const compose = await fs.readFile(new URL('../docker-compose.yml', import.meta.url), 'utf8');
  const dockerVersion = dockerfile.match(/^ARG OPENCLAW_VERSION=(.+)$/m)?.[1];
  const composeVersion = compose.match(/OPENCLAW_VERSION: \$\{OPENCLAW_VERSION:-([^}]+)\}/)?.[1];

  assert.match(dockerfile, /FROM ubuntu:\$\{UBUNTU_VERSION\}/);
  assert.match(dockerfile, /ARG OPENCLAW_VERSION=\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?/);
  assert.doesNotMatch(dockerfile, /ARG OPENCLAW_VERSION=latest/);
  assert.equal(composeVersion, dockerVersion, 'Docker and Compose OpenClaw pins should match');
  assert.match(dockerfile, /npm install -g "openclaw@\$\{OPENCLAW_VERSION\}"/);
  assert.doesNotMatch(dockerfile, /alpine\/openclaw/);
});
