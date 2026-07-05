# syntax=docker/dockerfile:1.7
#
# Railway deploy image for OpenClaw using the npm package path.
#
# The official OpenClaw image path is kept in Dockerfile.official-image for
# environments where ghcr.io/openclaw/openclaw is available anonymously or via
# registry credentials. This Dockerfile is the default because it can be built
# from public npm and Debian/Node images without GHCR package access.
FROM node:24-bookworm-slim

USER root

ARG DEBIAN_FRONTEND=noninteractive
ARG OPENCLAW_NPM_PACKAGE=openclaw@2026.6.10
ARG EXTRA_APT_PACKAGES="bash ca-certificates coreutils curl dumb-init findutils git git-lfs gnupg jq less nano openssh-client procps python3 python3-pip python3-venv ripgrep rsync sqlite3 tar tini unzip vim wget xz-utils zip"
ARG EXTRA_NPM_PACKAGES="@openai/codex @anthropic-ai/claude-code @google/gemini-cli obsidian-cli playwright"
ARG EXTRA_PIP_PACKAGES=""
ARG INSTALL_PLAYWRIGHT_BROWSERS=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends ${EXTRA_APT_PACKAGES} \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g ${OPENCLAW_NPM_PACKAGE} ${EXTRA_NPM_PACKAGES} \
  && npm cache clean --force

RUN if [ -n "${EXTRA_PIP_PACKAGES}" ]; then \
    python3 -m pip install --break-system-packages ${EXTRA_PIP_PACKAGES}; \
  fi

RUN if [ "${INSTALL_PLAYWRIGHT_BROWSERS}" = "1" ]; then \
    npx playwright install --with-deps chromium; \
  fi

RUN mkdir -p /data/.openclaw /data/workspace /data/.config/openclaw \
  /home/node/.config \
  && chown -R node:node /data /home/node

COPY --chown=node:node src /opt/railclaw/src

ENV HOME=/home/node \
  OPENCLAW_HOME=/home/node \
  OPENCLAW_STATE_DIR=/data/.openclaw \
  OPENCLAW_CONFIG_DIR=/data/.openclaw \
  OPENCLAW_CONFIG_PATH=/data/.openclaw/openclaw.json \
  OPENCLAW_WORKSPACE_DIR=/data/workspace \
  OPENCLAW_AUTH_PROFILE_SECRET_DIR=/data/.config/openclaw \
  OPENCLAW_DISABLE_BONJOUR=1 \
  OPENCLAW_GATEWAY_BIND=lan \
  OPENCLAW_GATEWAY_PORT=8080 \
  PORT=8080

VOLUME ["/data"]
EXPOSE 8080

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "const port = process.env.OPENCLAW_GATEWAY_PORT || process.env.PORT || '8080'; fetch('http://127.0.0.1:' + port + '/healthz').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "/opt/railclaw/src/container/entrypoint.js"]
