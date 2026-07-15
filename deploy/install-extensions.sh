#!/usr/bin/env bash
set -euo pipefail

EXTENSION_DIR="${EXTENSION_DIR:-/tmp/openclaw-extensions}"
NPM_GLOBAL_PREFIX="${NPM_GLOBAL_PREFIX:-/opt/openclaw-extensions}"
NPM_EXTENSION_DIR="$NPM_GLOBAL_PREFIX/lib"
MANIFEST_DIR="${MANIFEST_DIR:-/opt/openclaw-manifests}"
BUILD_MANIFEST="${BUILD_MANIFEST:-/opt/openclaw-manifests/build-manifest.json}"
OPENCLAW_VERSION="${OPENCLAW_VERSION:-latest}"
OPENCLAW_INSTALL_BROWSER="${OPENCLAW_INSTALL_BROWSER:-1}"
EXTRA_APT_PACKAGES="${EXTRA_APT_PACKAGES:-}"
EXTRA_NPM_PACKAGES="${EXTRA_NPM_PACKAGES:-}"
EXTRA_PIP_PACKAGES="${EXTRA_PIP_PACKAGES:-}"
INSTALL_PLAYWRIGHT_BROWSERS="${INSTALL_PLAYWRIGHT_BROWSERS:-$OPENCLAW_INSTALL_BROWSER}"

read_manifest() {
  local file="$1"
  if [ ! -f "$file" ]; then
    return 0
  fi
  sed -e 's/[[:space:]]*#.*$//' -e '/^[[:space:]]*$/d' "$file"
}

join_lines_and_words() {
  tr '\n' ' ' | xargs echo "$@"
}

is_truthy() {
  case "${1:-}" in
    1|true|TRUE|yes|YES|on|ON) return 0 ;;
    *) return 1 ;;
  esac
}

apt_packages="$(read_manifest "$EXTENSION_DIR/apt.txt" | join_lines_and_words) ${EXTRA_APT_PACKAGES}"
pip_requirements="$EXTENSION_DIR/requirements.txt"

if [ -n "$(echo "$apt_packages" | xargs)" ]; then
  apt-get update
  apt-get install -y --no-install-recommends $apt_packages
  rm -rf /var/lib/apt/lists/*
fi

if [ -f "$EXTENSION_DIR/package.json" ]; then
  mkdir -p "$NPM_EXTENSION_DIR" "$NPM_GLOBAL_PREFIX/bin"
  cp "$EXTENSION_DIR/package.json" "$EXTENSION_DIR/package-lock.json" "$NPM_EXTENSION_DIR/"
  npm ci --omit=dev --prefix "$NPM_EXTENSION_DIR"
  for executable in "$NPM_EXTENSION_DIR/node_modules/.bin/"*; do
    [ -e "$executable" ] || continue
    ln -sf "$(readlink -f "$executable")" "$NPM_GLOBAL_PREFIX/bin/$(basename "$executable")"
  done
  npm cache clean --force
fi

# Build args remain available as a deliberately unlocked development escape
# hatch. Production extensions belong in the locked manifests above.
if [ -n "$(echo "$EXTRA_NPM_PACKAGES" | xargs)" ]; then
  npm install -g $EXTRA_NPM_PACKAGES
  npm cache clean --force
fi

if [ -f "$pip_requirements" ]; then
  python3 -m pip install --break-system-packages -r "$pip_requirements"
fi

if [ -n "$(echo "$EXTRA_PIP_PACKAGES" | xargs)" ]; then
  python3 -m pip install --break-system-packages $EXTRA_PIP_PACKAGES
fi

if is_truthy "$INSTALL_PLAYWRIGHT_BROWSERS"; then
  apt-get update
  apt-get install -y --no-install-recommends xvfb
  rm -rf /var/lib/apt/lists/*
  if [ -f "$NPM_EXTENSION_DIR/node_modules/playwright/cli.js" ]; then
    node "$NPM_EXTENSION_DIR/node_modules/playwright/cli.js" install --with-deps chromium
  else
    echo "playwright must be present in extensions/package.json" >&2
    exit 1
  fi
fi

mkdir -p "$MANIFEST_DIR"
node > "$BUILD_MANIFEST" <<'NODE'
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

function lines(file) {
  try {
    return fs.readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.replace(/\s*#.*$/, '').trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function version(command, args) {
  try {
    return execFileSync(command, args, { encoding: 'utf8' }).trim().split('\n')[0];
  } catch {
    return null;
  }
}

function npmDependencies(file) {
  try {
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Object.entries(json.dependencies || {}).map(([name, spec]) => `${name}@${spec}`);
  } catch {
    return [];
  }
}

const dir = process.env.EXTENSION_DIR || '/tmp/openclaw-extensions';
const manifest = {
  generatedAt: new Date().toISOString(),
  openclawPackage: `openclaw@${process.env.OPENCLAW_VERSION || 'latest'}`,
  installPlaywrightBrowsers: process.env.INSTALL_PLAYWRIGHT_BROWSERS || process.env.OPENCLAW_INSTALL_BROWSER || '1',
  manifests: {
    apt: lines(`${dir}/apt.txt`),
    npm: npmDependencies(`${dir}/package.json`),
    pythonRequirements: lines(`${dir}/requirements.txt`),
  },
  extra: {
    apt: process.env.EXTRA_APT_PACKAGES || '',
    npm: process.env.EXTRA_NPM_PACKAGES || '',
    pip: process.env.EXTRA_PIP_PACKAGES || '',
  },
  versions: {
    node: version('node', ['--version']),
    npm: version('npm', ['--version']),
    openclaw: version('openclaw', ['--version']),
    python: version('python3', ['--version']),
  },
};

process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
NODE
