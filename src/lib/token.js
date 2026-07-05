import crypto from 'node:crypto';

export function generateToken(bytes = 48) {
  const parsed = Number(bytes);
  if (!Number.isInteger(parsed) || parsed < 32) {
    throw new Error('token byte count must be an integer >= 32');
  }
  return crypto.randomBytes(parsed).toString('base64');
}
