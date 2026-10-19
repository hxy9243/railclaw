import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { spawn } from 'node:child_process';
import { runContainer } from '../src/container/lifecycle.js';

const tick = () => new Promise(setImmediate);
function harness(prepare = async () => {}) {
  const runtime = new EventEmitter();
  const signals = [];
  runtime.kill = (...args) => signals.push(args);
  runtime.stderr = { write() {} };
  const children = [];
  const launch = (command, args, options) => {
    const child = new EventEmitter();
    child.pid = children.length + 40000;
    child.kill = (signal) => signals.push([child.pid, signal]);
    children.push({ child, command, args, options });
    return child;
  };
  const work = runContainer({ prepare, doctor: { command: 'doctor', args: ['--fix'] }, gateway: { command: 'gateway', args: [] }, runtime, launch });
  return { runtime, signals, children, work };
}
function cleaned(h) {
  assert.equal(h.runtime.listenerCount('SIGTERM'), 0);
  assert.equal(h.runtime.listenerCount('SIGINT'), 0);
}

test('normal Doctor success starts gateway and propagates its exit code', async () => {
  const h = harness(); await tick();
  h.children[0].child.emit('close', 0, null); await tick();
  assert.equal(h.children[1].command, 'gateway');
  assert.equal(h.children[1].options.detached, process.platform !== 'win32');
  h.children[1].child.emit('close', 7, null);
  assert.equal(await h.work, 7); cleaned(h);
});
for (const signal of ['SIGTERM', 'SIGINT']) {
  test(`${signal} during bootstrap prevents all command launches`, async () => {
    let finish; const h = harness(() => new Promise(r => { finish = r; }));
    h.runtime.emit(signal); finish();
    assert.equal(await h.work, signal === 'SIGTERM' ? 143 : 130);
    assert.equal(h.children.length, 0); cleaned(h);
  });
  for (const stage of ['doctor', 'gateway']) {
    test(`${signal} forwards to ${stage}, waits for close and never starts another command`, async () => {
      const h = harness(); await tick();
      if (stage === 'gateway') { h.children[0].child.emit('close', 0, null); await tick(); }
      const current = h.children.at(-1).child;
      let done = false; h.work.then(() => { done = true; });
      h.runtime.emit(signal);
      assert.deepEqual(h.signals, [[process.platform === 'win32' ? current.pid : -current.pid, signal]]);
      current.emit('exit', 0, null); await tick();
      assert.equal(done, false);
      current.emit('close', 0, null);
      assert.equal(await h.work, signal === 'SIGTERM' ? 143 : 130);
      assert.equal(h.children.length, stage === 'doctor' ? 1 : 2); cleaned(h);
    });
  }
}
test('Doctor failure stops startup and cleans signal handlers', async () => {
  const h = harness(); const rejected = assert.rejects(h.work, /exited with code 2/); await tick();
  h.children[0].child.emit('close', 2, null); await rejected;
  assert.equal(h.children.length, 1); cleaned(h);
});
for (const stage of ['doctor', 'gateway']) {
  test(`${stage} spawn error is handled after close`, async () => {
    const h = harness(); const rejected = assert.rejects(h.work, /ENOENT/); await tick();
    if (stage === 'gateway') { h.children[0].child.emit('close', 0, null); await tick(); }
    h.children.at(-1).child.emit('error', new Error('ENOENT'));
    h.children.at(-1).child.emit('close', -2, null);
    await rejected; cleaned(h);
  });
}
test('bootstrap errors clean handlers', async () => {
  const h = harness(async () => { throw new Error('prepare failed'); });
  await assert.rejects(h.work, /prepare failed/); cleaned(h);
});
test('gateway signal termination becomes a conventional signal exit code', async () => {
  const h = harness(); await tick(); h.children[0].child.emit('close', 0, null); await tick();
  h.children[1].child.emit('close', null, 'SIGKILL');
  assert.equal(await h.work, 137); cleaned(h);
});
for (const stage of ['doctor', 'gateway', 'prepare']) {
  for (const signal of ['SIGTERM', 'SIGINT']) {
    test(`real process: ${signal} during ${stage} waits for cleanup`, { timeout: 6000, skip: process.platform === 'win32' }, async () => {
      const child = spawn(process.execPath, [new URL('../fixtures/lifecycle/supervisor.mjs', import.meta.url).pathname, stage], { stdio: ['ignore', 'pipe', 'pipe'] });
      let output = ''; let errors = '';
      child.stdout.on('data', chunk => { output += chunk; });
      child.stderr.on('data', chunk => { errors += chunk; });
      const closed = once(child, 'close');
      try {
        while (!output.includes('READY')) { await Promise.race([once(child.stdout, 'data'), closed.then(() => { throw new Error(errors || 'premature exit'); })]); }
        child.kill(signal);
        const [code, exitSignal] = await closed;
        assert.equal(exitSignal, null, errors);
        assert.equal(code, signal === 'SIGTERM' ? 143 : 130, errors);
        assert.match(output, /CLEANED/);
        if (stage !== 'gateway') assert.doesNotMatch(output, /GATEWAY STARTED/);
      } finally { if (child.exitCode === null) child.kill('SIGKILL'); }
    });
  }
}
test('real spawn failure rejects without hanging', async () => {
  await assert.rejects(runContainer({ prepare: async () => {}, doctor: { command: '/nonexistent/railclaw-test-command', args: [] }, gateway: { command: process.execPath, args: [] } }), /ENOENT/);
});
test('synchronous spawn error releases signal handlers', async () => {
  const runtime = new EventEmitter();
  await assert.rejects(runContainer({ prepare: async () => {}, doctor: { command: 'doctor', args: [] }, gateway: { command: 'gateway', args: [] }, runtime, launch: () => { throw new Error('invalid arguments'); } }), /invalid arguments/);
  assert.equal(runtime.listenerCount('SIGTERM'), 0);
  assert.equal(runtime.listenerCount('SIGINT'), 0);
});
test('documents limitation: early-exiting wrapper can outlive supervisor through its descendant', { timeout: 6000, skip: process.platform === 'win32' }, async () => {
  const child = spawn(process.execPath, [new URL('../fixtures/lifecycle/supervisor.mjs', import.meta.url).pathname, 'early-leader'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  const exited = once(child, 'exit');
  const closed = once(child, 'close');
  while (!output.includes('READY')) await once(child.stdout, 'data');
  child.kill('SIGTERM');
  const [code] = await exited;
  assert.equal(code, 143);
  assert.doesNotMatch(output, /CLEANED/);
  await closed;
  assert.match(output, /CLEANED/);
});
for (const signal of ['SIGTERM', 'SIGINT']) {
  test(`real forwarding wrapper waits for descendant cleanup on repeated ${signal}`, { timeout: 6000, skip: process.platform === 'win32' }, async () => {
    const child = spawn(process.execPath, [new URL('../fixtures/lifecycle/supervisor.mjs', import.meta.url).pathname, 'waiting-leader'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    const exited = once(child, 'exit');
    const closed = once(child, 'close');
    while (!output.includes('READY')) await once(child.stdout, 'data');
    const descendantPid = Number(output.match(/DESCENDANT_PID=(\d+)/)[1]);
    child.kill(signal);
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(child.exitCode, null, 'supervisor must wait during cleanup');
    child.kill(signal);
    const [code] = await exited;
    assert.equal(code, signal === 'SIGTERM' ? 143 : 130);
    await closed;
    assert.match(output, /CLEANED[\s\S]*DESCENDANT_REAPED/);
    assert.throws(() => process.kill(descendantPid, 0), { code: 'ESRCH' });
  });
}
