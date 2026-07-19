----

Future (Not in this implementation)


## 22. Implement Backup Before Migration or Upgrade

Persistent state should be backed up before destructive migrations.

Backup contents:

```text
OpenClaw config
Distribution metadata
Skill state
Workspace metadata
Integration configuration
```

Do not automatically back up large workspace files on every startup unless that behavior is explicitly intended.

Example backup location:

```text
/data/backups/2026-07-12T080000Z/
```

Recommended commands:

```text
openclaw-railway backup
openclaw-railway restore
openclaw-railway backups list
```

### Important nuance

Credentials in backups must remain protected.

Backups should inherit restrictive file permissions.

---

## 23. Track Distribution Migrations Separately

Maintain your own distribution schema version:

```json
{
  "schemaVersion": 3,
  "distributionVersion": "0.4.0"
}
```

Migration scripts can handle:

```text
Directory changes
Secret-file moves
New default configuration
Renamed integration fields
Skill layout changes
Permission fixes
```

Each migration should be:

```text
Idempotent
Versioned
Logged
Backed up beforehand
Safe to retry
```

### Important nuance

Do not assume every container restart is a clean first boot.

Railway may restart the same deployment repeatedly with persistent state attached.

---

## 24. Design the README Around the User Journey

The README should start with the shortest successful path.

Recommended structure:

```text
1. Deploy to Railway
2. Attach /data volume
3. Open Railway terminal
4. Run openclaw-railway setup
5. Open the public URL
6. Enter the generated Gateway token
```

Then include:

```text
Customizing packages
Adding Python packages
Adding Node.js packages
Installing Chromium
Adding skills
Updating OpenClaw
Running diagnostics
Backing up state
Troubleshooting
Security notes
```

Avoid making the first page a detailed explanation of the internal architecture.

The first user goal is:

```text
Get a working OpenClaw deployment
```

---

## 25. Recommended MVP User Experience

The initial user flow should be:

```text
Use repository template
        ↓
Optionally edit extension files
        ↓
Deploy to Railway
        ↓
Attach persistent volume at /data
        ↓
Open Railway terminal
        ↓
Run openclaw-railway setup
        ↓
Configure Gateway token
        ↓
Configure model provider
        ↓
Configure Telegram, Discord, or web-only mode
        ↓
Run doctor check
        ↓
Open public OpenClaw dashboard
```

The user should not need to:

```text
Manually edit JSON5
Find internal config paths
Install packages inside a running container
Run Docker commands
Restart the Railway deployment manually
Understand OpenClaw process internals
```

---

## 26. Suggested Implementation Phases

### Phase 1: Reproducible Image

Implement:

* Dockerfile.
* Pinned OpenClaw version.
* apt, pip, and npm extension manifests.
* Optional Chromium installation.
* Non-root runtime.
* Build manifest.

Success condition:

```text
A deterministic image builds locally and in Railway.
```

### Phase 2: Railway Runtime

Implement:

* `/data` persistent state layout.
* Entrypoint.
* Bootstrap script.
* Default configuration.
* Railway template.
* Basic Gateway health check.

Success condition:

```text
A fresh Railway deployment starts successfully with persistent storage.
```

### Phase 3: Terminal Setup Wizard

Implement:

* `openclaw-railway setup`.
* Gateway token generation.
* Provider setup.
* Channel setup.
* Config validation.
* Reload or restart.
* Setup completion metadata.

Success condition:

```text
A user can initialize the deployment without editing config files.
```

### Phase 4: Diagnostics and Recovery

Implement:

* `doctor`.
* `status`.
* `backup`.
* `restore`.
* Migration framework.
* Permission repair.
* Actionable terminal errors.

Success condition:

```text
A misconfigured deployment can be diagnosed and recovered without rebuilding from scratch.
```

### Phase 5: Upgrade Automation

Implement:

* Dependabot.
* Weekly OpenClaw and skill update checks.
* Docker build tests.
* Smoke tests.
* Update PR generation.
* Controlled auto-merge policy.

Success condition:

```text
Dependency and platform upgrades are proposed automatically and tested before deployment.
```

### Phase 6: Browser Wizard

Implement later:

* Node.js setup server.
* Setup authentication.
* Web-based provider and channel setup.
* OpenClaw status API.
* Gateway restart controls.
* Control UI reverse proxy.

Success condition:

```text
Most users no longer need Railway terminal access.
```

---

## 27. Important Design Boundaries

Keep these boundaries explicit:

```text
Dockerfile
  Defines software installed in the image.

Git repository
  Defines reproducible build intent.

Railway variables
  Define deployment environment and optional secrets.

Persistent /data volume
  Stores mutable instance state.

Terminal wizard
  Initializes and updates instance configuration.

OpenClaw
  Owns agent behavior and config semantics.

GitHub Actions
  Tests and proposes upgrades.

Railway
  Owns infrastructure and container lifecycle.
```

The guiding principle is:

```text
Dependencies are declared in Git.
Secrets are provided at runtime.
Mutable user state lives on /data.
Setup logic translates user intent into valid OpenClaw configuration.
```

---

## 28. Recommended First Release Scope

The first release should include:

* A pinned OpenClaw Docker image.
* Custom apt, pip, and npm package manifests.
* Optional Playwright Chromium.
* Railway template.
* Persistent `/data` volume.
* Safe bootstrap and entrypoint scripts.
* Terminal-based setup wizard.
* Gateway token initialization.
* Model-provider setup.
* Basic channel setup.
* Config validation.
* Gateway health check.
* Doctor command.
* Dependabot.
* CI Docker build and smoke test.

Defer:

* Browser setup wizard.
* Automatic Railway variable modification.
* Railway deployment API integration.
* Multi-instance management.
* Skill marketplace UI.
* Trusted-proxy authentication.
* Full automatic rollback.
* Complex deployment orchestration.

The terminal-first approach gives you a good middle ground:

```text
Much easier than manual configuration
Much simpler than building a web control plane
Still fully automatable
Still reusable by a future browser wizard
```



OpenClaw Railway Wizard: Implementation Plan


1. Make the Node.js Wizard the Container Supervisor

Run the Node.js service as the container’s main process.

The Node.js service should:

Serve the setup wizard.
Expose setup and status APIs.
Start and supervise the OpenClaw Gateway.
Proxy the OpenClaw Control UI.
Restart only the OpenClaw child process when necessary.

Recommended runtime topology:

Railway public port
        │
        ▼
Node.js Wizard / Proxy
   ├── /setup/*        Setup UI
   ├── /api/setup/*    Setup API
   └── /*              Proxy to OpenClaw
                            │
                            ▼
                  127.0.0.1:18789
                  OpenClaw Gateway

The Node.js service listens on Railway’s $PORT. OpenClaw should listen only on the container loopback interface.

Important nuance

Do not restart the Docker container for normal configuration changes. Restarting the container also kills the wizard and complicates recovery.

Instead, supervise OpenClaw as a child process and restart that child when required.

2. Organize the Node.js Service into Clear Modules

Suggested structure:

src/
├── server.ts
├── openclaw/
│   ├── cli.ts
│   ├── process-manager.ts
│   ├── config-service.ts
│   ├── auth-service.ts
│   └── status-service.ts
├── proxy/
│   └── gateway-proxy.ts
├── setup/
│   ├── routes.ts
│   ├── operations.ts
│   └── ui/
└── security/
    ├── session.ts
    ├── csrf.ts
    ├── rate-limit.ts
    └── setup-lock.ts

Responsibilities:

process-manager: start, stop, monitor, and restart OpenClaw.
cli: safely execute OpenClaw CLI commands.
config-service: validate and apply configuration changes.
auth-service: detect, initialize, and rotate Gateway authentication.
status-service: report process, configuration, Gateway, and channel health.
gateway-proxy: proxy HTTP and WebSocket traffic.
setup-lock: disable privileged setup actions after onboarding.
3. Start OpenClaw as a Supervised Child Process

The wizard should launch OpenClaw using child_process.spawn.

Example command:

openclaw gateway --bind 127.0.0.1 --port 18789

The process manager should:

Stream OpenClaw logs to container logs.
Track the process PID and exit state.
Forward shutdown signals.
Restart OpenClaw after unexpected termination.
Avoid restart loops using a delay or backoff.
Support an explicit controlled restart.

Use tini as the container entrypoint so signals and zombie processes are handled correctly:

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/server.js"]
Important nuance

Distinguish between:

An intentional restart.
A configuration-triggered restart.
An unexpected crash.

Avoid immediately restarting repeatedly when OpenClaw exits because of an invalid configuration.

4. Use the OpenClaw CLI as the Configuration Interface

Avoid directly modifying OpenClaw’s JSON or JSON5 configuration whenever possible.

Use commands such as:

openclaw config file
openclaw config get
openclaw config validate --json
openclaw config patch --stdin --dry-run
openclaw config patch --stdin

Recommended save flow:

Wizard form submitted
        ↓
Translate product settings into an OpenClaw patch
        ↓
Validate patch using --dry-run
        ↓
Apply patch
        ↓
Wait for reload or restart
        ↓
Run health checks
        ↓
Return final status

Use spawn with an argument array. Never construct shell commands using user-provided strings.

Bad:

exec("openclaw config set " + userInput)

Good:

spawn("openclaw", ["config", "patch", "--stdin"])
Important nuance

Use a mutex or write queue around configuration changes. Concurrent wizard requests must not write configuration simultaneously.

5. Expose Product-Level Configuration, Not Arbitrary Config Editing

The wizard API should accept clear product concepts:

{
  "modelProvider": {
    "type": "openai"
  },
  "channel": {
    "type": "telegram"
  },
  "browserEnabled": true
}

The server should translate these values into an OpenClaw configuration patch.

Avoid exposing endpoints such as:

POST /api/config/set-any-path
POST /api/run-command
POST /api/write-file

Instead, maintain an allowlist of supported fields and integrations.

This keeps the wizard compatible with future OpenClaw changes and prevents the setup service from becoming a remote shell.

6. Handle OpenClaw Authentication Separately

There should be separate credentials for:

The setup wizard.
The OpenClaw Gateway.
Railway administrative access, if added later.

Do not reuse the same token.

The auth service should support:

Detecting whether Gateway authentication is configured.
Reporting the authentication mode.
Generating a new cryptographically secure token.
Initializing missing authentication.
Rotating an existing token.
Returning newly generated tokens only once.

Example status:

{
  "mode": "token",
  "configured": true,
  "source": "secret-file",
  "value": null
}

The existing token should generally not be displayed. The wizard should offer to keep or rotate it.

Generate tokens using a secure random generator:

crypto.randomBytes(32).toString("base64url")
Important nuance

When returning a new token:

Add Cache-Control: no-store.
Do not include it in logs.
Do not put it in a URL.
Do not send it to analytics.
Clear it from browser state after the user leaves the page.
Tell the user it will only be displayed once.
7. Store Secrets Outside the Main Configuration Where Possible

For an MVP, storing the token in the OpenClaw configuration may be acceptable if permissions are strict.

A better design is:

/data/.openclaw-distribution/secrets/gateway-token

Recommended permissions:

secret directory: 0700
secret file:      0600

Then configure OpenClaw to reference the secret through its supported secret-reference mechanism.

This avoids putting plaintext secrets in the primary OpenClaw config while also avoiding Railway API calls for every token rotation.

Important nuance

Changing Railway environment variables from inside the container requires Railway API credentials and usually a service restart. That should be an optional deployment-management feature, not part of the basic setup flow.

8. Rely on OpenClaw Reload Before Restarting Anything

After applying configuration:

Wait for OpenClaw’s configuration watcher.
Poll Gateway health.
Use a safe Gateway restart if necessary.
Restart the child process only if the Gateway cannot recover.
Restart the Railway deployment only as a final administrative action.

Recommended restart hierarchy:

Configuration hot reload
        ↓
OpenClaw safe Gateway restart
        ↓
Node.js child-process restart
        ↓
Railway deployment restart

A Railway deployment restart should not be required for ordinary model, channel, tool, or UI configuration.

9. Implement a Stable Status API

Do not expose raw OpenClaw CLI output as the wizard’s permanent API contract.

Use OpenClaw commands internally:

openclaw status --json
openclaw status --deep
openclaw health
openclaw config validate --json

Normalize their output into a stable response:

{
  "setup": {
    "complete": true,
    "locked": true
  },
  "process": {
    "running": true,
    "pid": 42
  },
  "gateway": {
    "reachable": true,
    "authenticated": true,
    "version": "..."
  },
  "config": {
    "valid": true,
    "reloadPending": false
  },
  "channels": [
    {
      "type": "telegram",
      "configured": true,
      "healthy": true
    }
  ]
}

Health should be determined from more than the child process state.

A healthy instance should normally satisfy:

OpenClaw process exists
AND Gateway port accepts connections
AND status or health command succeeds
AND current configuration validates
10. Model Configuration Changes as Operations

Some config changes may take several seconds because OpenClaw reloads or restarts.

Represent each save as an operation:

VALIDATING
    ↓
WRITING
    ↓
WAITING_FOR_RELOAD
    ↓
WAITING_FOR_GATEWAY
    ↓
CHECKING_HEALTH
    ↓
READY | DEGRADED | FAILED

Example API:

POST /api/setup/config/apply
GET  /api/setup/operations/:operationId

Initial response:

{
  "operationId": "01J...",
  "state": "WAITING_FOR_GATEWAY"
}

The UI can poll until the operation reaches a final state.

This produces better error reporting than keeping one HTTP request open while OpenClaw restarts.

11. Proxy the OpenClaw Control UI Transparently

Recommended routes:

/setup/*       Wizard UI
/api/setup/*   Wizard APIs
/*             OpenClaw Control UI and Gateway

Register setup routes before registering the catch-all proxy.

The proxy must support:

HTTP requests.
WebSocket upgrades.
Streaming responses.
Long-running connections.
Forwarded host and protocol headers.
Large responses and media.

A Fastify implementation can use:

fastify
@fastify/http-proxy
@fastify/static

Keep OpenClaw mounted at / where possible. Putting it under a nested path such as /dashboard may require rewriting static assets, WebSocket URLs, media URLs, and runtime configuration paths.

Important nuance

The proxy should not expose OpenClaw’s internal loopback port directly. All public traffic should pass through the Node.js service.

12. Do Not Initially Attempt Automatic Dashboard Token Injection

OpenClaw Control UI authentication may happen inside its WebSocket connection protocol rather than through a normal HTTP authorization header.

For the first implementation:

Proxy the dashboard unchanged.
Generate or rotate the Gateway token.
Show the token once.
Provide a button to open the Control UI.
Let the user enter the token through OpenClaw’s normal interface.

Avoid intercepting and modifying WebSocket messages unless there is a strong need. That would tightly couple the wizard to OpenClaw’s internal protocol.

Trusted-proxy authentication could be introduced later, but it would make the Node.js service a full authentication boundary.

13. Secure the Setup Wizard

The setup wizard can modify configuration and rotate credentials, so it must be protected independently of the OpenClaw dashboard.

Recommended MVP authentication:

SETUP_PASSWORD=<generated Railway variable>

Use a secure server-side session after login.

Required protections:

HttpOnly session cookies.
Secure cookies.
SameSite=Strict.
CSRF protection.
Login and mutation rate limits.
Request-body size limits.
Strict request validation.
Secret redaction in logs.
Cache-Control: no-store on sensitive responses.
No secrets in query parameters.
No arbitrary command execution.

After successful onboarding, persist:

{
  "setupCompleted": true,
  "setupLocked": true
}

Suggested location:

/data/.openclaw-distribution/setup-state.json

Configuration changes after setup should require explicitly unlocking the wizard.

14. Suggested Setup API

Recommended endpoints:

GET    /api/setup/bootstrap
GET    /api/setup/status
GET    /api/setup/config/summary

POST   /api/setup/session
DELETE /api/setup/session

POST   /api/setup/auth/initialize
POST   /api/setup/auth/rotate

POST   /api/setup/config/validate
POST   /api/setup/config/apply

GET    /api/setup/operations/:id

POST   /api/setup/gateway/restart
POST   /api/setup/gateway/health-check

POST   /api/setup/complete
POST   /api/setup/lock
POST   /api/setup/unlock

The setup API should return sanitized errors. Full internal command output may be written to protected logs but should not automatically be exposed to the browser.

15. Implementation Phases
Phase 1: Runtime Foundation

Implement:

Fastify server.
OpenClaw child-process manager.
Graceful shutdown.
Loopback-only OpenClaw binding.
HTTP and WebSocket proxy.
Basic process status.

Success condition:

Opening the Railway URL displays the OpenClaw Control UI through Node.js.
Phase 2: Configuration Service

Implement:

OpenClaw CLI wrapper.
Config path detection.
Config validation.
Dry-run patching.
Serialized config writes.
Health polling after configuration.

Success condition:

The Node.js API can safely update a known OpenClaw setting and confirm that the Gateway remains healthy.
Phase 3: Authentication Setup

Implement:

Auth configuration detection.
Secure token generation.
Token initialization and rotation.
One-time token display.
Secret file storage or secure config storage.

Success condition:

A new deployment can generate a Gateway token and use it to access OpenClaw.
Phase 4: Wizard UI

Implement:

Setup login.
Deployment health page.
Gateway auth page.
Model provider setup.
Channel setup.
Save progress and error states.
Final setup completion and lock.

Success condition:

A user can configure the essential instance settings without terminal access.
Phase 5: Operational Hardening

Implement:

Operation state machine.
Safe restart hierarchy.
Crash backoff.
Structured and redacted logs.
CSRF and rate limiting.
Backup before config changes.
Rollback after failed changes.

Success condition:

Invalid configuration does not permanently break the deployment, and users receive actionable recovery information.
16. Recommended MVP Scope

The first release should do the following well:

Run Node.js as PID 1.
Supervise one OpenClaw Gateway process.
Bind OpenClaw to loopback.
Proxy the native Control UI.
Detect whether Gateway authentication exists.
Generate or rotate an auth token.
Validate and patch OpenClaw configuration through the CLI.
Wait for reload and report health.
Restart the OpenClaw child process when necessary.
Protect the setup UI with a separate password.
Lock privileged setup actions after onboarding.

Defer these features:

Automatic Railway variable updates.
Railway deployment restart controls.
Trusted-proxy identity integration.
WebSocket protocol modification.
Arbitrary OpenClaw config editing.
Multi-instance management.
Full deployment lifecycle management.

The guiding boundary is:

Node.js manages onboarding and process supervision.
OpenClaw remains responsible for agent behavior and configuration semantics.
Railway remains responsible for the container lifecycle and infrastructure.