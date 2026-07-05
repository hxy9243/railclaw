.PHONY: build check deploy doctor migrate smoke token validate

IMAGE_NAME ?= railclaw-openclaw
OPENCLAW_NPM_PACKAGE ?= openclaw@2026.6.10
EXTRA_APT_PACKAGES ?= bash ca-certificates coreutils curl dumb-init findutils git git-lfs gnupg jq less nano openssh-client procps python3 python3-pip python3-venv ripgrep rsync sqlite3 tar tini unzip vim wget xz-utils zip
EXTRA_NPM_PACKAGES ?= @openai/codex @anthropic-ai/claude-code @google/gemini-cli obsidian-cli playwright
EXTRA_PIP_PACKAGES ?=
INSTALL_PLAYWRIGHT_BROWSERS ?= 1

build:
	docker build \
		--build-arg OPENCLAW_NPM_PACKAGE="$(OPENCLAW_NPM_PACKAGE)" \
		--build-arg EXTRA_APT_PACKAGES="$(EXTRA_APT_PACKAGES)" \
		--build-arg EXTRA_NPM_PACKAGES="$(EXTRA_NPM_PACKAGES)" \
		--build-arg EXTRA_PIP_PACKAGES="$(EXTRA_PIP_PACKAGES)" \
		--build-arg INSTALL_PLAYWRIGHT_BROWSERS="$(INSTALL_PLAYWRIGHT_BROWSERS)" \
		-t "$(IMAGE_NAME)" .

check:
	npm test
	npm run check

validate:
	npm run check

deploy:
	node bin/railclaw.js deploy

doctor:
	node bin/railclaw.js doctor

migrate:
	node bin/railclaw.js migrate

smoke:
	node bin/railclaw.js smoke $(URL)

token:
	node bin/railclaw.js token
