import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('entrypoint fixes OpenClaw config before starting the gateway', async () => {
  const entrypoint = await fs.readFile(new URL('../src/container/entrypoint.js', import.meta.url), 'utf8');
  const doctor = "await runCommand('openclaw', ['doctor', '--fix']";
  const gateway = "spawn('openclaw', ['gateway', '--bind', bind, '--port', port]";

  assert.match(entrypoint, /await runCommand\('openclaw', \['doctor', '--fix'\]/);
  assert.ok(entrypoint.indexOf(doctor) < entrypoint.indexOf(gateway), 'doctor should finish before the gateway starts');
  assert.match(entrypoint, /uid: nodeUid,\n  gid: nodeGid/, 'doctor should run as the node user');
});
