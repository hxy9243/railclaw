import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('Make deploy uses the app-specific railclaw deploy helper', async () => {
  const makefile = await fs.readFile('Makefile', 'utf8');
  assert.match(makefile, /\ndeploy:\n\tnode bin\/railclaw\.js deploy\n/);
  assert.doesNotMatch(makefile, /railclaw railway/);
});
