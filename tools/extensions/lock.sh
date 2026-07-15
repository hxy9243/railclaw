#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
extension_dir="$repo_root/extensions"
cd "$repo_root"

npm install \
  --ignore-scripts \
  --package-lock-only \
  --prefix extensions

python3 -m piptools compile \
  --no-emit-index-url \
  --no-emit-options \
  --output-file extensions/requirements.txt \
  --quiet \
  --strip-extras \
  extensions/requirements.in
