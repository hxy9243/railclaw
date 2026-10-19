import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('entrypoint fixes OpenClaw config before starting the gateway', async () => {
  const entrypoint = await fs.readFile(new URL('../src/container/entrypoint.js', import.meta.url), 'utf8');
  const lifecycle = await fs.readFile(new URL('../src/container/lifecycle.js', import.meta.url), 'utf8');
  const doctor = "args: ['doctor', '--fix']";

  assert.match(entrypoint, /process\.exitCode = await runContainer\(/);
  assert.match(entrypoint, /doctor:\s*\{\s*command: 'openclaw',\s*args: \['doctor', '--fix'\]/);
  assert.match(entrypoint, /gateway:\s*\{\s*command: 'openclaw',\s*args: \[\s*'gateway', '--bind'/);
  assert.ok(lifecycle.indexOf('await prepare()') < lifecycle.indexOf('await run(doctor)'), 'prepare should finish before doctor runs');
  assert.ok(lifecycle.indexOf('await run(doctor)') < lifecycle.indexOf('await run(gateway)'), 'doctor should finish before the gateway starts');
  assert.match(entrypoint, /process\.setgid\(nodeGid\);\s+process\.setuid\(nodeUid\);/, 'entrypoint should permanently drop root before doctor runs');
  assert.ok(entrypoint.indexOf('process.setuid(nodeUid)') < entrypoint.indexOf(doctor), 'privileges should drop before doctor runs');
  assert.doesNotMatch(entrypoint, /uid: nodeUid/, 'children should inherit the non-root entrypoint identity');
});
