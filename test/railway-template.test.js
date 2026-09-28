import test from 'node:test';
import assert from 'node:assert/strict';
import railwayTemplate from '../.railway/railway.ts';

test('Railway IaC template mounts the OpenClaw volume at /data', async () => {
  const project = railwayTemplate();
  const service = project.resources.find((resource) => resource.name === 'openclaw');
  const volume = project.resources.find((resource) => resource.name === 'openclaw-volume');

  assert.ok(service);
  assert.ok(volume);

  assert.equal(service.source.repo, 'hxy9243/railclaw');
  assert.equal(service.source.branch, 'main');
  assert.equal(service.build.builder, 'DOCKERFILE');
  assert.equal(service.build.dockerfilePath, 'Dockerfile');
  assert.equal(service.deploy.healthcheckPath, '/healthz');
  assert.equal(service.variables.RAILWAY_RUN_UID.value, '0');
  assert.equal(service.volumeAttachments['openclaw-volume'].mountPath, '/data');
  assert.equal(volume.config.sizeMB, 50_000);
});
