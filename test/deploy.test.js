import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTarget } from '../src/lib/deploy.js';

test('resolveTarget returns exact Railway service and environment IDs', () => {
  const target = resolveTarget({
    environments: {
      edges: [
        { node: { id: 'env-production-id', name: 'production' } },
      ],
    },
    services: {
      edges: [
        { node: { id: 'service-openclaw-id', name: 'openclaw' } },
      ],
    },
  }, {
    service: 'openclaw',
    environment: 'production',
  });

  assert.deepEqual(target, {
    environment: 'production',
    environmentId: 'env-production-id',
    service: 'openclaw',
    serviceId: 'service-openclaw-id',
  });
});
