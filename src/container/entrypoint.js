#!/usr/bin/env node
import { runContainer } from './lifecycle.js';
import fs from 'node:fs/promises';
import { ensureContainerLayout } from '../lib/container-layout.js';
import { initConfig, repairConfigForContainer, repairStateForContainer } from '../lib/config.js';
import { bootstrapDistribution } from '../lib/distribution.js';

const nodeUid = 1000;
const nodeGid = 1000;
const home = process.env.HOME || '/home/node';

process.exitCode = await runContainer({
  prepare: async () => {
    if (typeof process.getuid === 'function' && process.getuid() === 0) {
      await chownTree('/data', nodeUid, nodeGid);
      await chownTree(home, nodeUid, nodeGid);
      process.setgroups?.([nodeGid]);
      process.setgid(nodeGid);
      process.setuid(nodeUid);
    }

    await ensureContainerLayout({
      home,
      data: '/data',
    });

    await bootstrapDistribution({ dataDir: '/data' });

    try {
      await fs.access('/data/.openclaw/openclaw.json');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await initConfig({ dataDir: '/data' });
    }

    await repairConfigForContainer({ dataDir: '/data' });
    await repairStateForContainer({ dataDir: '/data' });
  },
  doctor: {
    command: 'openclaw',
    args: ['doctor', '--fix'],
    options: { stdio: 'inherit', env: process.env },
  },
  gateway: {
    command: 'openclaw',
    args: [
      'gateway', '--bind', process.env.OPENCLAW_GATEWAY_BIND || 'lan',
      '--port', process.env.OPENCLAW_GATEWAY_PORT || process.env.PORT || '8080',
    ],
    options: { stdio: 'inherit', env: process.env },
  },
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
