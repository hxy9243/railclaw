import { spawn } from 'node:child_process';
const child = spawn(process.execPath, [new URL('./worker.mjs', import.meta.url).pathname], { stdio: 'inherit' });
console.log(`DESCENDANT_PID=${child.pid}`);
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal));
child.once('exit', (code) => { console.log('DESCENDANT_REAPED'); process.exit(code ?? 1); });
