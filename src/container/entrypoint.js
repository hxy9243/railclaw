#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { ensureContainerLayout } from '../lib/container-layout.js';

await ensureContainerLayout({
  home: process.env.HOME || '/home/node',
  data: '/data',
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
