#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
workdir="$(mktemp -d "${TMPDIR:-/tmp}/openclaw-deploy-test.XXXXXX")"

cleanup() {
  rm -rf "$workdir"
}
trap cleanup EXIT

mkdir -p \
  "$workdir/source/config/agents/default/agent" \
  "$workdir/source/secrets" \
  "$workdir/source/workspace/project" \
  "$workdir/output" \
  "$workdir/data"

printf '%s\n' '{"gateway":{"mode":"local"}}' > "$workdir/source/config/openclaw.json"
printf '%s\n' '{"profiles":[]}' > "$workdir/source/config/agents/default/agent/auth-profiles.json"
printf '%s\n' 'fake-secret-key-material' > "$workdir/source/secrets/key"
printf '%s\n' 'workspace file' > "$workdir/source/workspace/project/README.md"

MIGRATION_PASSPHRASE='test-passphrase-only' \
  "$repo_root/scripts/package-openclaw-data.sh" \
    --config-dir "$workdir/source/config" \
    --secret-dir "$workdir/source/secrets" \
    --workspace-dir "$workdir/source/workspace" \
    --output "$workdir/output" >/dev/null

archive="$(find "$workdir/output" -name 'openclaw-migration-*.tar.gz.enc' -print -quit)"
[ -n "$archive" ] || {
  echo "encrypted migration archive was not created" >&2
  exit 1
}

MIGRATION_PASSPHRASE='test-passphrase-only' \
  "$repo_root/scripts/restore-openclaw-data.sh" "$archive" --data-dir "$workdir/data" >/dev/null

cmp "$workdir/source/config/openclaw.json" "$workdir/data/.openclaw/openclaw.json"
cmp "$workdir/source/config/agents/default/agent/auth-profiles.json" "$workdir/data/.openclaw/agents/default/agent/auth-profiles.json"
cmp "$workdir/source/secrets/key" "$workdir/data/.config/openclaw/key"
cmp "$workdir/source/workspace/project/README.md" "$workdir/data/workspace/project/README.md"

echo "migration-smoke: ok"
