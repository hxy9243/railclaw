import fs from 'node:fs/promises';
import path from 'node:path';

export const DATA_DIRS = {
  config: '/data/.openclaw',
  auth: '/data/.config/openclaw',
  workspace: '/data/workspace',
};

export const HOME_LINKS = {
  openclaw: '/home/node/.openclaw',
  auth: '/home/node/.config/openclaw',
};

export async function ensureContainerLayout({ home = '/home/node', data = '/data' } = {}) {
  const openclawData = path.join(data, '.openclaw');
  const authData = path.join(data, '.config/openclaw');
  const workspaceData = path.join(data, 'workspace');
  const openclawHome = path.join(home, '.openclaw');
  const configHome = path.join(home, '.config');
  const authHome = path.join(configHome, 'openclaw');

  await fs.mkdir(openclawData, { recursive: true });
  await fs.mkdir(authData, { recursive: true });
  await fs.mkdir(workspaceData, { recursive: true });
  await fs.mkdir(configHome, { recursive: true });

  await replaceWithSymlink(openclawHome, openclawData);
  await replaceWithSymlink(authHome, authData);
}

async function replaceWithSymlink(linkPath, targetPath) {
  try {
    const stat = await fs.lstat(linkPath);
    if (stat.isSymbolicLink()) {
      const current = await fs.readlink(linkPath);
      if (current === targetPath) return;
    }
    await fs.rm(linkPath, { recursive: true, force: true });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await fs.symlink(targetPath, linkPath, 'dir');
}
