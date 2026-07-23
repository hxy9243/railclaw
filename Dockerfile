# syntax=docker/dockerfile:1.7
#
# Railway deploy image for OpenClaw. Build on Ubuntu and install OpenClaw from
# npm at a reproducible version. The weekly upgrade workflow keeps this pin current.
ARG UBUNTU_VERSION=24.04
FROM ubuntu:${UBUNTU_VERSION}

USER root

ARG DEBIAN_FRONTEND=noninteractive
ARG NODE_MAJOR=24
ARG BUN_VERSION=1.3.14
ARG OPENCLAW_VERSION=2026.7.1-2
ARG OPENCLAW_INSTALL_BROWSER=1
ARG EXTRA_NPM_PACKAGES=""
ARG EXTRA_APT_PACKAGES=""
ARG EXTRA_PIP_PACKAGES=""
ARG INSTALL_PLAYWRIGHT_BROWSERS=""

# Root installs the shared browser payload here so the runtime node user can
# discover it without depending on root's private cache directory.
ENV BUN_INSTALL=/opt/bun \
  PATH=/opt/bun/bin:$PATH \
  PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers

# Ubuntu's Node.js package is too old for OpenClaw. Install the current Node 24
# release from NodeSource, then install the pinned OpenClaw release from npm.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl gnupg unzip \
  && mkdir -p /etc/apt/keyrings \
  && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
  && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends nodejs \
  && npm install -g "openclaw@${OPENCLAW_VERSION}" \
  && curl -fsSL https://bun.com/install | bash -s "bun-v${BUN_VERSION}" \
  && bun --version \
  && npm cache clean --force \
  && groupmod --new-name node ubuntu \
  && usermod --login node --home /home/node --move-home ubuntu \
  && rm -rf /var/lib/apt/lists/*

# Install Github cli
# Reference: https://github.com/cli/cli/blob/trunk/docs/install_linux.md
RUN (type -p wget >/dev/null || (apt update && apt install wget -y)) \
	&& mkdir -p -m 755 /etc/apt/keyrings \
	&& out=$(mktemp) && wget -nv -O$out https://cli.github.com/packages/githubcli-archive-keyring.gpg \
	&& cat $out | tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null \
	&& chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
	&& mkdir -p -m 755 /etc/apt/sources.list.d \
	&& echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
	&& apt update \
	&& apt install gh -y

COPY extensions /tmp/openclaw-extensions
COPY --chmod=0755 deploy/install-extensions.sh /usr/local/bin/install-openclaw-extensions
RUN OPENCLAW_VERSION="${OPENCLAW_VERSION}" \
    OPENCLAW_INSTALL_BROWSER="${OPENCLAW_INSTALL_BROWSER}" \
    EXTRA_APT_PACKAGES="${EXTRA_APT_PACKAGES}" \
    EXTRA_NPM_PACKAGES="${EXTRA_NPM_PACKAGES}" \
    EXTRA_PIP_PACKAGES="${EXTRA_PIP_PACKAGES}" \
    INSTALL_PLAYWRIGHT_BROWSERS="${INSTALL_PLAYWRIGHT_BROWSERS}" \
    install-openclaw-extensions

RUN mkdir -p /opt/openclaw-bun-extensions \
  && cp /tmp/openclaw-extensions/bun/package.json \
    /tmp/openclaw-extensions/bun/bun.lock \
    /opt/openclaw-bun-extensions/ \
  && cd /opt/openclaw-bun-extensions \
  && bun install --frozen-lockfile --production

RUN mkdir -p /data \
  /opt/openclaw-extensions \
  /opt/playwright-browsers \
  /opt/railclaw \
  /home/node/.config \
  && ln -sf /opt/railclaw/bin/railclaw.js /usr/local/bin/railclaw \
  && chown -R node:node /data /home/node /opt/railclaw \
  && chmod -R a+rX /opt/openclaw-extensions /opt/playwright-browsers

USER node

WORKDIR /opt/railclaw
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev \
  && npm cache clean --force
COPY --chown=node:node bin /opt/railclaw/bin
COPY --chown=node:node config /opt/railclaw/config
COPY --chown=node:node src /opt/railclaw/src
RUN chmod +x /opt/railclaw/bin/railclaw.js

ENV HOME=/home/node \
  NPM_CONFIG_PREFIX=/opt/openclaw-extensions \
  PATH=/opt/openclaw-bun-extensions/node_modules/.bin:/opt/openclaw-extensions/bin:$PATH \
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
