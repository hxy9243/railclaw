import { execa } from 'execa';
import { generateToken } from './token.js';

const DEFAULT_VARIABLES = {
  OPENCLAW_GATEWAY_PORT: '8080',
  PORT: '8080',
  OPENCLAW_DISABLE_BONJOUR: '1',
  OPENCLAW_GATEWAY_BIND: 'lan',
  OPENCLAW_TZ: 'UTC',
};

export async function deploy(options = {}) {
  const service = options.service || 'openclaw';
  const environment = options.environment || 'production';
  const projectName = options.projectName || 'railclaw-openclaw';

  await requireRailway();
  let status = await getStatus();
  if (!status) {
    console.log(`no linked Railway project found; creating project ${projectName}`);
    await runRailway(['init', '--name', projectName, '--json']);
    status = await getStatus();
  }

  await ensureService(status, service);
  status = await getStatus();
  const target = resolveTarget(status, { service, environment });
  await ensureVariables(service, environment);
  let volumeReady = await tryEnsureVolume(target);

  if (options.createDomain) {
    await ensureDomain(service, environment);
  }

  const args = ['up', '--service', service, '--environment', environment];
  if (options.detach) args.push('--detach');
  if (options.message) args.push('--message', options.message);
  console.log(`deploying ${service} to ${environment} with railway up`);
  await runRailway(args, { stdio: 'inherit' });

  if (!volumeReady) {
    console.log('retrying /data volume setup after initial deploy');
    volumeReady = await tryEnsureVolume(target);
    if (volumeReady && options.detach) {
      console.log('volume attached after deploy; redeploying detached so OpenClaw starts with /data mounted');
      await runRailway(args, { stdio: 'inherit' });
    }
  }
}

async function requireRailway() {
  try {
    await execa('railway', ['--version']);
  } catch {
    throw new Error('Railway CLI is required. Install it from https://docs.railway.com/cli');
  }
}

async function getStatus() {
  try {
    const result = await runRailway(['status', '--json']);
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

async function ensureService(status, serviceName) {
  const services = status?.services?.edges?.map((edge) => edge.node) || [];
  if (services.some((service) => service.name === serviceName)) {
    console.log(`service exists: ${serviceName}`);
    return;
  }
  if (services.length > 0) {
    console.log(`project has services (${services.map((service) => service.name).join(', ')}); creating ${serviceName}`);
  } else {
    console.log(`project has no services; creating ${serviceName}`);
  }
  await runRailway(['add', '--service', serviceName, '--json']);
}

export function resolveTarget(status, { service, environment }) {
  const envs = status?.environments?.edges?.map((edge) => edge.node) || [];
  const environmentNode = envs.find((candidate) => candidate.name === environment || candidate.id === environment);
  if (!environmentNode) {
    throw new Error(`Railway environment not found: ${environment}`);
  }

  const services = status?.services?.edges?.map((edge) => edge.node) || [];
  const serviceNode = services.find((candidate) => candidate.name === service || candidate.id === service);
  if (!serviceNode) {
    throw new Error(`Railway service not found: ${service}`);
  }

  return {
    environment,
    environmentId: environmentNode.id,
    service,
    serviceId: serviceNode.id,
  };
}

async function ensureVolume(target) {
  const result = await runRailway([
    'volume',
    '--service',
    target.serviceId,
    '--environment',
    target.environmentId,
    'list',
    '--json',
  ]);
  const parsed = JSON.parse(result.stdout || '{}');
  const volumes = parsed.volumes || parsed || [];
  const list = Array.isArray(volumes) ? volumes : [];
  const hasDataVolume = list.some((volume) => volume.mountPath === '/data' || volume.mount_path === '/data');
  if (hasDataVolume) {
    console.log('volume exists: /data');
    return;
  }
  console.log('creating Railway volume mounted at /data');
  await runRailway([
    'volume',
    '--service',
    target.serviceId,
    '--environment',
    target.environmentId,
    'add',
    '--mount-path',
    '/data',
    '--json',
  ]);
}

async function tryEnsureVolume(target) {
  try {
    await ensureVolume(target);
    return true;
  } catch (error) {
    console.warn(`warn: could not ensure /data volume yet: ${error.shortMessage || error.message}`);
    return false;
  }
}

async function ensureVariables(service, environment) {
  const existing = await listVariables(service, environment);
  const missing = { ...DEFAULT_VARIABLES };
  if (!existing.OPENCLAW_GATEWAY_TOKEN) {
    missing.OPENCLAW_GATEWAY_TOKEN = generateToken();
  }

  for (const [key, value] of Object.entries(missing)) {
    if (existing[key]) {
      console.log(`variable exists: ${key}`);
      continue;
    }
    console.log(`setting variable: ${key}`);
    await runRailway(
      ['variable', 'set', key, '--stdin', '--service', service, '--environment', environment, '--skip-deploys', '--json'],
      { input: value },
    );
  }
}

async function listVariables(service, environment) {
  try {
    const result = await runRailway(['variable', 'list', '--service', service, '--environment', environment, '--json']);
    const parsed = JSON.parse(result.stdout || '{}');
    if (Array.isArray(parsed)) {
      return Object.fromEntries(parsed.map((item) => [item.name || item.key, item.value]).filter(([key]) => key));
    }
    return parsed.variables || parsed;
  } catch {
    return {};
  }
}

async function ensureDomain(service, environment) {
  const result = await runRailway(['domain', 'list', '--service', service, '--environment', environment, '--json']);
  const parsed = JSON.parse(result.stdout || '[]');
  const domains = Array.isArray(parsed) ? parsed : parsed.domains || [];
  if (domains.length > 0) {
    console.log(`domain exists: ${domainName(domains[0])}`);
    return;
  }
  console.log('creating Railway service domain on port 8080');
  await runRailway(['domain', '--service', service, '--environment', environment, '--port', '8080', '--json']);
}

function domainName(domain) {
  return domain.domain || domain.host || domain.url || domain.name || 'unknown';
}

async function runRailway(args, options = {}) {
  return execa('railway', args, {
    reject: true,
    ...options,
  });
}
