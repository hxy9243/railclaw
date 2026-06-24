.PHONY: validate smoke

validate:
	scripts/validate.sh

smoke:
	scripts/smoke-test.sh
