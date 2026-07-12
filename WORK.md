# Work Summary

Implemented the MVP repository pivot from a deploy helper toward a reproducible OpenClaw Railway distribution.

## Implemented

- Added manifest-driven image customization:
  - `extensions/apt.txt`
  - `extensions/npm.txt`
  - `extensions/pip.txt`
  - `extensions/browsers.yaml`
  - `extensions/skills.yaml`
  - `deploy/install-extensions.sh`
- Updated `Dockerfile` and `Makefile` so the default image reads extension manifests and still supports Railway build-arg overrides.
- Added build manifest generation at `/opt/openclaw-manifests/build-manifest.json`.
- Added persistent distribution state under `/data/.openclaw-distribution/state.json`.
- Added `openclaw-railway` as a command alias for the existing runtime CLI.
- Added `setup` and `status` commands for terminal-based initialization.
- Updated `doctor` to include persistent setup status.
- Added Dependabot and GitHub Actions workflows for validation, Docker builds, and weekly upgrade checks.
- Simplified `README.md` around the fork/customize/deploy/setup user journey.
- Added `config/distribution.yaml`, `tools/README.md`, and `AGENTS.md`.

## Engineering Judgment

- Did not delete or physically move the current CLI implementation because the Docker image still uses it for setup, diagnostics, migration, and deploy helpers.
- Kept `railclaw` working while adding `openclaw-railway` as the user-facing alias.
- Kept individual extension files as the source of truth for the MVP, with `config/distribution.yaml` documenting the intended higher-level distribution shape.
- Did not add automatic destructive backup/restore behavior on startup; backup remains an explicit future feature.

## Validation

Ran:

```bash
npm test
npm run check
git diff --check
```

All checks passed after each implementation stage.
