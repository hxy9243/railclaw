#!/usr/bin/env node
import fs from 'node:fs/promises';
import { execa } from 'execa';

const dockerfile = await fs.readFile('Dockerfile', 'utf8');
const match = dockerfile.match(/^ARG OPENCLAW_IMAGE=([^\s]+)$/m);

if (!match) {
  throw new Error('Dockerfile is missing ARG OPENCLAW_IMAGE=IMAGE');
}

const image = match[1];
console.log(`OpenClaw base image: ${image}`);

try {
  const { stdout } = await execa('docker', ['buildx', 'imagetools', 'inspect', image]);
  const digest = stdout.match(/Digest:\s+(sha256:[a-f0-9]+)/i)?.[1];
  if (digest) console.log(`current registry digest: ${digest}`);
} catch (error) {
  console.log(`warning: could not inspect ${image}: ${error.shortMessage || error.message}`);
}

if (image.endsWith(':latest')) {
  console.log('using latest tag; CI builds with --pull so scheduled builds pick up the current official image');
}
