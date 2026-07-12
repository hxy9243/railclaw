# Railway Operations

Railclaw uses Railway, but does not replace the Railway CLI. Use the official Railway CLI directly for auth, linking, variables, logs, and restarts. `railclaw deploy` is a narrow app-specific helper for this repo: it creates the OpenClaw service and `/data` volume if missing, sets baseline variables if missing, and then runs `railway up`.

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

Optional production base image override:

```bash
railway variable set OPENCLAW_IMAGE=alpine/openclaw:latest
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

Use the Make target:

```bash
make deploy
```

Or call the helper directly:

```bash
npm run railclaw -- deploy --create-domain
```

Do not use `railway deploy` for this application; Railway documents that command for deploying pre-built templates. Railclaw deploys through `railway up`.

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

- `OPENCLAW_IMAGE` for the Dockerfile.

The default is `alpine/openclaw:latest`, the public mirror of the official OpenClaw image. CI builds with `--pull` so rebuilds pick up the current image. For stricter production repeatability, set `OPENCLAW_IMAGE` to a specific tag or digest, deploy to a non-production environment first when possible, run `railclaw smoke` or `npm run railclaw -- smoke`, and confirm one representative agent flow before promotion.
