# Agent Instructions

This repo deploys OpenClaw to Railway with a Node.js CLI named `railclaw`. Keep it generic, repeatable, and secret-safe.

## Invariants

- Never commit `.env`, real OpenClaw config, provider keys, channel tokens, passcodes, auth-profile secrets, memory/state, workspace files, migration archives, Railway local state, or personal paths.
- Runtime persistent data must live under `/data`.
- `/home/node/.openclaw` must resolve to `/data/.openclaw`.
- `/home/node/.config/openclaw` must resolve to `/data/.config/openclaw`.
- The deployed gateway must listen on `OPENCLAW_GATEWAY_PORT`, normally `8080`.
- The primary Dockerfile installs OpenClaw from npm for verifiable public builds. `Dockerfile.official-image` is the optional official-image variant.
- Pin `OPENCLAW_NPM_PACKAGE` or `OPENCLAW_IMAGE` for production repeatability.
- Keep examples placeholder-only.
- Run `npm test` and `npm run check` before finalizing changes.

## Important Files

- `bin/railclaw.js`: CLI executable.
- `src/cli/index.js`: CLI command routing.
- `src/lib/migration.js`: unified config/auth/workspace migration.
- `src/container/entrypoint.js`: creates `/data` directories and home symlinks before starting OpenClaw.
- `Dockerfile`: Railway image using the pinned npm package path.
- `Dockerfile.official-image`: optional image that inherits `ghcr.io/openclaw/openclaw`.
- `railway.json`: Railway build and deploy config.
- `Makefile`: thin workflow surface.
- `README.md`: human deployment guide.

## Change Workflow

1. Inspect current git status.
2. Make the smallest coherent change.
3. Run `git diff --check`.
4. Run focused checks for the changed area.
5. Before declaring completion, run:

```bash
npm test
npm run check
git status --short
```

## Migration Workflow

Use encrypted migration archives by setting `MIGRATION_PASSPHRASE`.

Package all operational OpenClaw data:

```bash
export MIGRATION_PASSPHRASE='<strong one-time passphrase>'
npm run railclaw -- migrate --mode package \
  --config-dir ~/.openclaw \
  --secret-dir ~/.config/openclaw \
  --workspace-dir /path/to/workspace \
  --output ./migration-out
```

Restore:

```bash
export MIGRATION_PASSPHRASE='<same passphrase>'
npm run railclaw -- migrate --mode restore \
  --archive ./migration-out/railclaw-migration-YYYYMMDDTHHMMSSZ.tar.gz.enc \
  --data-dir /data \
  --yes
```

After restore, restart or redeploy with the official Railway CLI and run a smoke test.

## Railway Checklist

- Official Railway CLI installed and authenticated.
- GitHub repo connected or project linked with `railway link`.
- `make deploy` or `railclaw deploy` creates the `openclaw` service when missing.
- Service uses Dockerfile builder.
- Volume mounted at `/data`.
- HTTP Proxy configured on port `8080`.
- `OPENCLAW_GATEWAY_PORT=8080` set as a Railway variable.
- `OPENCLAW_GATEWAY_TOKEN` set as a Railway variable.
- Provider/channel secrets set as Railway variables.
- Healthcheck path is `/healthz`.
- `railclaw smoke` passes against the Railway domain.

## Review Checklist

- `git ls-files` does not include state, archive, `.env`, or local Railway files.
- No tracked file contains a personal home path.
- No tracked file contains real-looking API keys or gateway tokens.
- Dockerfiles still use `src/container/entrypoint.js`.
- Docs and tests agree on `/data/.openclaw`, `/data/.config/openclaw`, `/data/workspace`, and home symlinks.
