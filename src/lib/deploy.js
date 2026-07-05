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
  await ensureVolume(service, environment);
  await ensureVariables(service, environment);

  if (options.createDomain) {
    await ensureDomain(service, environment);
  }

  const args = ['up', '--service', service, '--environment', environment];
  if (options.detach) args.push('--detach');
  if (options.message) args.push('--message', options.message);
  console.log(`deploying ${service} to ${environment} with railway up`);
  await runRailway(args, { stdio: 'inherit' });
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

async function ensureVolume(service, environment) {
  const result = await runRailway(['volume', 'list', '--service', service, '--environment', environment, '--json']);
  const parsed = JSON.parse(result.stdout || '{}');
  const volumes = parsed.volumes || parsed || [];
  const list = Array.isArray(volumes) ? volumes : [];
  const hasDataVolume = list.some((volume) => volume.mountPath === '/data' || volume.mount_path === '/data');
  if (hasDataVolume) {
    console.log('volume exists: /data');
    return;
  }
  console.log('creating Railway volume mounted at /data');
  await runRailway(['volume', 'add', '--service', service, '--environment', environment, '--mount-path', '/data', '--json']);
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
