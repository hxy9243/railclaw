import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('Make deploy calls Railway directly instead of a railclaw wrapper', async () => {
  const makefile = await fs.readFile('Makefile', 'utf8');
  assert.match(makefile, /\ndeploy:\n\trailway up\n/);
  assert.doesNotMatch(makefile, /railclaw railway/);
});
