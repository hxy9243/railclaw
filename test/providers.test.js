import test from 'node:test';
import assert from 'node:assert/strict';
import { providerInstructions } from '../src/lib/providers.js';

test('provider instructions print Railway CLI variable commands without storing secrets', () => {
  const output = providerInstructions(['openai-codex', 'openrouter']);
  assert.match(output, /railway variable set OPENAI_API_KEY=<secret>/);
  assert.match(output, /railway variable set OPENROUTER_API_KEY=<secret>/);
});
