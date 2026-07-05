import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { initConfig } from '../src/lib/config.js';

test('config init writes a /data-oriented OpenClaw config', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'railclaw-config-'));
  try {
    const file = await initConfig({ dataDir: tmp, domain: 'https://example.up.railway.app' });
    const config = JSON.parse(await fs.readFile(file, 'utf8'));
    assert.equal(config.gateway.bind, 'lan');
    assert.equal(config.agents.defaults.workspace, path.join(tmp, 'workspace'));
    assert.deepEqual(config.gateway.controlUi.allowedOrigins, ['https://example.up.railway.app']);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('config init refuses to overwrite by default', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'railclaw-config-'));
  try {
    await initConfig({ dataDir: tmp });
    await assert.rejects(() => initConfig({ dataDir: tmp }), /already exists/);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
