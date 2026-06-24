# Migration Guide

OpenClaw stores operational state and secrets outside the deploy code. This repo migrates that data into the Railway volume mounted at `/data`.

## What To Migrate

Package these source directories from the existing OpenClaw install:

- OpenClaw config/state directory, commonly `.openclaw`.
- Auth-profile secret key directory, commonly `.config/openclaw`.
- Workspace directory used by agents.

The migration script stores them as:

- `config/`
- `auth-profile-secrets/`
- `workspace/`

The restore script maps them to:

- `/data/.openclaw`
- `/data/.config/openclaw`
- `/data/workspace`

## Create An Encrypted Archive

```bash
export MIGRATION_PASSPHRASE='<strong one-time passphrase>'
scripts/package-openclaw-data.sh \
  --config-dir /path/to/.openclaw \
  --secret-dir /path/to/.config/openclaw \
  --workspace-dir /path/to/workspace \
  --output ./migration-out
```

Output:

- `openclaw-migration-YYYYMMDDTHHMMSSZ.tar.gz.enc`
- `openclaw-migration-YYYYMMDDTHHMMSSZ.tar.gz.enc.sha256`

Both files are ignored by git.

## Restore The Archive

Run this in an environment where the Railway-style volume is mounted at `/data`:

```bash
export MIGRATION_PASSPHRASE='<same passphrase>'
scripts/restore-openclaw-data.sh openclaw-migration-YYYYMMDDTHHMMSSZ.tar.gz.enc --data-dir /data
```

The script validates the archive manifest before copying anything.

## After Restore

1. Restart or redeploy OpenClaw.
2. Confirm `/healthz` and `/readyz`.
3. Log into the OpenClaw dashboard.
4. Verify agents, provider auth, channels, and workspace expectations.
5. Delete local plaintext or encrypted migration artifacts unless intentionally retained under a secure backup policy.

## Failure Recovery

If restore was run against the wrong target, stop the service first and inspect the `/data` volume before retrying. The restore script uses `rsync --delete` for exact directory replacement, so a bad restore can remove files in the target OpenClaw state directories.
