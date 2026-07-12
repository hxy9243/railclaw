# syntax=docker/dockerfile:1.7
#
# Railway deploy image for OpenClaw using the npm package path.
#
# The official OpenClaw image path is kept in Dockerfile.official-image for
# environments where ghcr.io/openclaw/openclaw is available anonymously or via
# registry credentials. This Dockerfile is the default because it can be built
# from public npm and Debian/Node images without GHCR package access.
FROM node:26-bookworm-slim

USER root

ARG DEBIAN_FRONTEND=noninteractive
ARG OPENCLAW_NPM_PACKAGE=openclaw@2026.6.10
ARG EXTRA_APT_PACKAGES=""
ARG EXTRA_NPM_PACKAGES=""
ARG EXTRA_PIP_PACKAGES=""
ARG INSTALL_PLAYWRIGHT_BROWSERS=1

COPY extensions /tmp/openclaw-extensions
COPY deploy/install-extensions.sh /usr/local/bin/install-openclaw-extensions
RUN chmod +x /usr/local/bin/install-openclaw-extensions \
  && OPENCLAW_NPM_PACKAGE="${OPENCLAW_NPM_PACKAGE}" \
    EXTRA_APT_PACKAGES="${EXTRA_APT_PACKAGES}" \
    EXTRA_NPM_PACKAGES="${EXTRA_NPM_PACKAGES}" \
    EXTRA_PIP_PACKAGES="${EXTRA_PIP_PACKAGES}" \
    INSTALL_PLAYWRIGHT_BROWSERS="${INSTALL_PLAYWRIGHT_BROWSERS}" \
    install-openclaw-extensions

RUN mkdir -p /data/.openclaw /data/workspace /data/.config/openclaw \
  /home/node/.config \
  && chown -R node:node /data /home/node /opt/openclaw-manifests

WORKDIR /opt/railclaw
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev \
  && npm cache clean --force
COPY --chown=node:node bin /opt/railclaw/bin
COPY --chown=node:node src /opt/railclaw/src
RUN chmod +x /opt/railclaw/bin/railclaw.js \
  && ln -sf /opt/railclaw/bin/railclaw.js /usr/local/bin/railclaw \
  && ln -sf /opt/railclaw/bin/railclaw.js /usr/local/bin/openclaw-railway

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

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "const port = process.env.OPENCLAW_GATEWAY_PORT || process.env.PORT || '8080'; fetch('http://127.0.0.1:' + port + '/healthz').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "/opt/railclaw/src/container/entrypoint.js"]
