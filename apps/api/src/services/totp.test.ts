import { expect, it } from 'vitest';
import {
  decryptTotpSecret,
  encodeBase32,
  encryptTotpSecret,
  generateRecoveryCode,
  hashRecoveryCode,
  totpCode,
  verifyTotp,
} from './totp.js';

it('matches the RFC 6238 SHA-1 six-digit test vector', () => {
  expect(encodeBase32(Buffer.from('12345678901234567890'))).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  expect(totpCode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 59000)).toBe('287082');
});

it('accepts only six-digit TOTP values in the adjacent 30-second window', () => {
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  const time = 1_700_000_000_000;
  expect(verifyTotp(secret, totpCode(secret, time), time)).toBe(true);
  expect(verifyTotp(secret, totpCode(secret, time - 30000), time)).toBe(true);
  expect(verifyTotp(secret, 'not-code', time)).toBe(false);
  expect(verifyTotp(secret, '12345', time)).toBe(false);
});

it('encrypts TOTP secrets and normalizes one-time recovery codes before hashing', () => {
  const secret = 'JBSWY3DPEHPK3PXP';
  const encrypted = encryptTotpSecret(secret, 'application-secret-for-test-only');
  expect(encrypted).not.toContain(secret);
  expect(decryptTotpSecret(encrypted, 'application-secret-for-test-only')).toBe(secret);
  expect(() => decryptTotpSecret(encrypted, 'wrong-application-secret')).toThrow();

  const recoveryCode = generateRecoveryCode();
  expect(recoveryCode).toMatch(/^[A-F0-9]{20}$/);
  expect(hashRecoveryCode(recoveryCode)).toBe(hashRecoveryCode(`${recoveryCode.slice(0, 10)}-${recoveryCode.slice(10)}`));
  expect(hashRecoveryCode(recoveryCode)).not.toBe(recoveryCode);
});
