import fs from 'node:fs/promises';
import path from 'node:path';
import { ensureRealDir } from './container-layout.js';

export async function initConfig({ dataDir = '/data', domain, force = false } = {}) {
  const configDir = path.join(dataDir, '.openclaw');
  const workspaceDir = path.join(dataDir, 'workspace');
  const configPath = path.join(configDir, 'openclaw.json');
  await ensureRealDir(configDir);
  await ensureRealDir(workspaceDir);

  if (!force && await exists(configPath)) {
    throw new Error(`${configPath} already exists; pass --force to replace it`);
  }

  const allowedOrigins = domain ? [domain] : ['https://YOUR-RAILWAY-DOMAIN.up.railway.app'];
  const config = {
    gateway: {
      mode: 'local',
      bind: 'lan',
      controlUi: { allowedOrigins },
    },
    agents: {
      defaults: {
        workspace: workspaceDir,
        sandbox: { mode: 'off' },
      },
    },
  };

  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  return configPath;
}

export async function repairConfigForContainer({ dataDir = '/data' } = {}) {
  const configPath = path.join(dataDir, '.openclaw', 'openclaw.json');
  let config;
  try {
    config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return { changed: false, configPath };
    throw error;
  }

  let changed = false;
  let removedCount = 0;

  const load = config.plugins?.load;
  if (Array.isArray(load?.paths)) {
    const existingPaths = [];
    for (const pluginPath of load.paths) {
      if (await exists(pluginPath)) {
        existingPaths.push(pluginPath);
      }
    }
    if (existingPaths.length !== load.paths.length) {
      removedCount += load.paths.length - existingPaths.length;
      config.plugins.load.paths = existingPaths;
      changed = true;
    }
  }

  const installs = config.plugins?.installs;
  if (installs && typeof installs === 'object') {
    for (const [name, install] of Object.entries(installs)) {
      const installPath = install?.installPath || install?.sourcePath;
      if (installPath && !await exists(installPath)) {
        delete installs[name];
        removedCount += 1;
        changed = true;
      }
    }
  }

  const workspace = config.agents?.defaults?.workspace;
  if (typeof workspace === 'string' && workspace.startsWith('/home/') && workspace.includes('/.openclaw/workspace')) {
    config.agents.defaults.workspace = path.join(dataDir, 'workspace');
    changed = true;
  }

  if (!changed) {
    return { changed: false, configPath };
  }

  const backupPath = `${configPath}.railclaw-pre-container-repair`;
  if (!await exists(backupPath)) {
    await fs.copyFile(configPath, backupPath);
  }
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  return { changed: true, configPath, backupPath, removedCount };
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}
