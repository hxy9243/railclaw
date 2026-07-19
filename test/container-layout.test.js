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
    assert.equal(await fs.readlink(path.join(home, '.codex')), path.join(data, '.codex'));
    assert.equal(await fs.readlink(path.join(home, '.config/opencode')), path.join(data, '.config/opencode'));
    assert.equal((await fs.stat(path.join(data, 'workspace'))).isDirectory(), true);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('container layout resolves circular symlink loops without throwing ELOOP', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'railclaw-layout-eloop-'));
  try {
    const home = path.join(tmp, 'home/node');
    const data = path.join(tmp, 'data');
    const dataAuth = path.join(data, '.config/openclaw');
    const homeAuth = path.join(home, '.config/openclaw');

    await fs.mkdir(path.dirname(dataAuth), { recursive: true });
    await fs.mkdir(path.dirname(homeAuth), { recursive: true });

    // Create circular symlinks between home and data auth dirs
    await fs.symlink(homeAuth, dataAuth, 'dir');
    await fs.symlink(dataAuth, homeAuth, 'dir');

    await ensureContainerLayout({ home, data });

    const dataStat = await fs.lstat(dataAuth);
    assert.equal(dataStat.isDirectory(), true);
    assert.equal(dataStat.isSymbolicLink(), false);
    assert.equal(await fs.readlink(homeAuth), dataAuth);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('container layout cleans up dangling symlinks in data directory', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'railclaw-layout-dangling-'));
  try {
    const home = path.join(tmp, 'home/node');
    const data = path.join(tmp, 'data');
    const dataAuth = path.join(data, '.config/openclaw');

    await fs.mkdir(path.dirname(dataAuth), { recursive: true });
    await fs.symlink(path.join(tmp, 'nonexistent-target'), dataAuth, 'dir');

    await ensureContainerLayout({ home, data });

    const dataStat = await fs.lstat(dataAuth);
    assert.equal(dataStat.isDirectory(), true);
    assert.equal(dataStat.isSymbolicLink(), false);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('container layout preserves existing files in home directory when converting to symlink', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'railclaw-layout-preserve-'));
  try {
    const home = path.join(tmp, 'home/node');
    const data = path.join(tmp, 'data');
    const homeAuth = path.join(home, '.config/openclaw');

    await fs.mkdir(homeAuth, { recursive: true });
    await fs.writeFile(path.join(homeAuth, 'key'), 'secret-key-data\n');

    await ensureContainerLayout({ home, data });

    assert.equal(await fs.readlink(homeAuth), path.join(data, '.config/openclaw'));
    assert.equal(await fs.readFile(path.join(data, '.config/openclaw/key'), 'utf8'), 'secret-key-data\n');
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

