import { Command } from 'commander';
import { confirm, input, select } from '@inquirer/prompts';
import { generateToken } from '../lib/token.js';
import { initConfig } from '../lib/config.js';
import { packageMigration, restoreMigration, verifyRestoredData } from '../lib/migration.js';
import { providerInstructions, listProviders } from '../lib/providers.js';
import { smoke } from '../lib/smoke.js';
import { validateRepository } from '../lib/validate.js';
import { doctor } from '../lib/doctor.js';
import { deploy } from '../lib/deploy.js';
import { completeSetup, distributionStatus } from '../lib/distribution.js';

export async function run(argv = process.argv) {
  const program = new Command();

  program
    .name('railclaw')
    .description('OpenClaw migration, config, and validation helper for Railway deployments')
    .version('0.1.0');

  program
    .command('deploy')
    .description('Deploy this OpenClaw app with Railway, creating the service/volume if missing')
    .option('--service <name>', 'Railway service name', 'openclaw')
    .option('--environment <name>', 'Railway environment name', 'production')
    .option('--project-name <name>', 'project name to use when initializing an unlinked project', 'railclaw-openclaw')
    .option('--detach', 'start deploy and return without streaming logs')
    .option('--create-domain', 'create a Railway service domain when none exists')
    .option('--repo <owner/repo>', 'connect the Railway service to a GitHub repo instead of uploading local files')
    .option('--branch <branch>', 'GitHub branch to deploy when --repo is used', 'main')
    .option('--message <message>', 'deployment message')
    .action((options) => deploy(options));

  program
    .command('token')
    .description('Generate an OpenClaw gateway token')
    .argument('[bytes]', 'random byte count', '48')
    .action((bytes) => {
      console.log(generateToken(Number(bytes)));
    });

  program
    .command('validate')
    .description('Validate repository structure and secret hygiene')
    .action(() => validateRepository());

  program
    .command('smoke')
    .description('Check /healthz and /readyz on a running gateway')
    .argument('[url]', 'base URL')
    .action((url) => smoke(url));

  program
    .command('doctor')
    .description('Check local tooling and optionally a live Railclaw/OpenClaw endpoint')
    .option('--url <url>', 'base URL to smoke-test')
    .action((options) => doctor(options));

  program
    .command('setup')
    .description('Initialize persistent /data state and mark terminal setup complete')
    .option('--data-dir <dir>', 'target data directory', '/data')
    .option('--domain <url>', 'Railway or custom domain allowed origin')
    .option('--gateway-token <token>', 'gateway token already configured in Railway variables')
    .option('--generate-token', 'generate and print a gateway token for Railway')
    .action(async (options) => {
      const result = await completeSetup({
        dataDir: options.dataDir,
        domain: options.domain,
        token: options.gatewayToken,
        generateGatewayToken: options.generateToken,
      });
      console.log(`initialized OpenClaw state: ${result.configPath}`);
      console.log(`updated distribution state: ${result.statePath}`);
      if (result.gatewayToken) {
        console.log(`OPENCLAW_GATEWAY_TOKEN=${result.gatewayToken}`);
      }
      console.log('run doctor next: openclaw-railway doctor');
    });

  program
    .command('status')
    .description('Print persistent distribution setup status')
    .option('--data-dir <dir>', 'target data directory', '/data')
    .option('--json', 'print JSON')
    .action(async (options) => {
      const status = await distributionStatus({ dataDir: options.dataDir });
      if (options.json) {
        console.log(JSON.stringify(status, null, 2));
        return;
      }
      console.log(`data: ${status.dataDir}`);
      console.log(`initialized: ${status.initialized}`);
      console.log(`setup completed: ${status.setupCompleted}`);
      console.log(`config exists: ${status.configExists}`);
      console.log(`workspace exists: ${status.workspaceExists}`);
    });

  const config = program.command('config').description('Manage basic OpenClaw config');
  config
    .command('init')
    .description('Create a basic /data-oriented OpenClaw config')
    .option('--data-dir <dir>', 'target data directory', '/data')
    .option('--domain <url>', 'Railway or custom domain allowed origin')
    .option('--force', 'replace an existing openclaw.json')
    .action(async (options) => {
      const file = await initConfig(options);
      console.log(`created ${file}`);
    });

  const providers = program.command('providers').description('Provider/channel auth helpers');
  providers
    .command('configure')
    .description('Print Railway variable commands for provider/channel secrets')
    .option('--provider <name...>', `provider names: ${listProviders().join(', ')}`)
    .action((options) => {
      const names = options.provider?.length ? options.provider : listProviders();
      console.log(providerInstructions(names));
      console.log('\nRun these with the official Railway CLI; railclaw does not store provider secrets.');
    });

  program
    .command('migrate')
    .description('Package, restore, or verify OpenClaw config, auth, provider state, and workspace data')
    .option('--mode <mode>', 'package, restore, or verify')
    .option('--config-dir <dir>', 'source OpenClaw config/state directory', '~/.openclaw')
    .option('--secret-dir <dir>', 'source auth-profile secret directory', '~/.config/openclaw')
    .option('--codex-dir <dir>', 'source Codex auth/state directory', '~/.codex')
    .option('--opencode-dir <dir>', 'source Opencode auth/state directory', '~/.config/opencode')
    .option('--workspace-dir <dir>', 'source workspace directory', './workspace')
    .option('--output <dir>', 'archive output directory', './migration-out')
    .option('--archive <path>', 'archive path for restore mode')
    .option('--data-dir <dir>', 'restore/verify data directory', '/data')
    .option('--yes', 'confirm destructive restore replacement')
    .option('--url <url>', 'optional live endpoint to smoke-test after restore/verify')
    .action(async (options) => {
      const mode = options.mode || await select({
        message: 'Migration action',
        choices: [
          { name: 'Package local config/auth/workspace into an archive', value: 'package' },
          { name: 'Restore an archive into a mounted data directory', value: 'restore' },
          { name: 'Verify restored data and optional health URL', value: 'verify' },
        ],
      });

      if (mode === 'package') {
        if (!process.env.MIGRATION_PASSPHRASE) {
          const proceed = await confirm({
            message: 'MIGRATION_PASSPHRASE is not set, so the archive will be plaintext. Continue?',
            default: false,
          });
          if (!proceed) throw new Error('migration packaging cancelled');
        }
        const archive = await packageMigration(options);
        console.log(`created migration archive: ${archive}`);
        console.log(`created checksum: ${archive}.sha256`);
        console.log('Next: upload/restore the archive into the Railway volume, then run railway up or railway restart.');
        return;
      }

      if (mode === 'restore') {
        const archive = options.archive || await input({ message: 'Migration archive path' });
        const result = await restoreMigration(archive, options);
        console.log(`restored OpenClaw data into ${result.dataDir}`);
        if (options.url) await smoke(options.url);
        console.log('Next: run railway up or railway restart so the service loads the restored config and auth.');
        return;
      }

      if (mode === 'verify') {
        const result = await verifyRestoredData(options.dataDir);
        console.log(`verified restored data under ${result.dataDir}`);
        if (options.url) await smoke(options.url);
        return;
      }

      throw new Error(`unknown migration mode: ${mode}`);
    });

  await program.parseAsync(argv);
}
