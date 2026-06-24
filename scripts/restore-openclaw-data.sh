#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
Restore an OpenClaw migration archive into a Railway-style /data volume.

Usage:
  scripts/restore-openclaw-data.sh ARCHIVE [--data-dir DIR]

Inputs:
  ARCHIVE          .tar.gz or .tar.gz.enc archive from package-openclaw-data.sh
  --data-dir DIR   Mounted persistent data directory. Default: /data

Security:
  Set MIGRATION_PASSPHRASE when restoring an encrypted .enc archive.
  The script refuses to restore unless the archive has the expected manifest.
USAGE
}

archive=""
data_dir="/data"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --data-dir)
      data_dir="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [ -z "$archive" ]; then
        archive="$1"
        shift
      else
        echo "unknown argument: $1" >&2
        usage
        exit 2
      fi
      ;;
  esac
done

if [ -z "$archive" ]; then
  usage
  exit 2
fi

if [ ! -f "$archive" ]; then
  echo "archive not found: $archive" >&2
  exit 1
fi

umask 077
mkdir -p "$data_dir"

workdir="$(mktemp -d "${TMPDIR:-/tmp}/openclaw-restore.XXXXXX")"
cleanup() {
  rm -rf "$workdir"
}
trap cleanup EXIT

payload="$workdir/payload.tar.gz"
case "$archive" in
  *.enc)
    if [ -z "${MIGRATION_PASSPHRASE:-}" ]; then
      echo "MIGRATION_PASSPHRASE is required for encrypted archives" >&2
      exit 1
    fi
    openssl enc -d -aes-256-cbc -pbkdf2 \
      -in "$archive" \
      -out "$payload" \
      -pass env:MIGRATION_PASSPHRASE
    ;;
  *)
    cp "$archive" "$payload"
    ;;
esac

mkdir -p "$workdir/extract"
tar -C "$workdir/extract" -xzf "$payload"

manifest="$workdir/extract/MANIFEST.txt"
if [ ! -f "$manifest" ] || ! grep -q '^format=openclaw-railway-migration-v1$' "$manifest"; then
  echo "archive manifest is missing or not recognized" >&2
  exit 1
fi

for required in config auth-profile-secrets workspace; do
  if [ ! -d "$workdir/extract/$required" ]; then
    echo "archive is missing directory: $required" >&2
    exit 1
  fi
done

mkdir -p "$data_dir/.openclaw" "$data_dir/.config/openclaw" "$data_dir/workspace"

rsync -a --delete "$workdir/extract/config"/ "$data_dir/.openclaw"/
rsync -a --delete "$workdir/extract/auth-profile-secrets"/ "$data_dir/.config/openclaw"/
rsync -a --delete "$workdir/extract/workspace"/ "$data_dir/workspace"/

if id node >/dev/null 2>&1; then
  chown -R node:node "$data_dir/.openclaw" "$data_dir/.config/openclaw" "$data_dir/workspace" || true
fi

echo "restored OpenClaw data into $data_dir"
