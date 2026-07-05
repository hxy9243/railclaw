# Railway Operations

Railclaw uses Railway, but does not wrap Railway lifecycle commands. Use the official Railway CLI directly for auth, linking, variables, volumes, deploys, logs, and restarts.

Official CLI docs: https://docs.railway.com/cli

## Required Service Setup

- Builder: Dockerfile.
- Volume mount: `/data`.
- Healthcheck: `/healthz`.
- Public Networking HTTP Proxy port: `8080`.

The included `railway.json` configures Dockerfile build and healthcheck. Volume attachment, volume resizing, domains, and secrets are configured through Railway.

## Required Variables

```bash
railway variable set OPENCLAW_GATEWAY_TOKEN="$(npm run --silent railclaw -- token)"
railway variable set OPENCLAW_GATEWAY_PORT=8080
railway variable set OPENCLAW_DISABLE_BONJOUR=1
railway variable set OPENCLAW_GATEWAY_BIND=lan
railway variable set OPENCLAW_TZ=UTC
```

Optional production build pin:

```bash
railway variable set OPENCLAW_NPM_PACKAGE=openclaw@2026.6.10
```

Provider/channel credentials should also be Railway variables. Use:

```bash
npm run railclaw -- providers configure
```

Then run the printed `railway variable set ...` commands yourself.

## Runtime Paths

```text
/data/.openclaw
/data/.config/openclaw
/data/workspace
/home/node/.openclaw -> /data/.openclaw
/home/node/.config/openclaw -> /data/.config/openclaw
```

Do not move those paths without updating Dockerfiles, docs, validation, and migration tests together.

## Deploy

Use `railway up` for this repo’s code:

```bash
railway up
```

Do not use `railway deploy` for this application; Railway documents that command for deploying pre-built templates.

## Smoke Test

```bash
npm run railclaw -- smoke https://YOUR-RAILWAY-DOMAIN.up.railway.app
```

Expected result:

```text
checking https://YOUR-RAILWAY-DOMAIN.up.railway.app/healthz
checking https://YOUR-RAILWAY-DOMAIN.up.railway.app/readyz
smoke: ok
```

## Updating OpenClaw

For controlled updates, pin:

- `OPENCLAW_NPM_PACKAGE` for the default Dockerfile.
- `OPENCLAW_IMAGE` if using `Dockerfile.official-image`.

Deploy to a non-production environment first when possible, run `railclaw smoke` or `npm run railclaw -- smoke`, and confirm one representative agent flow before promotion.
