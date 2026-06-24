#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
Package existing OpenClaw state into a secure migration archive.

Usage:
  scripts/package-openclaw-data.sh --config-dir DIR --secret-dir DIR --workspace-dir DIR [--output DIR]

Inputs:
  --config-dir DIR     Existing OpenClaw config/state directory, often ~/.openclaw
  --secret-dir DIR     Existing auth-profile secret key directory, often ~/.config/openclaw
  --workspace-dir DIR  Existing OpenClaw workspace directory
  --output DIR         Destination directory for the archive. Default: ./migration-out

Security:
  Set MIGRATION_PASSPHRASE to create an encrypted .tar.gz.enc archive.
  Without MIGRATION_PASSPHRASE, the archive is plaintext and must be handled as a secret.
USAGE
}

config_dir=""
secret_dir=""
workspace_dir=""
output_dir="./migration-out"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --config-dir)
      config_dir="${2:-}"
      shift 2
      ;;
    --secret-dir)
      secret_dir="${2:-}"
      shift 2
      ;;
    --workspace-dir)
      workspace_dir="${2:-}"
      shift 2
      ;;
    --output)
      output_dir="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "unknown argument: $1" >&2
      usage
      exit 2
      ;;
  esac
done

for required in config_dir secret_dir workspace_dir; do
  value="${!required}"
  if [ -z "$value" ]; then
    echo "missing --${required//_/-}" >&2
    usage
    exit 2
  fi
  if [ ! -d "$value" ]; then
    echo "directory does not exist: $value" >&2
    exit 1
  fi
done

umask 077
mkdir -p "$output_dir"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
workdir="$(mktemp -d "${TMPDIR:-/tmp}/openclaw-migration.XXXXXX")"
cleanup() {
  rm -rf "$workdir"
}
trap cleanup EXIT

mkdir -p "$workdir/payload/config" "$workdir/payload/auth-profile-secrets" "$workdir/payload/workspace"

rsync -a --delete \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude 'tmp/' \
  --exclude '*.sock' \
  --exclude '*.pid' \
  "$config_dir"/ "$workdir/payload/config"/

rsync -a --delete \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude 'tmp/' \
  --exclude '*.sock' \
  --exclude '*.pid' \
  "$secret_dir"/ "$workdir/payload/auth-profile-secrets"/

rsync -a --delete \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude '.cache/' \
  --exclude 'tmp/' \
  --exclude '*.sock' \
  --exclude '*.pid' \
  "$workspace_dir"/ "$workdir/payload/workspace"/

cat > "$workdir/payload/MANIFEST.txt" <<EOF
created_utc=$timestamp
format=openclaw-railway-migration-v1
target_config_dir=/data/.openclaw
target_secret_dir=/data/.config/openclaw
target_workspace_dir=/data/workspace
EOF

archive="$output_dir/openclaw-migration-$timestamp.tar.gz"
tar -C "$workdir/payload" -czf "$archive" .
sha256sum "$archive" > "$archive.sha256"

if [ -n "${MIGRATION_PASSPHRASE:-}" ]; then
  encrypted="$archive.enc"
  openssl enc -aes-256-cbc -pbkdf2 -salt \
    -in "$archive" \
    -out "$encrypted" \
    -pass env:MIGRATION_PASSPHRASE
  sha256sum "$encrypted" > "$encrypted.sha256"
  rm -f "$archive" "$archive.sha256"
  echo "created encrypted archive: $encrypted"
  echo "created checksum: $encrypted.sha256"
else
  echo "created plaintext archive: $archive"
  echo "created checksum: $archive.sha256"
  echo "warning: plaintext migration archives contain secrets; delete after restore or store securely" >&2
fi
