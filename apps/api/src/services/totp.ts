import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function encodeBase32(bytes: Uint8Array): string {
  let buffer = 0;
  let bits = 0;
  let output = '';
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(buffer >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(buffer << (5 - bits)) & 31];
  return output;
}

function decodeBase32(value: string): Buffer {
  let buffer = 0;
  let bits = 0;
  const bytes: number[] = [];
  for (const character of value.toUpperCase().replace(/=+$/g, '').replace(/\s/g, '')) {
    const digit = alphabet.indexOf(character);
    if (digit < 0) throw new Error('Invalid base32 secret');
    buffer = (buffer << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(): string {
  return encodeBase32(randomBytes(20));
}

export function totpCode(secret: string, timeMs = Date.now(), digits = 6): string {
  const counter = BigInt(Math.floor(timeMs / 30000));
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(counter);
  const digest = createHmac('sha1', decodeBase32(secret)).update(message).digest();
  const offset = digest[digest.length - 1] & 15;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % (10 ** digits)).padStart(digits, '0');
}

export function verifyTotp(secret: string, code: string, timeMs = Date.now()): boolean {
  return matchTotpStep(secret, code, timeMs) !== null;
}

export function matchTotpStep(secret: string, code: string, timeMs = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const provided = Buffer.from(code);
  const currentStep = Math.floor(timeMs / 30000);
  for (const offset of [-1, 0, 1]) {
    const step = currentStep + offset;
    const expected = Buffer.from(totpCode(secret, step * 30000));
    if (timingSafeEqual(provided, expected)) return step;
  }
  return null;
}

function encryptionKey(applicationSecret: string): Buffer {
  return createHmac('sha256', applicationSecret).update('maia-lms:totp-secret:v1').digest();
}

export function encryptTotpSecret(secret: string, applicationSecret: string): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(applicationSecret), nonce);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return `enc:v1:${nonce.toString('base64url')}:${encrypted.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}`;
}

export function decryptTotpSecret(stored: string, applicationSecret: string): string {
  if (!stored.startsWith('enc:v1:')) return stored;
  const [, , nonceValue, encryptedValue, tagValue] = stored.split(':');
  if (!nonceValue || !encryptedValue || !tagValue) throw new Error('Invalid encrypted TOTP secret');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(applicationSecret),
    Buffer.from(nonceValue, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function generateRecoveryCode(): string {
  return randomBytes(10).toString('hex').toUpperCase();
}

export function hashRecoveryCode(code: string): string {
  return createHmac('sha256', 'maia-lms:totp-recovery:v1')
    .update(code.replace(/[-\s]/g, '').toUpperCase())
    .digest('hex');
}
