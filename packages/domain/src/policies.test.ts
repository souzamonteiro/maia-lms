// Unit tests for domain policies
import { describe, it, expect } from 'vitest';
import {
  isEntitlementActive,
  isValidOrderTransition,
  orderGrantsEntitlement,
  scoreAttempt,
} from '../src/policies.js';
import type { Entitlement } from '../src/types.js';

const baseEntitlement = (): Entitlement => ({
  id: '1',
  enrollmentId: 'e1',
  sourceType: 'free',
  sourceId: null,
  startsAt: new Date(Date.now() - 1000).toISOString(),
  endsAt: null,
  revokedAt: null,
});

describe('isEntitlementActive', () => {
  it('returns true for an active entitlement', () => {
    expect(isEntitlementActive(baseEntitlement())).toBe(true);
  });

  it('returns false if revoked', () => {
    expect(isEntitlementActive({ ...baseEntitlement(), revokedAt: new Date().toISOString() })).toBe(
      false,
    );
  });

  it('returns false if not yet started', () => {
    expect(
      isEntitlementActive({
        ...baseEntitlement(),
        startsAt: new Date(Date.now() + 100_000).toISOString(),
      }),
    ).toBe(false);
  });

  it('returns false if already expired', () => {
    expect(
      isEntitlementActive({
        ...baseEntitlement(),
        endsAt: new Date(Date.now() - 1000).toISOString(),
      }),
    ).toBe(false);
  });
});

describe('isValidOrderTransition', () => {
  it('allows CREATED → CHECKOUT_PENDING', () => {
    expect(isValidOrderTransition('CREATED', 'CHECKOUT_PENDING')).toBe(true);
  });

  it('allows CHECKOUT_PENDING → PAID', () => {
    expect(isValidOrderTransition('CHECKOUT_PENDING', 'PAID')).toBe(true);
  });

  it('disallows PAID → CREATED', () => {
    expect(isValidOrderTransition('PAID', 'CREATED')).toBe(false);
  });

  it('disallows REFUNDED → anything', () => {
    expect(isValidOrderTransition('REFUNDED', 'CHARGEBACK')).toBe(false);
  });
});

describe('orderGrantsEntitlement', () => {
  it('grants for PAID', () => {
    expect(orderGrantsEntitlement('PAID')).toBe(true);
  });

  it('grants for PARTIALLY_REFUNDED', () => {
    expect(orderGrantsEntitlement('PARTIALLY_REFUNDED')).toBe(true);
  });

  it('does not grant for REFUNDED', () => {
    expect(orderGrantsEntitlement('REFUNDED')).toBe(false);
  });
});

describe('scoreAttempt', () => {
  const questions = [
    { id: 'q1', correctChoiceKeys: ['a'], points: 1 },
    { id: 'q2', correctChoiceKeys: ['b', 'c'], points: 2 },
  ];

  it('scores all correct answers', () => {
    const result = scoreAttempt(questions, [
      { questionId: 'q1', selectedKeys: ['a'] },
      { questionId: 'q2', selectedKeys: ['b', 'c'] },
    ]);
    expect(result.earnedPoints).toBe(3);
    expect(result.totalPoints).toBe(3);
    expect(result.percentage).toBe(100);
  });

  it('gives zero for wrong answer', () => {
    const result = scoreAttempt(questions, [
      { questionId: 'q1', selectedKeys: ['b'] },
      { questionId: 'q2', selectedKeys: ['b', 'c'] },
    ]);
    expect(result.earnedPoints).toBe(2);
    expect(result.percentage).toBe(67);
  });

  it('requires exact multi-choice match', () => {
    const result = scoreAttempt(questions, [
      { questionId: 'q1', selectedKeys: ['a'] },
      { questionId: 'q2', selectedKeys: ['b'] }, // missing 'c'
    ]);
    expect(result.earnedPoints).toBe(1);
  });
});
