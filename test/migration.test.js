import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { packageMigration, restoreMigration, verifyRestoredData } from '../src/lib/migration.js';

test('migration packages and restores config, provider auth, auth secrets, and workspace', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'railclaw-test-'));
  const oldPassphrase = process.env.MIGRATION_PASSPHRASE;
  process.env.MIGRATION_PASSPHRASE = 'test-passphrase-only';
  try {
    const source = path.join(tmp, 'source');
    const config = path.join(source, '.openclaw');
    const auth = path.join(source, '.config/openclaw');
    const workspace = path.join(source, 'workspace');
    const output = path.join(tmp, 'output');
    const data = path.join(tmp, 'data');

    await fs.mkdir(path.join(config, 'agents/default/agent'), { recursive: true });
    await fs.mkdir(auth, { recursive: true });
    await fs.mkdir(path.join(workspace, 'project'), { recursive: true });

    await fs.writeFile(path.join(config, 'openclaw.json'), '{"gateway":{"mode":"local"}}\n');
    await fs.writeFile(path.join(config, 'agents/default/agent/auth-profiles.json'), '{"profiles":[{"provider":"openai-codex"}]}\n');
    await fs.writeFile(path.join(auth, 'key'), 'fake-auth-profile-secret\n');
    await fs.writeFile(path.join(workspace, 'project/README.md'), 'workspace file\n');

    const archive = await packageMigration({
      configDir: config,
      secretDir: auth,
      workspaceDir: workspace,
      output,
    });
    assert.match(archive, /\.tar\.gz\.enc$/);

    await restoreMigration(archive, { dataDir: data, yes: true });
    await verifyRestoredData(data);

    assert.equal(await fs.readFile(path.join(data, '.openclaw/openclaw.json'), 'utf8'), '{"gateway":{"mode":"local"}}\n');
    assert.equal(
      await fs.readFile(path.join(data, '.openclaw/agents/default/agent/auth-profiles.json'), 'utf8'),
      '{"profiles":[{"provider":"openai-codex"}]}\n',
    );
    assert.equal(await fs.readFile(path.join(data, '.config/openclaw/key'), 'utf8'), 'fake-auth-profile-secret\n');
    assert.equal(await fs.readFile(path.join(data, 'workspace/project/README.md'), 'utf8'), 'workspace file\n');
  } finally {
    if (oldPassphrase === undefined) {
      delete process.env.MIGRATION_PASSPHRASE;
    } else {
      process.env.MIGRATION_PASSPHRASE = oldPassphrase;
    }
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
