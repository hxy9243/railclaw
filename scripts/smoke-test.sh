#!/usr/bin/env bash
set -euo pipefail

base_url="${1:-http://127.0.0.1:${PORT:-8080}}"

echo "checking $base_url/healthz"
curl -fsS "$base_url/healthz" >/dev/null

echo "checking $base_url/readyz"
curl -fsS "$base_url/readyz" >/dev/null

echo "smoke-test: ok"
