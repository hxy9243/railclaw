import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as tar from 'tar';
import { expandHome } from './paths.js';

const FORMAT = 'railclaw-migration-v1';
const ENCRYPTION_MAGIC = 'railclaw-enc-v1';

const DEFAULT_EXCLUDES = [
  '.git',
  'node_modules',
  'tmp',
  '.cache',
];

export async function packageMigration(options = {}) {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const outputDir = path.resolve(expandHome(options.output || './migration-out'));
  const workdir = await fs.mkdtemp(path.join(os.tmpdir(), 'railclaw-migration-'));
  const payloadDir = path.join(workdir, 'payload');
  await fs.mkdir(outputDir, { recursive: true, mode: 0o700 });
  await fs.mkdir(payloadDir, { recursive: true });

  try {
    const sources = normalizeSources(options);
    await copyTree(sources.configDir, path.join(payloadDir, 'config'));
    await copyTree(sources.secretDir, path.join(payloadDir, 'auth-profile-secrets'));
    await copyTree(sources.workspaceDir, path.join(payloadDir, 'workspace'));
    const optionalIncludes = [];
    for (const [label, source] of [
      ['codex-auth', sources.codexDir],
      ['opencode-auth', sources.opencodeDir],
    ]) {
      if (await exists(source)) {
        await copyTree(source, path.join(payloadDir, label));
        optionalIncludes.push(label);
      }
    }

    const manifest = {
      format: FORMAT,
      createdUtc: timestamp,
      targetConfigDir: '/data/.openclaw',
      targetSecretDir: '/data/.config/openclaw',
      targetCodexDir: '/data/.codex',
      targetOpencodeDir: '/data/.config/opencode',
      targetWorkspaceDir: '/data/workspace',
      includes: ['config', 'auth-profile-secrets', 'workspace', ...optionalIncludes],
    };
    await fs.writeFile(path.join(payloadDir, 'MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`);

    const archive = path.join(outputDir, `railclaw-migration-${timestamp}.tar.gz`);
    await tar.c({ gzip: true, cwd: payloadDir, file: archive }, ['.']);

    let finalArchive = archive;
    if (process.env.MIGRATION_PASSPHRASE) {
      finalArchive = `${archive}.enc`;
      await encryptFile(archive, finalArchive, process.env.MIGRATION_PASSPHRASE);
      await fs.rm(archive, { force: true });
    }

    await writeChecksum(finalArchive);
    return finalArchive;
  } finally {
    await fs.rm(workdir, { recursive: true, force: true });
  }
}

export async function restoreMigration(archivePath, options = {}) {
  if (!archivePath) throw new Error('archive path is required');
  const archive = path.resolve(expandHome(archivePath));
  const dataDir = path.resolve(expandHome(options.dataDir || '/data'));
  const workdir = await fs.mkdtemp(path.join(os.tmpdir(), 'railclaw-restore-'));
  const payloadArchive = path.join(workdir, 'payload.tar.gz');
  const extractDir = path.join(workdir, 'extract');

  try {
    if (archive.endsWith('.enc')) {
      if (!process.env.MIGRATION_PASSPHRASE) {
        throw new Error('MIGRATION_PASSPHRASE is required for encrypted archives');
      }
      await decryptFile(archive, payloadArchive, process.env.MIGRATION_PASSPHRASE);
    } else {
      await fs.copyFile(archive, payloadArchive);
    }

    await fs.mkdir(extractDir, { recursive: true });
    await tar.x({ cwd: extractDir, file: payloadArchive });
    await validatePayload(extractDir);

    const targets = [
      ['config', path.join(dataDir, '.openclaw')],
      ['auth-profile-secrets', path.join(dataDir, '.config/openclaw')],
      ['workspace', path.join(dataDir, 'workspace')],
    ];
    const optionalTargets = [
      ['codex-auth', path.join(dataDir, '.codex')],
      ['opencode-auth', path.join(dataDir, '.config/opencode')],
    ];
    for (const [source, target] of optionalTargets) {
      if (await exists(path.join(extractDir, source))) {
        targets.push([source, target]);
      }
    }

    if (!options.yes) {
      const existing = [];
      for (const [, target] of targets) {
        if (await exists(target)) existing.push(target);
      }
      if (existing.length > 0) {
        throw new Error(`restore would replace existing directories: ${existing.join(', ')}; pass --yes to confirm`);
      }
    }

    for (const [source, target] of targets) {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.rm(target, { recursive: true, force: true });
      await copyTree(path.join(extractDir, source), target, { preserveMode: true });
    }

    return verifyRestoredData(dataDir);
  } finally {
    await fs.rm(workdir, { recursive: true, force: true });
  }
}

export async function verifyRestoredData(dataDir = '/data') {
  const resolved = path.resolve(expandHome(dataDir));
  const required = [
    path.join(resolved, '.openclaw'),
    path.join(resolved, '.config/openclaw'),
    path.join(resolved, 'workspace'),
  ];
  const missing = [];
  for (const dir of required) {
    if (!await exists(dir)) missing.push(dir);
  }
  if (missing.length > 0) throw new Error(`migration restore is missing: ${missing.join(', ')}`);
  return { dataDir: resolved, required };
}

function normalizeSources(options) {
  const configDir = path.resolve(expandHome(options.configDir || '~/.openclaw'));
  const secretDir = path.resolve(expandHome(options.secretDir || '~/.config/openclaw'));
  const codexDir = path.resolve(expandHome(options.codexDir || '~/.codex'));
  const opencodeDir = path.resolve(expandHome(options.opencodeDir || '~/.config/opencode'));
  const workspaceDir = path.resolve(expandHome(options.workspaceDir || './workspace'));
  for (const [label, value] of Object.entries({ configDir, secretDir, workspaceDir })) {
    if (!value) throw new Error(`${label} is required`);
  }
  return { configDir, secretDir, codexDir, opencodeDir, workspaceDir };
}

async function validatePayload(extractDir) {
  const manifestPath = path.join(extractDir, 'MANIFEST.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  if (manifest.format !== FORMAT) throw new Error(`unsupported migration format: ${manifest.format}`);
  for (const required of ['config', 'auth-profile-secrets', 'workspace']) {
    const stat = await fs.stat(path.join(extractDir, required));
    if (!stat.isDirectory()) throw new Error(`archive is missing directory: ${required}`);
  }
}

async function copyTree(source, target) {
  const sourceStat = await fs.stat(source);
  if (!sourceStat.isDirectory()) throw new Error(`directory does not exist: ${source}`);
  await fs.mkdir(target, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    if (shouldExclude(entry.name)) continue;
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) {
      await copyTree(from, to);
    } else if (entry.isSymbolicLink()) {
      const link = await fs.readlink(from);
      await fs.symlink(link, to);
    } else if (entry.isFile()) {
      await fs.copyFile(from, to);
      const stat = await fs.stat(from);
      await fs.chmod(to, stat.mode);
    }
  }
}

function shouldExclude(name) {
  return DEFAULT_EXCLUDES.includes(name) || name.endsWith('.sock') || name.endsWith('.pid');
}

async function encryptFile(input, output, passphrase) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(passphrase, salt, 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = await fs.readFile(input);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const header = Buffer.from(`${ENCRYPTION_MAGIC}\n${JSON.stringify({
    kdf: 'scrypt',
    cipher: 'aes-256-gcm',
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  })}\n`);
  await fs.writeFile(output, Buffer.concat([header, ciphertext]), { mode: 0o600 });
}

async function decryptFile(input, output, passphrase) {
  const content = await fs.readFile(input);
  const first = content.indexOf(0x0a);
  const second = content.indexOf(0x0a, first + 1);
  const magic = content.subarray(0, first).toString('utf8');
  if (magic !== ENCRYPTION_MAGIC) throw new Error('encrypted archive has an unsupported format');
  const metadata = JSON.parse(content.subarray(first + 1, second).toString('utf8'));
  const key = crypto.scryptSync(passphrase, Buffer.from(metadata.salt, 'base64'), 32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(metadata.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(metadata.tag, 'base64'));
  const ciphertext = content.subarray(second + 1);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  await fs.writeFile(output, plaintext, { mode: 0o600 });
}

async function writeChecksum(file) {
  const hash = crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');
  await fs.writeFile(`${file}.sha256`, `${hash}  ${path.basename(file)}\n`, { mode: 0o600 });
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}
