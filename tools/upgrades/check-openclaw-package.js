#!/usr/bin/env node
import fs from 'node:fs/promises';
import { execa } from 'execa';

const dockerfile = await fs.readFile('Dockerfile', 'utf8');
const match = dockerfile.match(/^ARG OPENCLAW_VERSION=([^\s]+)$/m);

if (!match) {
  throw new Error('Dockerfile is missing ARG OPENCLAW_VERSION=VERSION');
}

const requested = match[1];
const { stdout: published } = await execa('npm', ['view', `openclaw@${requested}`, 'version']);

console.log(`OpenClaw package: openclaw@${requested}`);
console.log(`currently published version: ${published.trim()}`);

if (requested === 'latest') {
  console.log('clean image builds resolve npm\'s latest dist-tag');
}
