import fs from 'node:fs/promises';
import path from 'node:path';
import { generateToken } from './token.js';
import { initConfig } from './config.js';
import { ensureRealDir } from './container-layout.js';

export const DISTRIBUTION_VERSION = '0.1.0';
export const SCHEMA_VERSION = 1;

export async function bootstrapDistribution({ dataDir = '/data', domain } = {}) {
  const stateDir = path.join(dataDir, '.openclaw');
  const workspaceDir = path.join(dataDir, 'workspace');
  const distributionDir = path.join(dataDir, '.openclaw-distribution');
  const statePath = path.join(distributionDir, 'state.json');
  const configPath = path.join(stateDir, 'openclaw.json');

  await ensureRealDir(stateDir);
  await ensureRealDir(workspaceDir);
  await ensureRealDir(distributionDir);

  let createdConfig = false;
  if (!await exists(configPath)) {
    await initConfig({ dataDir, domain });
    createdConfig = true;
  }

  const existing = await readState(statePath);
  const state = {
    distributionVersion: DISTRIBUTION_VERSION,
    schemaVersion: SCHEMA_VERSION,
    initialized: true,
    setupCompleted: Boolean(existing.setupCompleted),
    createdAt: existing.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    paths: {
      stateDir,
      workspaceDir,
      distributionDir,
      configPath,
    },
  };

  await writeState(statePath, state);
  return { state, statePath, configPath, createdConfig };
}

export async function completeSetup({
  dataDir = '/data',
  domain,
  token,
  generateGatewayToken = false,
} = {}) {
  const result = await bootstrapDistribution({ dataDir, domain });
  const state = {
    ...result.state,
    setupCompleted: true,
    setupCompletedAt: new Date().toISOString(),
  };

  let gatewayToken = token;
  if (!gatewayToken && generateGatewayToken) {
    gatewayToken = generateToken(48);
  }

  if (gatewayToken) {
    state.gatewayToken = {
      source: token ? 'provided' : 'generated',
      configuredAt: new Date().toISOString(),
    };
  }

  await writeState(result.statePath, state);
  return { ...result, state, gatewayToken };
}

export async function distributionStatus({ dataDir = '/data' } = {}) {
  const distributionDir = path.join(dataDir, '.openclaw-distribution');
  const statePath = path.join(distributionDir, 'state.json');
  const configPath = path.join(dataDir, '.openclaw', 'openclaw.json');
  const state = await readState(statePath);
  return {
    dataDir,
    statePath,
    configPath,
    initialized: Boolean(state.initialized),
    setupCompleted: Boolean(state.setupCompleted),
    distributionVersion: state.distributionVersion || null,
    schemaVersion: state.schemaVersion || null,
    configExists: await exists(configPath),
    workspaceExists: await exists(path.join(dataDir, 'workspace')),
  };
}

async function readState(statePath) {
  try {
    return JSON.parse(await fs.readFile(statePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

async function writeState(statePath, state) {
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}
