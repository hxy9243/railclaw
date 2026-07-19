I want to pivot this repo to a repo syncing with railway deployment.

Users can:

- Fork this repo
- Customize libraries and installations for packages required, like
  - npx skill
  - obsidian-headless
  - playwright chromium
  - github
  - defuddle
  - ...
- Setup dependabot for automatic library upgrades for openclaw
- Tools should be moved to a secondary folder and deprioritized, future plan is for it to manage deployment.

So the plan is to:

- Update dockerfile so that we can take customized pip requirements, npm package etc during image building
- Find a way to eas
- Setup dependabot and github actions cron to update libraries (e.g. every week midnight)


So if possible we'd like the following changes:

- Archive the cli tool, we want to migrate to a web wizard.
- Use the Dockerfile with base image from openclaw, use openclaw's DOCKERFILE ARGS as external packages.
- For now, have an easy
- Setup github actions for cronjobs to update package
- Discard all unnecessary code.
- Simplify the README to document the Quickstart step

Here's the plan:

# OpenClaw Railway Repository: End-to-End Implementation Plan

## 1. Define the Repository as a Reproducible OpenClaw Distribution

The repository should not be only a Dockerfile wrapper.

It should define:

* Which OpenClaw version is deployed, and make it upgradable through dependabot.
* Which system, Node.js, and Python packages are installed, and upgradable through dependabot.
* Which browser dependencies are included.
* Which skills and integrations are available.
* How the instance starts.
* How users initialize and configure it.
* How dependencies are upgraded.
* How deployment health is validated.

The core architecture is:

```text
Git repository
    │
    ├── Build-time configuration
    ├── Dockerfile
    ├── Package manifests
    ├── Setup and diagnostic scripts
    └── GitHub automation
            │
            ▼
       Railway build
            │
            ▼
      Running container
            │
            ├── Persistent /data volume
            ├── OpenClaw runtime
            └── Terminal setup command
```

The first version can finalize setup through the Railway terminal rather than a web wizard.

That significantly reduces the initial implementation scope while preserving a clean upgrade path toward a browser-based setup experience later.

---

## 2. Separate Build-Time, Runtime, and Persistent State

Use three distinct configuration layers.

### Build-time configuration

Stored in Git and baked into the image:

```text
OpenClaw version
System packages
Python packages
Node.js packages
Playwright browsers
Skills and plugins
Startup scripts
Diagnostic utilities
```

### Runtime configuration

Stored in Railway variables:

```text
Ports
Gateway mode
Optional provider API keys
Setup password
Feature flags
Non-persistent environment overrides
```

### Persistent instance state

Stored on a Railway volume:

```text
OpenClaw configuration
Gateway auth token
Workspace files
Obsidian vault
GitHub CLI credentials
OAuth tokens
Setup completion state
Logs or backups where appropriate
```

Recommended volume mount:

```text
/data
```

Suggested paths:

```text
/data/.openclaw
/data/.openclaw-distribution
/data/workspace
/data/workspace/obsidian
/data/backups
```

### Important nuance

Do not write mutable user configuration into the image filesystem.

Any configuration written outside `/data` will disappear when Railway replaces the container.

---

## 3. Recommended Repository Structure

```text
openclaw-railway/
├── Dockerfile
├── railway.toml
├── README.md
├── .env.example
├── package.json
├── package-lock.json
│
├── config/
│   ├── openclaw.defaults.json5
│   ├── distribution.yaml
│   └── profiles/
│       ├── minimal.yaml
│       ├── developer.yaml
│       ├── researcher.yaml
│       └── obsidian.yaml
│
├── extensions/
│   ├── apt.txt
│   ├── pip.txt
│   ├── npm.txt
│   ├── skills.yaml
│   └── browsers.yaml
│
├── deploy/
│   ├── entrypoint.sh
│   ├── bootstrap.sh
│   ├── install-extensions.sh
│   ├── setup.sh
│   ├── doctor.sh
│   ├── migrate.sh
│   ├── backup.sh
│   └── restore.sh
│
├── generated/
│   ├── apt.lock
│   ├── pip.lock
│   ├── npm.lock.json
│   └── skills.lock.json
│
├── tools/
│   ├── README.md
│   ├── deployment/
│   ├── upgrades/
│   └── migration/
│
└── .github/
    ├── dependabot.yml
    └── workflows/
        ├── validate.yml
        ├── build.yml
        ├── smoke-test.yml
        ├── weekly-upgrade.yml
        └── release.yml
```

Use this distinction:

```text
deploy/     Required for image build and runtime
tools/      Optional operator and future deployment-management utilities
extensions/ User-customizable software composition
config/     Distribution defaults and profiles
generated/  Resolved versions and lock data
```

### Important nuance

Do not move required entrypoint and bootstrap code into `tools/`.

Anything required for the container to start belongs under `deploy/`.

---

## 4. Provide One High-Level Distribution Configuration

Users should not need to edit five unrelated dependency files unless they want advanced control.

Provide a single high-level file:

```yaml
# config/distribution.yaml

openclaw:
  version: "pinned-version"

profile: developer

system:
  packages:
    - git
    - curl
    - jq
    - gh

python:
  packages:
    - obsidian-headless
    - defuddle

node:
  globalPackages:
    - some-npx-skill-package

browser:
  playwright: true
  chromium: true

features:
  github: true
  obsidian: true
  browserAutomation: true

skills:
  - name: github
    source: npm
    package: example-package

  - name: custom-skill
    source: git
    repository: https://github.com/example/custom-skill
    ref: v1.0.0
```

A generation script can translate this file into:

```text
extensions/apt.txt
extensions/pip.txt
extensions/npm.txt
generated/skills.lock.json
```

Alternatively, the repository may initially treat the individual extension files as the source of truth and add `distribution.yaml` later.

### Recommended MVP

Start with the simpler files:

```text
extensions/apt.txt
extensions/pip.txt
extensions/npm.txt
```

Add the higher-level generator only after the base build is stable.

---

## 5. Design the Dockerfile as an Extension Layer

The Dockerfile should:

1. Start from a pinned OpenClaw image or supported Node.js base.
2. Install system dependencies.
3. Install Python dependencies.
4. Install Node.js tools.
5. Install Playwright Chromium when enabled.
6. Copy setup and runtime scripts.
7. Create expected directories.
8. Run as a non-root user.
9. Start through a stable entrypoint.

Conceptual Dockerfile:

```dockerfile
ARG OPENCLAW_IMAGE=ghcr.io/example/openclaw:PINNED_VERSION
FROM ${OPENCLAW_IMAGE}

USER root

COPY extensions/apt.txt /tmp/openclaw-extensions/apt.txt
COPY extensions/pip.txt /tmp/openclaw-extensions/pip.txt
COPY extensions/npm.txt /tmp/openclaw-extensions/npm.txt

COPY deploy/install-extensions.sh /usr/local/bin/install-extensions
RUN chmod +x /usr/local/bin/install-extensions \
    && /usr/local/bin/install-extensions

COPY deploy/ /opt/openclaw-deploy/
COPY config/openclaw.defaults.json5 /opt/openclaw-defaults/openclaw.json5

RUN chmod +x /opt/openclaw-deploy/*.sh \
    && mkdir -p /data \
    && chown -R node:node \
        /opt/openclaw-deploy \
        /opt/openclaw-defaults \
        /data

USER node

ENV OPENCLAW_STATE_DIR=/data/.openclaw
ENV OPENCLAW_WORKSPACE_DIR=/data/workspace
ENV OPENCLAW_DISTRIBUTION_DIR=/data/.openclaw-distribution
ENV OPENCLAW_GATEWAY_PORT=8080

ENTRYPOINT ["/usr/bin/tini", "--", "/opt/openclaw-deploy/entrypoint.sh"]
```

### Important nuance

Pin the base image by version or digest.

Avoid:

```dockerfile
FROM openclaw:latest
```

A rebuild should not unexpectedly upgrade the entire runtime.

---

## 6. Implement a Reliable Extension Installer

The extension installer should support:

```text
apt packages
pip packages
npm packages
Playwright Chromium
Optional skill installation
```

Example responsibilities:

```text
Read manifest
Ignore comments and blank lines
Validate package names
Install exact versions where specified
Fail clearly on installation errors
Print installed versions
Generate a build manifest
Remove package-manager caches
```

Example input:

```text
# extensions/pip.txt
obsidian-headless==1.2.3
defuddle==0.8.1
```

```text
# extensions/npm.txt
package-a@1.4.0
package-b@3.2.1
```

### Important nuance

Avoid installing unpinned packages during every Docker build.

This:

```text
obsidian-headless
```

can resolve differently each time.

Prefer:

```text
obsidian-headless==1.2.3
```

Use scheduled automation to propose upgrades rather than resolving `latest` during deployment.

---

## 7. Decide How Node.js Tools Are Installed

Node.js dependencies fall into three categories.

### Runtime application dependencies

Installed through the repository's `package.json`:

```text
fastify
proxy libraries
validation libraries
setup CLI dependencies
```

### User-facing command-line tools

Installed globally only when necessary:

```text
npx-based skill launchers
CLI utilities
agent tools
```

### OpenClaw skills or plugins

Installed into a dedicated location:

```text
/opt/openclaw-skills
/data/.openclaw/skills
```

### Important nuance

Do not place every Node.js tool in the global npm namespace.

Global installation makes version ownership and dependency resolution less transparent.

Prefer local package execution where practical:

```text
npx --no-install package-name
```

or:

```text
node_modules/.bin/package-name
```

---

## 8. Install Playwright Browsers at Build Time

If Chromium is required, install it into the image.

Do not download Chromium during every container startup.

Example build sequence:

```text
npm install playwright
npx playwright install --with-deps chromium
```

The browser cache must live in a path readable by the runtime user.

Possible environment variable:

```text
PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
```

Ensure ownership is correct before switching back to the non-root user.

### Important nuance

Browser installation can significantly increase image size.

Make Chromium optional through a build argument or distribution profile:

```dockerfile
ARG INSTALL_CHROMIUM=false
```

The default minimal image should not include it unless browser automation is a core requirement.

---

## 9. Implement a Safe Runtime Entrypoint

The entrypoint should prepare persistent state and start OpenClaw.

Recommended flow:

```text
Validate environment
        ↓
Ensure /data is mounted and writable
        ↓
Create persistent directories
        ↓
Initialize defaults only if config is absent
        ↓
Run schema or distribution migrations
        ↓
Print setup state
        ↓
Start OpenClaw
```

Conceptual script:

```bash
#!/usr/bin/env bash
set -euo pipefail

STATE_DIR="${OPENCLAW_STATE_DIR:-/data/.openclaw}"
WORKSPACE_DIR="${OPENCLAW_WORKSPACE_DIR:-/data/workspace}"
DIST_DIR="${OPENCLAW_DISTRIBUTION_DIR:-/data/.openclaw-distribution}"

mkdir -p "$STATE_DIR" "$WORKSPACE_DIR" "$DIST_DIR"

if [ ! -w /data ]; then
  echo "ERROR: /data is not writable"
  exit 1
fi

if [ ! -f "$STATE_DIR/openclaw.json" ]; then
  /opt/openclaw-deploy/bootstrap.sh
fi

/opt/openclaw-deploy/migrate.sh

exec openclaw gateway \
  --bind 0.0.0.0 \
  --port "${PORT:-8080}"
```

### Important nuance

Only initialize defaults when the user configuration does not exist.

Never overwrite the existing OpenClaw config on every startup.

---

## 10. Bootstrap Defaults Without Taking Ownership of User State

On first boot, `bootstrap.sh` should:

* Create the OpenClaw state directory.
* Copy a minimal default config.
* Create the workspace.
* Create distribution metadata.
* Mark the deployment as requiring setup.
* Avoid generating secrets unless explicitly intended.

Example metadata:

```json
{
  "distributionVersion": "0.1.0",
  "schemaVersion": 1,
  "initialized": true,
  "setupCompleted": false
}
```

Suggested path:

```text
/data/.openclaw-distribution/state.json
```

### Important nuance

Distribution metadata and OpenClaw configuration should remain separate.

This prevents your deployment wrapper from polluting or tightly coupling itself to OpenClaw’s internal config schema.

---

## 13. Use OpenClaw CLI Commands for Configuration, Document and Reference Openclaw

The setup command should rely on OpenClaw’s own CLI where possible:

```text
openclaw config file
openclaw config validate --json
openclaw config patch --stdin --dry-run
openclaw config patch --stdin
openclaw status --json
openclaw health
```

Recommended config flow:

```text
Collect setup answers
        ↓
Build known config patch
        ↓
Dry-run validation
        ↓
Apply patch
        ↓
Wait for reload
        ↓
Check health
```

Avoid manually rewriting JSON5 unless the OpenClaw CLI cannot support the needed operation.

### Important nuance

Never construct shell commands by string concatenation.

Use:

```js
spawn("openclaw", ["config", "patch", "--stdin"])
```

not:

```js
exec(`openclaw config set ${path} ${value}`)
```


## 19. Set Up Dependabot

Dependabot should monitor:

```text
Docker base image
npm dependencies
pip dependencies
GitHub Actions
```

Example structure:

```yaml
version: 2

updates:
  - package-ecosystem: docker
    directory: "/"
    schedule:
      interval: weekly

  - package-ecosystem: npm
    directory: "/"
    schedule:
      interval: weekly

  - package-ecosystem: pip
    directory: "/"
    schedule:
      interval: weekly

  - package-ecosystem: github-actions
    directory: "/"
    schedule:
      interval: weekly
```

Group related dependency updates to avoid excessive PR noise.

Suggested policy:

```text
Patch updates:
  eligible for auto-merge after tests

Minor updates:
  PR with manual review

Major updates:
  manual review only

Security updates:
  fast-track if tests pass
```

### Important nuance

OpenClaw upgrades should be handled more conservatively than ordinary libraries.

Treat OpenClaw itself as a runtime platform dependency.

---

## 20. Add a Weekly Upgrade Workflow

Dependabot is good for standard ecosystems, but custom skills and OpenClaw releases may need a dedicated workflow.

The weekly workflow should:

```text
Check latest supported OpenClaw release
Check skill versions
Regenerate lock data
Build image
Run smoke tests
Open update PR
```

PR description should include:

```text
Old and new OpenClaw versions
Changed system packages
Changed Python packages
Changed Node.js packages
Skill updates
Image-size change
Smoke-test results
Migration warnings
```

Do not directly deploy untested weekly updates.

Recommended flow:

```text
Scheduled check
    ↓
Update branch
    ↓
Build
    ↓
Smoke test
    ↓
Pull request
    ↓
Merge
    ↓
Railway deploy
```

---

## 21. Add Build and Smoke-Test Workflows

Every pull request should run:

```text
Manifest validation
Docker build
Package installation verification
OpenClaw version check
CLI setup command check
Config validation
Gateway startup
Health probe
Optional Chromium smoke test
```

Example checks:

```text
openclaw --version
openclaw-railway doctor
openclaw config validate --json
openclaw health
gh --version
python -c "import expected_package"
node -e "require('expected-package')"
```

For Chromium:

```text
Launch browser
Open a local page
Take a screenshot or verify page title
Exit cleanly
```

### Important nuance

Tests should run against a fresh empty `/data` directory and against an existing initialized state.

Both first boot and upgrade paths matter.

---

