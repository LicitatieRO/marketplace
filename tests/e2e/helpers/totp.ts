import { createHmac } from 'node:crypto';

/** Fail before account creation or SQL; never include connection strings in errors. */
export function assertLocalMfaTargets(app: string, auth: string, database: string) {
  try {
    const targets = [new URL(app), new URL(auth), new URL(database)];
    if (targets.some((url) => !['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error();
    if (targets.slice(0, 2).some((url) => url.protocol !== 'http:')) throw new Error();
    if (!['postgres:', 'postgresql:'].includes(targets[2].protocol) || targets[2].port !== '15432') throw new Error();
  } catch {
    throw new Error('MFA E2E requires the isolated loopback test stack.');
  }
}

/** Enrollment secrets stay in this test process; no logging or disk persistence. */
export function totpCode(secret: string, now = Date.now()): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = secret.toUpperCase().replace(/=+$/, '');
  if (!normalized || !/^[A-Z2-7]+$/.test(normalized)) throw new Error('Invalid test TOTP seed.');
  let bits = '';
  for (const char of normalized) bits += alphabet.indexOf(char).toString(2).padStart(5, '0');
  const bytes: number[] = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) bytes.push(parseInt(bits.slice(offset, offset + 8), 2));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 30_000)));
  const hash = createHmac('sha1', Buffer.from(bytes)).update(counter).digest();
  const offset = hash[hash.length - 1] & 15;
  return ((hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
}
