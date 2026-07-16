import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('entrypoint fixes OpenClaw config before starting the gateway', async () => {
  const entrypoint = await fs.readFile(new URL('../src/container/entrypoint.js', import.meta.url), 'utf8');
  const doctor = "await runCommand('openclaw', ['doctor', '--fix']";
  const gateway = "spawn('openclaw', ['gateway', '--bind', bind, '--port', port]";

  assert.match(entrypoint, /await runCommand\('openclaw', \['doctor', '--fix'\]/);
  assert.ok(entrypoint.indexOf(doctor) < entrypoint.indexOf(gateway), 'doctor should finish before the gateway starts');
  assert.match(entrypoint, /process\.setgid\(nodeGid\);\n  process\.setuid\(nodeUid\);/, 'entrypoint should permanently drop root before doctor runs');
  assert.ok(entrypoint.indexOf('process.setuid(nodeUid)') < entrypoint.indexOf(doctor), 'privileges should drop before doctor runs');
  assert.doesNotMatch(entrypoint, /uid: nodeUid/, 'children should inherit the non-root entrypoint identity');
});
