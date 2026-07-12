# OpenClaw Railway

Deploy a customizable OpenClaw distribution to Railway from a forked Git repository.

## Quickstart

1. Fork this repository.
2. Optional: edit the extension manifests:
   - `extensions/apt.txt`
   - `extensions/npm.txt`
   - `extensions/pip.txt`
   - `extensions/browsers.yaml`
   - `extensions/skills.yaml`
3. Create a Railway project from the fork.
4. Attach a persistent Railway volume mounted at `/data`.
5. Set the HTTP proxy port to `8080`.
6. Deploy the service.
7. Open the Railway terminal and run:

```bash
openclaw-railway setup --generate-token
openclaw-railway doctor
```

8. Add the printed `OPENCLAW_GATEWAY_TOKEN` as a Railway variable, then redeploy or restart.
9. Open the public Railway URL.

## What This Repo Defines

- Pinned OpenClaw npm package: `openclaw@2026.6.10`.
- Build-time extension manifests for system, Node.js, Python, browser, and future skill packages.
- A Railway-ready Docker image.
- Persistent `/data` state layout.
- Terminal setup, status, doctor, migration, and smoke-test helpers.
- Dependabot and GitHub Actions checks for upgrades and builds.

## Persistent Data

Railway should mount one volume at `/data`.

| Path | Purpose |
| --- | --- |
| `/data/.openclaw` | OpenClaw config and state |
| `/data/.openclaw-distribution` | Distribution setup metadata |
| `/data/.config/openclaw` | OpenClaw auth-profile secret material |
| `/data/workspace` | Agent workspace |
| `/data/.codex` | Codex CLI state when used |
| `/data/.config/opencode` | Opencode state when used |

Do not store mutable user configuration in the image filesystem. Railway can replace the container at any time; `/data` is the durable boundary.

## Customizing The Image

Edit extension manifests before deploying:

```text
extensions/apt.txt      Debian packages
extensions/npm.txt      Global npm tools
extensions/pip.txt      Python packages
extensions/browsers.yaml Browser intent
extensions/skills.yaml  Future skill/plugin manifest
```

Use pinned versions for production forks where possible. Dependabot and the weekly workflow are intended to propose upgrades instead of resolving `latest` during each deploy.

You can append packages at build time with Railway build args:

```text
EXTRA_APT_PACKAGES
EXTRA_NPM_PACKAGES
EXTRA_PIP_PACKAGES
INSTALL_PLAYWRIGHT_BROWSERS
OPENCLAW_NPM_PACKAGE
```

## Local Checks

```bash
npm ci
npm test
npm run check
docker build --build-arg INSTALL_PLAYWRIGHT_BROWSERS=0 -t openclaw-railway .
```

## Setup Commands

Generate a token:

```bash
openclaw-railway token
```

Initialize persistent state:

```bash
openclaw-railway setup --generate-token
```

Inspect setup state:

```bash
openclaw-railway status
openclaw-railway status --json
```

Run diagnostics:

```bash
openclaw-railway doctor
openclaw-railway smoke https://YOUR-RAILWAY-DOMAIN.up.railway.app
```

## Migration

Package local OpenClaw state:

```bash
export MIGRATION_PASSPHRASE='<strong one-time passphrase>'
openclaw-railway migrate --mode package \
  --config-dir ~/.openclaw \
  --secret-dir ~/.config/openclaw \
  --workspace-dir /path/to/workspace \
  --output ./migration-out
```

Restore into a mounted Railway-style data directory:

```bash
export MIGRATION_PASSPHRASE='<same passphrase>'
openclaw-railway migrate --mode restore \
  --archive ./migration-out/railclaw-migration-YYYYMMDDTHHMMSSZ.tar.gz.enc \
  --data-dir /data \
  --yes
```

Restart or redeploy after restore, then run `openclaw-railway doctor`.

## Security Notes

- Do not commit `.env`, provider keys, gateway tokens, OAuth tokens, auth-profile secrets, workspace data, migration archives, Railway local state, or personal paths.
- Store deployed secrets in Railway variables.
- Treat migration archives as secrets.
- Keep `/data` attached before first production use.
