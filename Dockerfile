# syntax=docker/dockerfile:1.7
#
# Railway deploy image for OpenClaw.
#
# The official OpenClaw image is intentionally used as the base so runtime
# behavior stays aligned with upstream releases. Pin OPENCLAW_IMAGE in Railway
# for repeatable deploys, for example:
# ghcr.io/openclaw/openclaw:2026.6.10
ARG OPENCLAW_IMAGE=ghcr.io/openclaw/openclaw:latest
FROM ${OPENCLAW_IMAGE}

USER root

ARG DEBIAN_FRONTEND=noninteractive
ARG EXTRA_APT_PACKAGES="bash ca-certificates coreutils curl dumb-init findutils git git-lfs gnupg jq less nano openssh-client procps python3 python3-pip python3-venv ripgrep rsync sqlite3 tar tini unzip vim wget xz-utils zip"
ARG EXTRA_NPM_PACKAGES="@openai/codex @anthropic-ai/claude-code @google/gemini-cli obsidian-cli playwright"
ARG EXTRA_PIP_PACKAGES=""
ARG INSTALL_PLAYWRIGHT_BROWSERS=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends ${EXTRA_APT_PACKAGES} \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g ${EXTRA_NPM_PACKAGES}

RUN if [ -n "${EXTRA_PIP_PACKAGES}" ]; then \
    python3 -m pip install --break-system-packages ${EXTRA_PIP_PACKAGES}; \
  fi

RUN if [ "${INSTALL_PLAYWRIGHT_BROWSERS}" = "1" ]; then \
    npx playwright install --with-deps chromium; \
  fi

RUN mkdir -p /data/.openclaw /data/workspace /data/.config/openclaw \
  && chown -R node:node /data

COPY --chown=node:node scripts /opt/openclaw-deploy/scripts
RUN chmod 0755 /opt/openclaw-deploy/scripts/*.sh

ENV HOME=/home/node \
  OPENCLAW_HOME=/home/node \
  OPENCLAW_STATE_DIR=/data/.openclaw \
  OPENCLAW_CONFIG_DIR=/data/.openclaw \
  OPENCLAW_CONFIG_PATH=/data/.openclaw/openclaw.json \
  OPENCLAW_WORKSPACE_DIR=/data/workspace \
  OPENCLAW_AUTH_PROFILE_SECRET_DIR=/data/.config/openclaw \
  OPENCLAW_DISABLE_BONJOUR=1 \
  OPENCLAW_GATEWAY_BIND=lan \
  PORT=8080

VOLUME ["/data"]
EXPOSE 8080

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || '8080') + '/healthz').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "-lc", "exec node /app/dist/index.js gateway --bind ${OPENCLAW_GATEWAY_BIND:-lan} --port ${PORT:-8080}"]
