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

export async function repairStateForContainer({ dataDir = '/data' } = {}) {
  const openclawDir = path.join(dataDir, '.openclaw');
  if (!await exists(openclawDir)) {
    return { repairedCount: 0 };
  }

  const hasSqlite = await hasSqliteState(openclawDir);
  if (!hasSqlite) {
    return { repairedCount: 0 };
  }

  let repairedCount = 0;

  const rootLegacyFiles = [
    'update-check.json',
    'plugin-approvals.json',
    'conversations.json',
    'exec-approvals.json',
  ];
  for (const file of rootLegacyFiles) {
    const filePath = path.join(openclawDir, file);
    if (await exists(filePath)) {
      await archiveLegacyFile(filePath);
      repairedCount += 1;
    }
  }

  const cronJobsPath = path.join(openclawDir, 'cron', 'jobs.json');
  if (await exists(cronJobsPath)) {
    await archiveLegacyFile(cronJobsPath);
    repairedCount += 1;
  }

  const pluginsIndexPath = path.join(openclawDir, 'plugins', 'index.json');
  if (await exists(pluginsIndexPath)) {
    await archiveLegacyFile(pluginsIndexPath);
    repairedCount += 1;
  }

  const voiceWakeDir = path.join(openclawDir, 'voice-wake');
  if (await exists(voiceWakeDir)) {
    try {
      const vwEntries = await fs.readdir(voiceWakeDir);
      for (const vwFile of vwEntries) {
        if (!vwFile.endsWith('.migrated') && !vwFile.endsWith('.bak')) {
          await archiveLegacyFile(path.join(voiceWakeDir, vwFile));
          repairedCount += 1;
        }
      }
    } catch {}
  }

  repairedCount += await archiveSidecarsRecursively(openclawDir);

  return { repairedCount };
}

async function hasSqliteState(openclawDir) {
  const primaryDbPaths = [
    path.join(openclawDir, 'state', 'openclaw.sqlite'),
    path.join(openclawDir, 'plugin-state', 'state.sqlite'),
    path.join(openclawDir, 'flows', 'registry.sqlite'),
    path.join(openclawDir, 'tasks', 'runs.sqlite'),
    path.join(openclawDir, 'cron', 'cron.sqlite'),
    path.join(openclawDir, 'state.sqlite'),
    path.join(openclawDir, 'openclaw.sqlite'),
  ];
  for (const dbPath of primaryDbPaths) {
    if (await exists(dbPath)) return true;
  }
  return await containsAnySqlite(openclawDir);
}

async function containsAnySqlite(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (await containsAnySqlite(fullPath)) return true;
      } else if (entry.isFile() && entry.name.endsWith('.sqlite')) {
        return true;
      }
    }
  } catch {}
  return false;
}

async function archiveSidecarsRecursively(dir) {
  let count = 0;
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        count += await archiveSidecarsRecursively(fullPath);
      } else if (
        entry.isFile() &&
        entry.name.includes('.jsonl.') &&
        entry.name.endsWith('.json') &&
        !entry.name.endsWith('.migrated') &&
        !entry.name.endsWith('.bak')
      ) {
        await archiveLegacyFile(fullPath);
        count += 1;
      }
    }
  } catch {}
  return count;
}

async function archiveLegacyFile(filePath) {
  let dest = `${filePath}.migrated`;
  if (await exists(dest)) {
    dest = `${filePath}.${Date.now()}.bak`;
  }
  try {
    await fs.rename(filePath, dest);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      await fs.rm(filePath, { force: true }).catch(() => {});
    }
  }
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

