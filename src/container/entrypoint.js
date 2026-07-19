#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { ensureContainerLayout } from '../lib/container-layout.js';
import { initConfig, repairConfigForContainer, repairStateForContainer } from '../lib/config.js';
import { bootstrapDistribution } from '../lib/distribution.js';

const nodeUid = 1000;
const nodeGid = 1000;
const home = process.env.HOME || '/home/node';

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

await runCommand('openclaw', ['doctor', '--fix'], {
  stdio: 'inherit',
  env: process.env,
});

const bind = process.env.OPENCLAW_GATEWAY_BIND || 'lan';
const port = process.env.OPENCLAW_GATEWAY_PORT || process.env.PORT || '8080';
const child = spawn('openclaw', ['gateway', '--bind', bind, '--port', port], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});

function runCommand(command, args, options) {
  return new Promise((resolve, reject) => {
    const commandChild = spawn(command, args, options);
    commandChild.once('error', reject);
    commandChild.once('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`${command} ${args.join(' ')} exited from signal ${signal}`));
      } else if (code !== 0) {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
      } else {
        resolve();
      }
    });
  });
}

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
