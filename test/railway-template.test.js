import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRailwayFile } from 'railway/iac';

test('Railway IaC template mounts the OpenClaw volume at /data', async () => {
  const result = await evaluateRailwayFile('.railway/railway.ts');
  const service = result.desiredConfig.services.openclaw;
  const volume = result.desiredConfig.volumes['openclaw-volume'];

  assert.equal(service.source.repo, 'hxy9243/railclaw');
  assert.equal(service.source.branch, 'main');
  assert.equal(service.build.builder, 'DOCKERFILE');
  assert.equal(service.build.dockerfilePath, 'Dockerfile');
  assert.equal(service.deploy.healthcheckPath, '/healthz');
  assert.equal(service.volumeMounts['openclaw-volume'].mountPath, '/data');
  assert.equal(volume.sizeMB, 50_000);
});
