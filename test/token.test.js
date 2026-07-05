import test from 'node:test';
import assert from 'node:assert/strict';
import { generateToken } from '../src/lib/token.js';

test('generateToken returns base64 token with required minimum bytes', () => {
  const token = generateToken(32);
  assert.match(token, /^[A-Za-z0-9+/=]+$/);
  assert.equal(Buffer.from(token, 'base64').length, 32);
});

test('generateToken rejects short tokens', () => {
  assert.throws(() => generateToken(31), />= 32/);
});
