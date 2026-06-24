#!/usr/bin/env bash
set -euo pipefail

bytes="${1:-48}"

if ! [[ "$bytes" =~ ^[0-9]+$ ]] || [ "$bytes" -lt 32 ]; then
  echo "usage: $0 [bytes>=32]" >&2
  exit 2
fi

openssl rand -base64 "$bytes"
