import { runContainer } from '../../src/container/lifecycle.js';
const stage = process.argv[2];
const childScript = new URL('./worker.mjs', import.meta.url).pathname;
process.exitCode = await runContainer({
  prepare: async () => {
    if (stage === 'prepare') {
      console.log('READY');
      await new Promise(resolve => setTimeout(resolve, 200));
      console.log('CLEANED');
    }
  },
  doctor: { command: process.execPath, args: stage === 'waiting-leader' ? [new URL('./waiting-leader.mjs', import.meta.url).pathname] : stage === 'early-leader' ? [new URL('./early-exit-leader.mjs', import.meta.url).pathname] : stage === 'doctor' ? [childScript] : ['-e', ''], options: { stdio: 'inherit' } },
  gateway: { command: process.execPath, args: [childScript, 'gateway'], options: { stdio: 'inherit' } },
});
