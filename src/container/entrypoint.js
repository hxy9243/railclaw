#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { ensureContainerLayout } from '../lib/container-layout.js';
import { initConfig, repairConfigForContainer } from '../lib/config.js';

const nodeUid = 1000;
const nodeGid = 1000;

if (typeof process.getuid === 'function' && process.getuid() === 0) {
  await chownTree('/data', nodeUid, nodeGid);
}

await ensureContainerLayout({
  home: process.env.HOME || '/home/node',
  data: '/data',
});

try {
  await fs.access('/data/.openclaw/openclaw.json');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  await initConfig({ dataDir: '/data' });
}

await repairConfigForContainer({ dataDir: '/data' });

if (typeof process.getuid === 'function' && process.getuid() === 0) {
  await chownTree('/data', nodeUid, nodeGid);
  await chownTree(process.env.HOME || '/home/node', nodeUid, nodeGid);
}

const bind = process.env.OPENCLAW_GATEWAY_BIND || 'lan';
const port = process.env.OPENCLAW_GATEWAY_PORT || process.env.PORT || '8080';
const child = spawn('openclaw', ['gateway', '--bind', bind, '--port', port], {
  stdio: 'inherit',
  env: process.env,
  uid: nodeUid,
  gid: nodeGid,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});

async function chownTree(target, uid, gid) {
  let stat;
  try {
    stat = await fs.lstat(target);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }

  if (stat.isDirectory()) {
    await fs.chown(target, uid, gid).catch(() => {});
    const entries = await fs.readdir(target);
    await Promise.all(entries.map((entry) => chownTree(`${target}/${entry}`, uid, gid)));
    return;
  }

  if (stat.isSymbolicLink() && fs.lchown) {
    await fs.lchown(target, uid, gid).catch(() => {});
    return;
  }

  await fs.chown(target, uid, gid).catch(() => {});
}
