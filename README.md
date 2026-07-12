# OpenClaw on Railway 🦞🚄

Run OpenClaw on Railway from your own GitHub repo with a persistent `/data` volume, simple customization files, and update automation already wired in.

This repository is meant to be forked, lightly customized, and deployed. You edit plain manifests for packages and runtime defaults, Railway builds the image from GitHub, and future updates arrive as normal pull requests.

## 🚀 Bootstrap

Use [skills/BOOTSTRAP.md](skills/BOOTSTRAP.md) as the canonical setup guide for agents and humans.

The bootstrap covers:

- Checking official Railway CLI (`railway`) and GitHub CLI (`gh`) access.
- Choosing whether to fork this repo or deploy from the current repo.
- Applying Railway Infrastructure as Code.
- Setting non-secret Railway variables.
- Prompting the user to configure production secrets directly in Railway.
- Initializing the mounted `/data` volume.
- Restarting and smoke-testing the public Railway URL.

Feel free to walk through the installation process, or simply feed it to your favorite agent (could be another OpenClaw instance).

## 🧩 Customize

Edit the extension manifests before deploying or before opening an update PR:

```text
extensions/apt.txt
extensions/npm.txt
extensions/pip.txt
extensions/requirements.txt
extensions/browsers.yaml
extensions/skills.yaml
```

The default OpenClaw config templates live in `config/`. Bootstrap copies those templates into the Railway volume instead of storing mutable runtime state in the image.

## 🔄 Updates

Dependabot and the weekly upgrade workflow keep dependencies, GitHub Actions, and the OpenClaw base image moving through pull requests.

Optional auto-merge setup is documented in [skills/BOOTSTRAP.md](skills/BOOTSTRAP.md). Required checks should still gate merges on `main`.

## 💾 Persistent Data

Railway should mount one volume at `/data`.

| Path | Purpose |
| --- | --- |
| `/data/.openclaw` | OpenClaw config and state |
| `/data/.openclaw-distribution` | Distribution setup metadata |
| `/data/.config/openclaw` | OpenClaw auth-profile secret material |
| `/data/workspace` | Agent workspace |
| `/data/.codex` | Codex state when used |
| `/data/.config/opencode` | Opencode state when used |

Do not store mutable user configuration in the image filesystem. Railway can replace the container at any time; `/data` is the durable boundary.

## 🧪 Local Checks

```bash
npm ci
npm test
docker build --pull --build-arg OPENCLAW_INSTALL_BROWSER=0 --build-arg INSTALL_PLAYWRIGHT_BROWSERS=0 -t openclaw-railway .
```

## 🔐 Security

- Do not commit `.env`, provider keys, gateway tokens, OAuth tokens, auth-profile secrets, workspace data, migration archives, Railway local state, or personal paths.
- Store deployed secrets directly in Railway variables.
- Do not ask users to paste production secrets into agent chat.
- Treat migration archives as secrets.
