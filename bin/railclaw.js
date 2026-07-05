#!/usr/bin/env node
import { run } from '../src/cli/index.js';

run(process.argv).catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`railclaw: ${message}`);
  process.exitCode = 1;
});
