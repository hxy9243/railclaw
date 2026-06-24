# OpenClaw Railway Deploy

Repeatable Railway deployment wrapper for [OpenClaw](https://github.com/openclaw/openclaw).

This repo intentionally contains only generic deploy code, examples, and scripts. Do not commit real OpenClaw config, provider keys, channel tokens, passcodes, memory, workspace contents, archives, or Railway local state.

## What This Provides

- `Dockerfile` based on the official `ghcr.io/openclaw/openclaw` image.
- Railway config in `railway.json`.
- Persistent state layout under a single Railway volume mounted at `/data`.
- Example environment and OpenClaw config files.
- Secure migration scripts for existing OpenClaw config, memory/state, auth-profile secrets, and workspace data.
- Validation and smoke-test scripts for repeatable deploys.
- Agent instructions in `INSTRUCTION.md`.

## Architecture

The container runs OpenClaw gateway on Railway's `$PORT`, defaulting locally to `8080`.

Persistent data is expected at:

| Path | Purpose |
| --- | --- |
| `/data/.openclaw` | OpenClaw config, state, agents, auth profiles, memories, installed plugin state |
| `/data/.config/openclaw` | Auth-profile secret key material |
| `/data/workspace` | Agent workspace |

Railway volumes are mounted only at runtime, not at build time. Anything that must survive redeploys must be written under `/data`.

## Deploy To Railway

1. Create a new Railway service from this GitHub repo.
2. Ensure Railway uses the root `Dockerfile`. The included `railway.json` sets the builder to `DOCKERFILE`.
3. Add a Railway volume mounted at `/data`.
4. Add service variables:

```dotenv
OPENCLAW_GATEWAY_TOKEN=<long-random-token>
OPENCLAW_DISABLE_BONJOUR=1
OPENCLAW_GATEWAY_BIND=lan
OPENCLAW_TZ=UTC
```

Generate a token locally:

```bash
scripts/generate-token.sh
```

5. Add provider and channel secrets as Railway variables, not committed files.
6. Deploy.
7. Open the Railway domain and use the configured gateway token when OpenClaw asks for authorization.

## Version Pinning

The Dockerfile defaults to:

```text
ghcr.io/openclaw/openclaw:latest
```

For repeatable production deploys, set the Railway build argument `OPENCLAW_IMAGE` to a fixed OpenClaw tag, for example:

```text
ghcr.io/openclaw/openclaw:2026.6.10
```

Use `latest` only when you want automatic upstream updates.

## Local Run

```bash
cp .env.example .env
scripts/generate-token.sh
# paste the generated token into .env
docker compose up --build
```

Then test:

```bash
scripts/smoke-test.sh http://127.0.0.1:8080
```

## Migrate Existing OpenClaw Data

Migration archives contain secrets. Prefer encrypted archives and delete them after restore.

Package existing local data:

```bash
export MIGRATION_PASSPHRASE='<strong one-time passphrase>'
scripts/package-openclaw-data.sh \
  --config-dir /path/to/existing/.openclaw \
  --secret-dir /path/to/existing/.config/openclaw \
  --workspace-dir /path/to/existing/workspace \
  --output ./migration-out
```

Restore into a running environment with `/data` mounted:

```bash
export MIGRATION_PASSPHRASE='<same passphrase>'
scripts/restore-openclaw-data.sh ./migration-out/openclaw-migration-YYYYMMDDTHHMMSSZ.tar.gz.enc --data-dir /data
```

For Railway, use one of these patterns:

- Use Railway's volume file tools to upload the archive, then run the restore script in a shell attached to the service.
- Temporarily build/run the image locally with the Railway volume mounted if your workflow supports it.
- Restore before first real use to avoid overwriting newly-created remote state.

After restore, redeploy or restart the service and run:

```bash
scripts/smoke-test.sh https://YOUR-RAILWAY-DOMAIN.up.railway.app
```

## Validation

Run:

```bash
scripts/validate.sh
```

This checks:

- Required files exist.
- JSON examples parse.
- Dockerfile uses the official OpenClaw image argument.
- OpenClaw state paths are pinned to `/data`.
- Railway healthcheck points at `/healthz`.
- Git is not tracking obvious state, archives, `.env`, personal paths, or secret-looking values.
- Shell scripts parse.

## Security Notes

- Treat `OPENCLAW_GATEWAY_TOKEN`, provider API keys, channel tokens, auth profiles, passcodes, and migration archives as secrets.
- Keep `.env` local only. Railway variables are the source of truth for deployed secrets.
- Do not expose the Railway public endpoint unless the gateway token and OpenClaw security settings are configured.
- Keep the `/data` Railway volume attached before first production use.
- Sandbox mode is off by default in the example config. Enabling Docker-backed sandboxing on Railway requires extra review because mounting Docker sockets or nested container runtimes changes the trust boundary.

## Upstream References

- OpenClaw Docker docs: https://docs.openclaw.ai/install/docker
- OpenClaw Railway docs: https://docs.openclaw.ai/install/railway
- OpenClaw container registry: https://github.com/openclaw/openclaw/pkgs/container/openclaw
- Railway Dockerfile docs: https://docs.railway.com/builds/dockerfiles
- Railway volumes docs: https://docs.railway.com/volumes
- Railway variables docs: https://docs.railway.com/variables
