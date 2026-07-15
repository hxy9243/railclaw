#!/usr/bin/env node
import fs from 'node:fs/promises';
import { execa } from 'execa';

const dockerfilePath = 'Dockerfile';
const composePath = 'docker-compose.yml';
const write = process.argv.includes('--write');
const dockerfile = await fs.readFile(dockerfilePath, 'utf8');
const match = dockerfile.match(/^ARG OPENCLAW_VERSION=([^\s]+)$/m);

if (!match) {
  throw new Error('Dockerfile is missing ARG OPENCLAW_VERSION=VERSION');
}

const requested = match[1];
const { stdout } = await execa('npm', ['view', 'openclaw@latest', 'version']);
const published = stdout.trim();

if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(published)) {
  throw new Error(`npm returned an invalid OpenClaw version: ${published}`);
}

console.log(`OpenClaw package: openclaw@${requested}`);
console.log(`latest published version: ${published}`);

if (requested === published) {
  console.log('OpenClaw pin is current');
} else if (!write) {
  console.log(`OpenClaw update available: ${requested} -> ${published}`);
} else {
  const compose = await fs.readFile(composePath, 'utf8');
  const composeVersion = compose.match(/OPENCLAW_VERSION: \$\{OPENCLAW_VERSION:-([^}]+)\}/)?.[1];
  if (!composeVersion) {
    throw new Error('docker-compose.yml is missing the default OPENCLAW_VERSION build arg');
  }

  await fs.writeFile(
    dockerfilePath,
    dockerfile.replace(
      /^ARG OPENCLAW_VERSION=[^\s]+$/m,
      `ARG OPENCLAW_VERSION=${published}`,
    ),
  );
  await fs.writeFile(
    composePath,
    compose.replace(
      /OPENCLAW_VERSION: \$\{OPENCLAW_VERSION:-[^}]+\}/,
      `OPENCLAW_VERSION: \${OPENCLAW_VERSION:-${published}}`,
    ),
  );
  console.log(`updated OpenClaw pins to ${published}`);
}
