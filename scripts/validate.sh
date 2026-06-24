#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

fail() {
  echo "validate: $*" >&2
  exit 1
}

need_file() {
  [ -f "$1" ] || fail "missing required file: $1"
}

need_file Dockerfile
need_file railway.json
need_file .env.example
need_file config/openclaw.example.json
need_file scripts/package-openclaw-data.sh
need_file scripts/restore-openclaw-data.sh
need_file scripts/smoke-test.sh
need_file test/migration-smoke.sh
need_file README.md
need_file INSTRUCTION.md

python3 -m json.tool railway.json >/dev/null
python3 -m json.tool config/openclaw.example.json >/dev/null

grep -q 'FROM ${OPENCLAW_IMAGE}' Dockerfile || fail "Dockerfile must inherit the configured official OpenClaw image"
grep -q 'OPENCLAW_CONFIG_DIR=/data/.openclaw' Dockerfile || fail "Dockerfile must pin config to /data"
grep -q 'OPENCLAW_WORKSPACE_DIR=/data/workspace' Dockerfile || fail "Dockerfile must pin workspace to /data"
grep -q '"healthcheckPath": "/healthz"' railway.json || fail "Railway healthcheck must use /healthz"

if git ls-files | grep -E '(^|/)(\.env|data|state|workspace|migration-out|.*\.tar(\.gz)?(\.enc)?)$' >/dev/null; then
  fail "secret/state artifacts are tracked by git"
fi

home_pattern="$(printf '%s' "${HOME:-}" | sed 's/[.[\*^$()+?{|]/\\&/g')"
secret_pattern='(OPENCLAW_GATEWAY_TOKEN=[A-Za-z0-9+/=]{20,}|sk-[A-Za-z0-9_-]{20,})'
if [ -n "$home_pattern" ]; then
  scan_pattern="(${home_pattern}|${secret_pattern})"
else
  scan_pattern="$secret_pattern"
fi

if git ls-files -z | xargs -0 grep -InE "$scan_pattern" -- 2>/dev/null; then
  fail "tracked files appear to contain personal paths or secret-looking values"
fi

bash -n scripts/*.sh
bash -n test/*.sh

echo "validate: ok"
