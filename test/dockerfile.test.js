import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('Dockerfile builds app as node and starts root bootstrap for Railway volumes', async () => {
  const dockerfile = await fs.readFile(new URL('../Dockerfile', import.meta.url), 'utf8');
  const appInstall = dockerfile.match(/USER node[\s\S]*?RUN npm ci --omit=dev/);
  const runtimeBootstrap = dockerfile.match(/USER root[\s\S]*?CMD \["node", "\/opt\/railclaw\/src\/container\/entrypoint\.js"\]/);

  assert.ok(appInstall, 'npm install layer should run as node');
  assert.ok(runtimeBootstrap, 'entrypoint should start as root so Railway /data ownership can be repaired');
  assert.match(dockerfile, /spawns OpenClaw as the node user/);
  assert.doesNotMatch(dockerfile, /mkdir -p \/data/, 'runtime entrypoint should initialize mounted /data');
  assert.doesNotMatch(dockerfile, /chown -R node:node \/data/, 'runtime entrypoint should own mounted /data');
});
