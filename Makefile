.PHONY: build check deploy doctor migrate smoke token validate

IMAGE_NAME ?= railclaw-openclaw
OPENCLAW_IMAGE ?= alpine/openclaw:latest
OPENCLAW_IMAGE_APT_PACKAGES ?=
OPENCLAW_IMAGE_PIP_PACKAGES ?=
OPENCLAW_INSTALL_BROWSER ?= 1
EXTRA_NPM_PACKAGES ?=
EXTRA_APT_PACKAGES ?=
EXTRA_PIP_PACKAGES ?=
INSTALL_PLAYWRIGHT_BROWSERS ?= $(OPENCLAW_INSTALL_BROWSER)

build:
	docker build \
		--pull \
		--build-arg OPENCLAW_IMAGE="$(OPENCLAW_IMAGE)" \
		--build-arg OPENCLAW_IMAGE_APT_PACKAGES="$(OPENCLAW_IMAGE_APT_PACKAGES)" \
		--build-arg OPENCLAW_IMAGE_PIP_PACKAGES="$(OPENCLAW_IMAGE_PIP_PACKAGES)" \
		--build-arg OPENCLAW_INSTALL_BROWSER="$(OPENCLAW_INSTALL_BROWSER)" \
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
