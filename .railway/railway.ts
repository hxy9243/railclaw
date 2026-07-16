import { defineRailway, github, preserve, project, service, volume } from "railway/iac";

const projectName = process.env.RAILWAY_IAC_PROJECT_NAME || "openclaw-railway";
const repo = process.env.RAILWAY_GITHUB_REPO || "hxy9243/railclaw";
const branch = process.env.RAILWAY_GITHUB_BRANCH || "main";

export default defineRailway(() => {
  const data = volume("openclaw-volume", {
    sizeMB: 50_000,
  });

  const openclaw = service("openclaw", {
    source: github(repo, { branch }),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "Dockerfile",
    },
    deploy: {
      healthcheckPath: "/healthz",
      healthcheckTimeout: 300,
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 10,
    },
    env: {
      OPENCLAW_GATEWAY_PORT: "8080",
      PORT: "8080",
      OPENCLAW_DISABLE_BONJOUR: "1",
      OPENCLAW_GATEWAY_BIND: "lan",
      OPENCLAW_TZ: "UTC",
      // Railway mounts volumes as root. The entrypoint uses this temporary
      // privilege to repair /data, then starts OpenClaw as UID/GID 1000.
      RAILWAY_RUN_UID: "0",
      OPENCLAW_GATEWAY_TOKEN: preserve(),
    },
    volumeMounts: {
      "/data": data,
    },
  });

  return project(projectName, {
    resources: [data, openclaw],
  });
});
