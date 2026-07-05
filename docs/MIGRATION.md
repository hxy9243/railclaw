# Migration Guide

`railclaw migrate` is the unified migration path. From this repo, run it as `npm run railclaw -- migrate`. It migrates OpenClaw config, state, provider/channel auth, auth-profile secret material, and workspace data together by default.

## What Gets Migrated

Source directories:

- OpenClaw config/state directory, commonly `~/.openclaw`.
- OpenClaw auth-profile secret directory, commonly `~/.config/openclaw`.
- Workspace directory used by agents.

Archive directories:

- `config/`
- `auth-profile-secrets/`
- `workspace/`

Restore targets:

- `/data/.openclaw`
- `/data/.config/openclaw`
- `/data/workspace`

The restore preserves the source layout. It does not generate an equivalent fresh config.

## Package

Migration archives contain secrets. Use encryption:

```bash
export MIGRATION_PASSPHRASE='<strong one-time passphrase>'
npm run railclaw -- migrate --mode package \
  --config-dir ~/.openclaw \
  --secret-dir ~/.config/openclaw \
  --workspace-dir /path/to/workspace \
  --output ./migration-out
```

Output:

- `railclaw-migration-YYYYMMDDTHHMMSSZ.tar.gz.enc`
- `railclaw-migration-YYYYMMDDTHHMMSSZ.tar.gz.enc.sha256`

If `MIGRATION_PASSPHRASE` is not set, Railclaw asks before creating a plaintext archive.

## Restore

Run restore where the target Railway-style volume is mounted:

```bash
export MIGRATION_PASSPHRASE='<same passphrase>'
npm run railclaw -- migrate --mode restore \
  --archive ./migration-out/railclaw-migration-YYYYMMDDTHHMMSSZ.tar.gz.enc \
  --data-dir /data \
  --yes
```

Restore replaces:

- `/data/.openclaw`
- `/data/.config/openclaw`
- `/data/workspace`

The replacement is intentional and destructive. Omit `--yes` to make Railclaw refuse replacement when target directories already exist.

## Railway Flow

1. Create or attach a Railway volume mounted at `/data`.
2. Upload the migration archive using Railway volume file tools or another secure path.
3. Restore the archive in an environment with `/data` mounted.
4. Restart or redeploy:

```bash
railway restart
# or
railway up
```

5. Verify:

```bash
npm run railclaw -- migrate --mode verify --data-dir /data
npm run railclaw -- smoke https://YOUR-RAILWAY-DOMAIN.up.railway.app
```

After a successful restore and normal Railway restart/deploy, the OpenClaw instance should be live and operational with the same config, provider auth, auth-profile secret material, and workspace as the source.
