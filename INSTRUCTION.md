# Agent Instructions

This repo deploys OpenClaw to Railway. Keep it generic, repeatable, and secret-safe.

## Invariants

- Never commit `.env`, real OpenClaw config, provider keys, channel tokens, passcodes, auth-profile secrets, memory/state, workspace files, migration archives, Railway local state, or personal paths.
- Runtime persistent data must live under `/data`.
- The deployed gateway must listen on Railway's `$PORT`.
- Prefer the official OpenClaw image as the base image. Pin `OPENCLAW_IMAGE` for production repeatability.
- Keep examples placeholder-only.
- Run `scripts/validate.sh` before finalizing changes.

## Important Files

- `Dockerfile`: Railway image. Inherits `ghcr.io/openclaw/openclaw` through `ARG OPENCLAW_IMAGE`.
- `railway.json`: Railway build and deploy config.
- `.env.example`: placeholder-only environment documentation.
- `config/openclaw.example.json`: placeholder-only OpenClaw config example.
- `scripts/package-openclaw-data.sh`: creates a migration archive from existing OpenClaw directories.
- `scripts/restore-openclaw-data.sh`: restores a migration archive into `/data`.
- `scripts/validate.sh`: repository validation and secret hygiene checks.
- `scripts/smoke-test.sh`: checks `/healthz` and `/readyz` on a running gateway.
- `README.md`: human deployment guide.

## Change Workflow

1. Inspect current git status.
2. Make the smallest coherent change.
3. Run `git diff --check`.
4. Run focused checks for the changed area.
5. Commit frequently with a clear message.
6. Before declaring completion, run:

```bash
scripts/validate.sh
test/migration-smoke.sh
git status --short
```

## Migration Workflow

Use encrypted migration archives by setting `MIGRATION_PASSPHRASE`.

Package:

```bash
export MIGRATION_PASSPHRASE='<strong one-time passphrase>'
scripts/package-openclaw-data.sh \
  --config-dir /path/to/.openclaw \
  --secret-dir /path/to/.config/openclaw \
  --workspace-dir /path/to/workspace \
  --output ./migration-out
```

Restore:

```bash
export MIGRATION_PASSPHRASE='<same passphrase>'
scripts/restore-openclaw-data.sh ./migration-out/openclaw-migration-YYYYMMDDTHHMMSSZ.tar.gz.enc --data-dir /data
```

Delete local migration archives after successful restore unless there is a deliberate encrypted backup policy.

## Railway Checklist

- GitHub repo connected to Railway.
- Service uses Dockerfile builder.
- Volume mounted at `/data`.
- `OPENCLAW_GATEWAY_TOKEN` set as a Railway variable.
- Provider/channel secrets set as Railway variables.
- Public domain configured only after auth is understood.
- Healthcheck path is `/healthz`.
- Smoke test passes against the Railway domain.

## Review Checklist

- `git ls-files` does not include state, archive, `.env`, or local Railway files.
- No tracked file contains a personal home path.
- No tracked file contains real-looking API keys or gateway tokens.
- Dockerfile still copies scripts into `/opt/openclaw-deploy/scripts`.
- Docs and scripts agree on `/data/.openclaw`, `/data/.config/openclaw`, and `/data/workspace`.
