#!/usr/bin/env bash
set -euo pipefail

EXTENSION_DIR="${EXTENSION_DIR:-/tmp/openclaw-extensions}"
MANIFEST_DIR="${MANIFEST_DIR:-/opt/openclaw-manifests}"
BUILD_MANIFEST="${BUILD_MANIFEST:-/opt/openclaw-manifests/build-manifest.json}"
OPENCLAW_NPM_PACKAGE="${OPENCLAW_NPM_PACKAGE:-openclaw@2026.6.10}"
EXTRA_APT_PACKAGES="${EXTRA_APT_PACKAGES:-}"
EXTRA_NPM_PACKAGES="${EXTRA_NPM_PACKAGES:-}"
EXTRA_PIP_PACKAGES="${EXTRA_PIP_PACKAGES:-}"
INSTALL_PLAYWRIGHT_BROWSERS="${INSTALL_PLAYWRIGHT_BROWSERS:-1}"

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

apt_packages="$(read_manifest "$EXTENSION_DIR/apt.txt" | join_lines_and_words) ${EXTRA_APT_PACKAGES}"
npm_packages="${OPENCLAW_NPM_PACKAGE} $(read_manifest "$EXTENSION_DIR/npm.txt" | join_lines_and_words) ${EXTRA_NPM_PACKAGES}"
pip_packages="$(read_manifest "$EXTENSION_DIR/pip.txt" | join_lines_and_words) ${EXTRA_PIP_PACKAGES}"
pip_requirements="$EXTENSION_DIR/requirements.txt"

if [ -n "$(echo "$apt_packages" | xargs)" ]; then
  apt-get update
  apt-get install -y --no-install-recommends $apt_packages
  rm -rf /var/lib/apt/lists/*
fi

if [ -n "$(echo "$npm_packages" | xargs)" ]; then
  npm install -g $npm_packages
  npm cache clean --force
fi

if [ -f "$pip_requirements" ]; then
  python3 -m pip install --break-system-packages -r "$pip_requirements"
fi

if [ -n "$(echo "$pip_packages" | xargs)" ]; then
  python3 -m pip install --break-system-packages $pip_packages
fi

if [ "$INSTALL_PLAYWRIGHT_BROWSERS" = "1" ]; then
  npx playwright install --with-deps chromium
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

const dir = process.env.EXTENSION_DIR || '/tmp/openclaw-extensions';
const manifest = {
  generatedAt: new Date().toISOString(),
  openclawPackage: process.env.OPENCLAW_NPM_PACKAGE || 'openclaw@2026.6.10',
  installPlaywrightBrowsers: process.env.INSTALL_PLAYWRIGHT_BROWSERS || '1',
  manifests: {
    apt: lines(`${dir}/apt.txt`),
    npm: lines(`${dir}/npm.txt`),
    pip: lines(`${dir}/pip.txt`),
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
