import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  bootstrapDistribution,
  completeSetup,
  distributionStatus,
} from '../src/lib/distribution.js';

test('distribution bootstrap creates state without completing setup', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'railclaw-distribution-'));
  try {
    const result = await bootstrapDistribution({ dataDir: tmp, domain: 'https://example.up.railway.app' });
    const state = JSON.parse(await fs.readFile(result.statePath, 'utf8'));

    assert.equal(result.createdConfig, true);
    assert.equal(state.initialized, true);
    assert.equal(state.setupCompleted, false);
    assert.equal(state.paths.workspaceDir, path.join(tmp, 'workspace'));
    assert.equal((await distributionStatus({ dataDir: tmp })).configExists, true);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('complete setup marks setup complete and can generate a token', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'railclaw-distribution-'));
  try {
    const result = await completeSetup({ dataDir: tmp, generateGatewayToken: true });
    const status = await distributionStatus({ dataDir: tmp });

    assert.equal(status.setupCompleted, true);
    assert.match(result.gatewayToken, /^[A-Za-z0-9+/=]+$/);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
