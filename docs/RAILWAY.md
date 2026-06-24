# Railway Operations

## Required Service Setup

- Builder: Dockerfile.
- Volume mount: `/data`.
- Healthcheck: `/healthz`.
- Public port: Railway-provided `$PORT`.

The included `railway.json` configures Dockerfile build and healthcheck. Volume attachment and secret variables are configured in Railway.

## Required Variables

```dotenv
OPENCLAW_GATEWAY_TOKEN=<long-random-token>
OPENCLAW_DISABLE_BONJOUR=1
OPENCLAW_GATEWAY_BIND=lan
OPENCLAW_TZ=UTC
```

Optional production build pin:

```dotenv
OPENCLAW_IMAGE=ghcr.io/openclaw/openclaw:2026.6.10
```

Add provider and channel credentials in Railway variables only.

## Runtime Paths

```text
/data/.openclaw
/data/.config/openclaw
/data/workspace
```

Do not move those paths without updating Dockerfile, docs, validation, and migration scripts together.

## Smoke Test

```bash
scripts/smoke-test.sh https://YOUR-RAILWAY-DOMAIN.up.railway.app
```

Expected result:

```text
checking https://YOUR-RAILWAY-DOMAIN.up.railway.app/healthz
checking https://YOUR-RAILWAY-DOMAIN.up.railway.app/readyz
smoke-test: ok
```

## Updating OpenClaw

For controlled updates:

1. Change the Railway build arg `OPENCLAW_IMAGE` to a newer fixed tag.
2. Deploy to a non-production environment first when possible.
3. Run smoke tests.
4. Confirm dashboard login and one representative agent flow.
5. Promote the same pinned image tag to production.

Using `latest` trades repeatability for automatic upstream updates.
