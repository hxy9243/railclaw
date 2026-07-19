import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { initConfig, repairConfigForContainer, repairStateForContainer } from '../src/lib/config.js';

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

test('container config repair removes host-local paths and backs up config', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'railclaw-config-'));
  try {
    const configDir = path.join(tmp, '.openclaw');
    await fs.mkdir(configDir, { recursive: true });
    const existingPlugin = path.join(tmp, 'plugin');
    await fs.mkdir(existingPlugin);
    const configPath = path.join(configDir, 'openclaw.json');
    await fs.writeFile(configPath, `${JSON.stringify({
      plugins: {
        load: {
          paths: [existingPlugin, '/missing/local/plugin/path'],
        },
        installs: {
          stale: {
            installPath: '/missing/install/path',
          },
        },
      },
      agents: {
        defaults: {
          workspace: '/home/source-user/.openclaw/workspace',
        },
      },
    })}\n`);

    const result = await repairConfigForContainer({ dataDir: tmp });
    const repaired = JSON.parse(await fs.readFile(configPath, 'utf8'));

    assert.equal(result.changed, true);
    assert.deepEqual(repaired.plugins.load.paths, [existingPlugin]);
    assert.deepEqual(repaired.plugins.installs, {});
    assert.equal(repaired.agents.defaults.workspace, path.join(tmp, 'workspace'));
    assert.equal(await fileExists(`${configPath}.railclaw-pre-container-repair`), true);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('container state repair archives legacy state files when state.sqlite exists', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'railclaw-state-'));
  try {
    const openclawDir = path.join(tmp, '.openclaw');
    const sessionsDir = path.join(openclawDir, 'agents', 'main', 'sessions');
    await fs.mkdir(sessionsDir, { recursive: true });

    // Create sqlite DB indicator
    await fs.writeFile(path.join(openclawDir, 'state.sqlite'), 'sqlite data');

    // Create legacy state files that cause migration warnings
    const updateCheck = path.join(openclawDir, 'update-check.json');
    const sidecar = path.join(sessionsDir, 'session1.jsonl.codex-app-server.json');
    await fs.writeFile(updateCheck, '{"lastCheckedAt":"2026-07-01"}');
    await fs.writeFile(sidecar, '{"sidecar":true}');

    const result = await repairStateForContainer({ dataDir: tmp });
    assert.equal(result.repairedCount, 2);

    assert.equal(await fileExists(updateCheck), false);
    assert.equal(await fileExists(`${updateCheck}.migrated`), true);

    assert.equal(await fileExists(sidecar), false);
    assert.equal(await fileExists(`${sidecar}.migrated`), true);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

async function fileExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

