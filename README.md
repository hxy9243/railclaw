# Railclaw

Railclaw is a small deployment helper for running [OpenClaw](https://github.com/openclaw/openclaw) on Railway.

The repo provides:

- Docker images for OpenClaw on Railway.
- A Node.js CLI named `railclaw` for config, provider auth migration, validation, smoke checks, and diagnostics.
- A thin `Makefile` for broad workflows.
- Railway config in `railway.json`.

Railclaw does not replace the official Railway CLI. Use Railway directly for general auth, project linking, variables, logs, and restarts. The `railclaw deploy` command is a narrow app-specific helper that creates the OpenClaw service/volume if missing and then calls `railway up`. Install and authenticate Railway from the official docs: https://docs.railway.com/cli.

## Layout

Railway should mount one persistent volume at `/data`.

| Path | Purpose |
| --- | --- |
| `/data/.openclaw` | OpenClaw config, state, agents, provider auth profiles, memories, plugin state |
| `/data/.config/openclaw` | OpenClaw auth-profile secret key material |
| `/data/workspace` | Agent workspace |
| `/home/node/.openclaw` | Runtime symlink to `/data/.openclaw` |
| `/home/node/.config/openclaw` | Runtime symlink to `/data/.config/openclaw` |

Railway volume size is plan-dependent. Create or attach the volume at `/data`, then resize it in Railway if you need around 20GB or more.

## Common Commands

Install Node dependencies:

```bash
npm ci
```

From a clone, run the CLI with `npm run railclaw -- ...`. If the package is installed or linked, the binary name is `railclaw`.

Generate a gateway token:

```bash
npm run railclaw -- token
```

Build locally:

```bash
make build
```

Run checks:

```bash
make check
```

Deploy code:

```bash
railway login
railway link
make deploy
```

The deploy helper initializes the app when needed:

```bash
npm run railclaw -- deploy --create-domain
```

It creates an `openclaw` service if the linked project has no matching service, attaches a `/data` volume when missing, sets baseline runtime variables when missing, and then runs `railway up`.

Check local readiness:

```bash
make doctor
npm run railclaw -- doctor --url https://YOUR-RAILWAY-DOMAIN.up.railway.app
```

## Build Customization

The default image installs a pinned OpenClaw npm package and common agent tools.

```bash
make build \
  OPENCLAW_NPM_PACKAGE=openclaw@2026.6.10 \
  EXTRA_NPM_PACKAGES="@openai/codex @anthropic-ai/claude-code @google/gemini-cli obsidian-cli playwright defuddle opencli" \
  EXTRA_PIP_PACKAGES="browser-use" \
  INSTALL_PLAYWRIGHT_BROWSERS=1
```

Use pinned versions for production where possible.

## Railway Setup

1. Install and authenticate the official Railway CLI: https://docs.railway.com/cli.
2. Link or create a Railway project:

```bash
railway link
# or
railway init
```

3. Create/attach a volume mounted at `/data` using Railway’s volume commands or dashboard.
4. Set required service variables:

```bash
railway variable set OPENCLAW_GATEWAY_TOKEN="$(npm run --silent railclaw -- token)"
railway variable set OPENCLAW_GATEWAY_PORT=8080
railway variable set OPENCLAW_DISABLE_BONJOUR=1
railway variable set OPENCLAW_GATEWAY_BIND=lan
railway variable set OPENCLAW_TZ=UTC
```

5. Configure provider and channel secrets through Railway variables:

```bash
npm run railclaw -- providers configure
```

Run the printed `railway variable set ...` commands yourself. Railclaw does not store provider secrets.

6. Deploy:

```bash
make deploy
```

## Unified Migration

`railclaw migrate` migrates all operational OpenClaw data by default:

- OpenClaw config/state, normally `~/.openclaw`.
- Provider/channel auth profiles and provider state.
- Auth-profile secret key material, normally `~/.config/openclaw`.
- Workspace data.

Create an encrypted migration archive:

```bash
export MIGRATION_PASSPHRASE='<strong one-time passphrase>'
npm run railclaw -- migrate --mode package \
  --config-dir ~/.openclaw \
  --secret-dir ~/.config/openclaw \
  --workspace-dir /path/to/workspace \
  --output ./migration-out
```

Restore into a mounted Railway-style data directory:

```bash
export MIGRATION_PASSPHRASE='<same passphrase>'
npm run railclaw -- migrate --mode restore \
  --archive ./migration-out/railclaw-migration-YYYYMMDDTHHMMSSZ.tar.gz.enc \
  --data-dir /data \
  --yes
```

After restore, restart or redeploy the Railway service:

```bash
railway restart
# or
railway up
```

Then verify readiness:

```bash
npm run railclaw -- migrate --mode verify --data-dir /data
npm run railclaw -- smoke https://YOUR-RAILWAY-DOMAIN.up.railway.app
```

After migration and a normal Railway restart/deploy, the instance should be live with the same config, provider auth, auth-profile secrets, and workspace data as the source.

## Security Notes

- Do not commit `.env`, real OpenClaw config, provider keys, channel tokens, passcodes, auth-profile secrets, workspace data, migration archives, Railway local state, or personal paths.
- Treat migration archives as secrets. Prefer encrypted archives and delete them after restore unless retained under a deliberate backup policy.
- Store deployed secrets in Railway variables.
- Keep `/data` attached before first production use.
- Review sandbox settings before enabling Docker-backed sandboxing on Railway.

## Validation

```bash
npm test
npm run check
```

Validation checks JSON files, Dockerfile invariants, required Railclaw files, `/data` path configuration, Railway healthcheck config, and tracked-file secret hygiene.
