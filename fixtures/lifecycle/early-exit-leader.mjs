import { spawn } from 'node:child_process';
spawn(process.execPath, [new URL('./worker.mjs', import.meta.url).pathname], { stdio: 'inherit' });
process.on('SIGTERM', () => process.exit(0));
