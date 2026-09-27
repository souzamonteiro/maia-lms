// Domain policy functions for Maia LMS

import type { Entitlement, OrderState } from './types.js';

/**
 * Determines if an entitlement grants active access at a given point in time.
 */
export function isEntitlementActive(entitlement: Entitlement, now: Date = new Date()): boolean {
  if (entitlement.revokedAt !== null) return false;
  if (new Date(entitlement.startsAt) > now) return false;
  if (entitlement.endsAt !== null && new Date(entitlement.endsAt) < now) return false;
  return true;
}

/**
 * Checks if an order state transition is valid (monotonic forward only).
 */
const VALID_ORDER_TRANSITIONS: Record<OrderState, OrderState[]> = {
  CREATED: ['CHECKOUT_PENDING', 'CANCELED'],
  CHECKOUT_PENDING: ['PAID', 'EXPIRED', 'CANCELED'],
  PAID: ['PARTIALLY_REFUNDED', 'REFUNDED', 'CHARGEBACK'],
  EXPIRED: [],
  CANCELED: [],
  PARTIALLY_REFUNDED: ['REFUNDED', 'CHARGEBACK'],
  REFUNDED: [],
  CHARGEBACK: [],
};

export function isValidOrderTransition(from: OrderState, to: OrderState): boolean {
  return VALID_ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Returns whether a paid order grants an entitlement.
 */
export function orderGrantsEntitlement(state: OrderState): boolean {
  return state === 'PAID' || state === 'PARTIALLY_REFUNDED';
}

/**
 * Scoring: calculates points for an attempt given answers.
 */
export function scoreAttempt(
  questions: Array<{ id: string; correctChoiceKeys: string[]; points: number }>,
  answers: Array<{ questionId: string; selectedKeys: string[] }>,
): { totalPoints: number; earnedPoints: number; percentage: number } {
  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
  let earnedPoints = 0;

  for (const q of questions) {
    const answer = answers.find(a => a.questionId === q.id);
    if (!answer) continue;
    const correct = new Set(q.correctChoiceKeys);
    const selected = new Set(answer.selectedKeys);
    // Exact match required for full points
    if (selected.size === correct.size && [...selected].every(k => correct.has(k))) {
      earnedPoints += q.points;
    }
  }

  return {
    totalPoints,
    earnedPoints,
    percentage: totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0,
  };
}
