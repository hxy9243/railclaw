import fs from 'node:fs/promises';
import path from 'node:path';

export const DATA_DIRS = {
  config: '/data/.openclaw',
  auth: '/data/.config/openclaw',
  codex: '/data/.codex',
  opencode: '/data/.config/opencode',
  workspace: '/data/workspace',
};

export const HOME_LINKS = {
  openclaw: '/home/node/.openclaw',
  auth: '/home/node/.config/openclaw',
  codex: '/home/node/.codex',
  opencode: '/home/node/.config/opencode',
};

export async function ensureContainerLayout({ home = '/home/node', data = '/data' } = {}) {
  const openclawData = path.join(data, '.openclaw');
  const authData = path.join(data, '.config/openclaw');
  const codexData = path.join(data, '.codex');
  const opencodeData = path.join(data, '.config/opencode');
  const workspaceData = path.join(data, 'workspace');
  const openclawHome = path.join(home, '.openclaw');
  const codexHome = path.join(home, '.codex');
  const configHome = path.join(home, '.config');
  const authHome = path.join(configHome, 'openclaw');
  const opencodeHome = path.join(configHome, 'opencode');

  await ensureRealDir(openclawData);
  await ensureRealDir(authData);
  await ensureRealDir(codexData);
  await ensureRealDir(opencodeData);
  await ensureRealDir(workspaceData);
  await ensureRealDir(configHome);

  await replaceWithSymlink(openclawHome, openclawData);
  await replaceWithSymlink(authHome, authData);
  await replaceWithSymlink(codexHome, codexData);
  await replaceWithSymlink(opencodeHome, opencodeData);
}

export async function ensureRealDir(dirPath) {
  const resolved = path.resolve(dirPath);
  const parts = resolved.split(path.sep).filter(Boolean);
  let current = path.parse(resolved).root;

  for (const part of parts) {
    current = path.join(current, part);
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink() || !stat.isDirectory()) {
        await fs.rm(current, { recursive: true, force: true });
        await fs.mkdir(current, { recursive: true });
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.mkdir(current, { recursive: true });
      } else {
        throw error;
      }
    }
  }
}

export async function replaceWithSymlink(linkPath, targetPath) {
  await ensureRealDir(targetPath);

  try {
    const stat = await fs.lstat(linkPath);
    if (stat.isSymbolicLink()) {
      const current = await fs.readlink(linkPath);
      if (current === targetPath) {
        const targetStat = await fs.lstat(targetPath).catch(() => null);
        if (targetStat && targetStat.isDirectory() && !targetStat.isSymbolicLink()) {
          return;
        }
      }
      await fs.rm(linkPath, { recursive: true, force: true });
    } else if (stat.isDirectory()) {
      await copyDirectoryContents(linkPath, targetPath);
      await fs.rm(linkPath, { recursive: true, force: true });
    } else {
      await fs.rm(linkPath, { recursive: true, force: true });
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  await ensureRealDir(path.dirname(linkPath));
  await fs.symlink(targetPath, linkPath, 'dir');
}

async function copyDirectoryContents(source, target) {
  await fs.mkdir(target, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(source, entry.name);
    const destPath = path.join(target, entry.name);
    try {
      await fs.lstat(destPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.cp(srcPath, destPath, { recursive: true });
      }
    }
  }
}

