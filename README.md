# OpenClaw Railway

Deploy a customizable OpenClaw distribution to Railway from a forked Git repository.

## Quickstart

1. Fork this repository.
2. Optional: edit the extension manifests:
   - `extensions/apt.txt`
   - `extensions/npm.txt`
   - `extensions/pip.txt`
   - `extensions/requirements.txt`
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

### Railway Template

This repo includes `.railway/railway.ts` for Railway Infrastructure as Code. It
defines the `openclaw` service, connects it to a GitHub repo, configures the
Dockerfile builder and `/healthz` healthcheck, and mounts `openclaw-volume` at
`/data`.

For a fork, set the repo before applying:

```bash
export RAILWAY_GITHUB_REPO='<owner>/<repo>'
export RAILWAY_GITHUB_BRANCH='main'
railway config plan
railway config apply
```

Or use the CLI helper to create the service, variables, `/data` volume, optional
domain, and GitHub source link:

```bash
npm run railclaw -- deploy --repo <owner>/<repo> --branch main --create-domain
```

## Dependabot Auto-Merge

This repo includes `.github/workflows/dependabot-automerge.yml`. It only runs for
Dependabot pull requests, approves the PR, then enables GitHub auto-merge with a
squash merge. Required checks still have to pass before GitHub merges the PR.

Enable the required GitHub repository settings after forking:

1. Go to **Settings > General > Pull Requests** and enable **Allow auto-merge**.
2. Go to **Settings > Actions > General > Workflow permissions**.
3. Select **Read and write permissions** or keep the default read permission and
   rely on the workflow's explicit `contents: write` and `pull-requests: write`
   permissions.
4. Enable **Allow GitHub Actions to create and approve pull requests**.
5. Keep branch protection or required status checks enabled for `main` if you
   want Dependabot PRs to merge only after `Validate`, `Build Image`, and
   `Smoke Test` succeed.

If you merge Dependabot PRs from a local `gh` session, the token also needs the
`workflow` scope whenever the PR changes files under `.github/workflows`.

## What This Repo Defines

- OpenClaw base image: `alpine/openclaw:latest`, the public Docker Hub mirror of the official OpenClaw image.
- Build-time extension manifests for system, Node.js, Python, browser, and future skill packages.
- A Railway-ready Docker image layered on the official OpenClaw image.
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
extensions/requirements.txt Standard Python manifest for Dependabot
extensions/browsers.yaml Browser intent
extensions/skills.yaml  Future skill/plugin manifest
```

The Dockerfile inherits from `alpine/openclaw:latest` by default and CI builds with `--pull`, so rebuilds pick up the current OpenClaw image. Override `OPENCLAW_IMAGE` if you have credentials for `ghcr.io/openclaw/openclaw`, or use a specific tag/digest for stricter production repeatability.

The weekly upgrade workflow runs `tools/upgrades/check-openclaw-image.js` to report the current official image selector and registry digest.

You can append packages at build time with Railway build args:

```text
OPENCLAW_IMAGE
OPENCLAW_IMAGE_APT_PACKAGES
OPENCLAW_IMAGE_PIP_PACKAGES
OPENCLAW_INSTALL_BROWSER
EXTRA_APT_PACKAGES
EXTRA_NPM_PACKAGES
EXTRA_PIP_PACKAGES
```

## Local Checks

```bash
npm ci
npm test
npm run check
docker build --pull --build-arg OPENCLAW_INSTALL_BROWSER=0 --build-arg INSTALL_PLAYWRIGHT_BROWSERS=0 -t openclaw-railway .
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
