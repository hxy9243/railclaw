import fs from 'node:fs/promises';
import path from 'node:path';

export async function initConfig({ dataDir = '/data', domain, force = false } = {}) {
  const configDir = path.join(dataDir, '.openclaw');
  const workspaceDir = path.join(dataDir, 'workspace');
  const configPath = path.join(configDir, 'openclaw.json');
  await fs.mkdir(configDir, { recursive: true });
  await fs.mkdir(workspaceDir, { recursive: true });

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

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}
