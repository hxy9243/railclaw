---
name: openclaw-railway-bootstrap
description: Bootstrap or verify an OpenClaw Railway deployment from this repository. Use when creating a Railway project, choosing the GitHub source repo or fork, configuring GitHub auto-update PR approval and merge, applying Railway IaC, setting non-secret Railway variables, prompting the user to set production secrets themselves, running remote setup through railway ssh, or smoke-testing the deployment.
metadata:
  short-description: Bootstrap OpenClaw on Railway
---

# OpenClaw Railway Bootstrap

Use this checklist when creating or verifying a Railway deployment from this repository. Keep the flow GitHub-source first, Railway IaC driven, and backed by `openclaw-volume` mounted at `/data`.

## 1. Check CLI Access

Run these first. If any command fails, stop and ask the user to install or authenticate the missing CLI.

```bash
command -v railway
railway whoami
command -v gh
gh auth status --active
```

Use `railway login` or `gh auth login` only when needed.

## 2. Choose The Repository

Ask the user which source Railway should deploy:

- Fork this repo: preferred when the user wants independent customizations and updates.
- Use this repo directly: acceptable only when the user owns this repo and wants Railway tied to it.

Set the selected repo before applying Railway IaC:

```bash
export RAILWAY_IAC_PROJECT_NAME='openclaw-railway'
export RAILWAY_GITHUB_REPO='OWNER/REPO'
export RAILWAY_GITHUB_BRANCH='main'
```

## 3. GitHub Auto-Updates

Ask whether to enable automatic dependency/base-image update PR approval and merge. If yes, configure the selected GitHub repo:

```bash
gh repo edit "$RAILWAY_GITHUB_REPO" \
  --enable-auto-merge \
  --enable-squash-merge \
  --delete-branch-on-merge

gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "/repos/$RAILWAY_GITHUB_REPO/actions/permissions/workflow" \
  -f default_workflow_permissions=write \
  -F can_approve_pull_request_reviews=true
```

The repo already contains Dependabot and `.github/workflows/dependabot-automerge.yml`. Required checks should still gate merges on `main`.

## 4. Apply Railway IaC

Preview first, then apply:

```bash
railway config plan
railway config apply
```

Expected Railway resources:

- `openclaw` service sourced from `RAILWAY_GITHUB_REPO`.
- Dockerfile builder with healthcheck `/healthz`.
- `openclaw-volume` mounted at `/data`.
- Public HTTP proxy on port `8080`.

Do not use `railway deploy` for this application; Railway documents that command for deploying pre-built templates.

## 5. Set Non-Secret Railway Variables

```bash
railway variable set OPENCLAW_GATEWAY_PORT=8080 --service openclaw --environment production
railway variable set PORT=8080 --service openclaw --environment production
railway variable set OPENCLAW_DISABLE_BONJOUR=1 --service openclaw --environment production
railway variable set OPENCLAW_GATEWAY_BIND=lan --service openclaw --environment production
railway variable set OPENCLAW_TZ=UTC --service openclaw --environment production
```

Optional production pin:

```bash
railway variable set OPENCLAW_IMAGE=alpine/openclaw:latest --service openclaw --environment production
```

Do not ask the user to paste production secrets into the agent chat or terminal. The user must set secret values directly in Railway after the first bootstrap deploy:

- Required: `OPENCLAW_GATEWAY_TOKEN`.
- Optional providers: `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`.
- Optional channels: `TELEGRAM_BOT_TOKEN`, `DISCORD_TOKEN`, `SLACK_BOT_TOKEN`.

## 6. Finish Setup And Verify

Initialize `/data` through Railway SSH. Replace `DOMAIN` with the deployed Railway or custom domain. The config templates live in the image at `/opt/railclaw/config`.

```bash
DOMAIN='https://YOUR-RAILWAY-DOMAIN.up.railway.app'

railway redeploy --service openclaw --environment production --from-source

railway ssh --service openclaw --environment production /bin/sh <<SH
set -eu
mkdir -p /data/.openclaw /data/.config/openclaw /data/workspace /data/.openclaw-distribution

if [ ! -f /data/.openclaw/openclaw.json ]; then
  sed "s|__DOMAIN__|$DOMAIN|g" \
    /opt/railclaw/config/openclaw.bootstrap.json \
    > /data/.openclaw/openclaw.json
  chmod 600 /data/.openclaw/openclaw.json
fi

sed "s|__UPDATED_AT__|$(date -u +%Y-%m-%dT%H:%M:%SZ)|g" \
  /opt/railclaw/config/openclaw-distribution-state.bootstrap.json \
  > /data/.openclaw-distribution/state.json
chmod 600 /data/.openclaw-distribution/state.json
SH
```

Stop here and prompt the user to set `OPENCLAW_GATEWAY_TOKEN` and any provider/channel secrets directly in Railway. After the user confirms secrets are configured, restart and verify:

```bash
railway restart --service openclaw --environment production
curl --fail --show-error "$DOMAIN/healthz"
curl --fail --show-error "$DOMAIN/readyz"
```

Expected smoke result:

```text
both curl checks return 2xx
```

## Runtime Paths

```text
/data/.openclaw
/data/.config/openclaw
/data/workspace
/home/node/.openclaw -> /data/.openclaw
/home/node/.config/openclaw -> /data/.config/openclaw
```

Do not move these paths without updating the Dockerfile, Railway IaC, docs, validation, and migration tests together.

## Final Checks

- `railway config plan` points at the selected repo and branch.
- Railway variables include non-secret defaults: `OPENCLAW_GATEWAY_PORT=8080`, `PORT=8080`, `OPENCLAW_DISABLE_BONJOUR=1`, `OPENCLAW_GATEWAY_BIND=lan`, and `OPENCLAW_TZ=UTC`.
- The user confirms `OPENCLAW_GATEWAY_TOKEN` and any provider/channel secrets are configured in Railway.
- GitHub Actions include validate, image build, smoke test, Dependabot automerge, and weekly upgrade checks.
- `npm test` passes before shipping template changes.
