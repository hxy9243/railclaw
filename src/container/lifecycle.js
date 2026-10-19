import { spawn } from 'node:child_process';
import { constants } from 'node:os';

// Keep the container alive until the active command has closed, giving OpenClaw
// time to flush state and remove its own locks. Never remove locks ourselves.
export async function runContainer({ prepare, doctor, gateway, runtime = process, launch = spawn }) {
  let activeChild;
  let shutdownSignal;
  const grouped = process.platform !== 'win32';
  const signalCode = (signal) => 128 + (constants.signals[signal] || 1);
  const forward = (signal) => {
    if (!activeChild?.pid) return;
    try {
      // The CLI can spawn another Node process. Signal its whole process group.
      if (grouped) runtime.kill(-activeChild.pid, signal);
      else activeChild.kill(signal);
    } catch (error) {
      if (error.code !== 'ESRCH') runtime.stderr.write(`Unable to forward ${signal}: ${error.message}\n`);
    }
  };
  const onTerm = () => stop('SIGTERM');
  const onInt = () => stop('SIGINT');
  function stop(signal) {
    shutdownSignal ||= signal;
    forward(signal);
  }
  runtime.on('SIGTERM', onTerm);
  runtime.on('SIGINT', onInt);

  async function run({ command, args, options = {} }) {
    if (shutdownSignal) return;
    return new Promise((resolve, reject) => {
      let spawnError;
      const child = launch(command, args, { ...options, detached: grouped });
      activeChild = child;
      child.once('error', (error) => { spawnError = error; });
      // close follows exit/error, and waits for the child's stdio to close.
      child.once('close', (code, signal) => {
        activeChild = undefined;
        if (spawnError) reject(spawnError);
        else resolve({ code, signal });
      });
    });
  }

  try {
    await prepare();
    if (shutdownSignal) return signalCode(shutdownSignal);
    const result = await run(doctor);
    if (shutdownSignal) return signalCode(shutdownSignal);
    if (result.signal || result.code !== 0) {
      throw new Error(`${doctor.command} ${doctor.args.join(' ')} exited ${result.signal ? `from signal ${result.signal}` : `with code ${result.code}`}`);
    }
    const gatewayResult = await run(gateway);
    if (shutdownSignal) return signalCode(shutdownSignal);
    return gatewayResult.signal ? signalCode(gatewayResult.signal) : (gatewayResult.code ?? 1);
  } catch (error) {
    if (shutdownSignal) return signalCode(shutdownSignal);
    throw error;
  } finally {
    runtime.removeListener('SIGTERM', onTerm);
    runtime.removeListener('SIGINT', onInt);
  }
}
