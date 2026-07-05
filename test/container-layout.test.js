import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ensureContainerLayout } from '../src/lib/container-layout.js';

test('container layout creates persisted data dirs and home symlinks', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'railclaw-layout-'));
  try {
    const home = path.join(tmp, 'home/node');
    const data = path.join(tmp, 'data');
    await fs.mkdir(home, { recursive: true });
    await ensureContainerLayout({ home, data });

    assert.equal(await fs.readlink(path.join(home, '.openclaw')), path.join(data, '.openclaw'));
    assert.equal(await fs.readlink(path.join(home, '.config/openclaw')), path.join(data, '.config/openclaw'));
    assert.equal((await fs.stat(path.join(data, 'workspace'))).isDirectory(), true);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
