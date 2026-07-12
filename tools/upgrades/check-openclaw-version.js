#!/usr/bin/env node
import fs from 'node:fs/promises';
import { execa } from 'execa';

const dockerfile = await fs.readFile('Dockerfile', 'utf8');
const match = dockerfile.match(/^ARG OPENCLAW_NPM_PACKAGE=(openclaw@([^\s]+))$/m);

if (!match) {
  throw new Error('Dockerfile is missing ARG OPENCLAW_NPM_PACKAGE=openclaw@VERSION');
}

const pinnedPackage = match[1];
const pinnedVersion = match[2];
const { stdout } = await execa('npm', ['view', 'openclaw', 'version']);
const latestVersion = stdout.trim();

console.log(`pinned OpenClaw: ${pinnedPackage}`);
console.log(`latest OpenClaw: openclaw@${latestVersion}`);

if (pinnedVersion !== latestVersion) {
  console.log(`upgrade available: openclaw@${pinnedVersion} -> openclaw@${latestVersion}`);
  process.exit(0);
}

console.log('OpenClaw pin is current');
