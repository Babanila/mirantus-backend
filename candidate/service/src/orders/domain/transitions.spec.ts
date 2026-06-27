import { isValidTransition, VALID_TRANSITIONS } from './transitions';
import { OrderStatus } from './order-status.enum';

/**
 * T-20: EXHAUSTIVE state machine tests covering ALL 20 SPEC.md §6 transitions
 * CRITICAL VERIFICATIONS:
 * - Exactly 5 allowed transitions pass
 * - Exactly 15 disallowed transitions fail (including in_progress → rejected)
 * - Explicit standalone test for critical edge case (TASKS.md Agent Note)
 * - Zero dependencies on external systems (pure unit tests)
 */
describe('State Machine Validator', () => {
  describe('isValidTransition - ALLOWED transitions (5 cases)', () => {
    it.each<[OrderStatus, OrderStatus]>([
      [OrderStatus.RECEIVED, OrderStatus.ACCEPTED],
      [OrderStatus.RECEIVED, OrderStatus.REJECTED],
      [OrderStatus.ACCEPTED, OrderStatus.IN_PROGRESS],
      [OrderStatus.ACCEPTED, OrderStatus.REJECTED],
      [OrderStatus.IN_PROGRESS, OrderStatus.COMPLETED],
    ])('allows %s → %s', (from, to) => {
      expect(isValidTransition(from, to)).toBe(true);
    });
  });

  describe('isValidTransition - DISALLOWED transitions (15 cases)', () => {
    it.each<[OrderStatus, OrderStatus]>([
      // From RECEIVED (2 invalid)
      [OrderStatus.RECEIVED, OrderStatus.IN_PROGRESS],
      [OrderStatus.RECEIVED, OrderStatus.COMPLETED],
      // From ACCEPTED (2 invalid)
      [OrderStatus.ACCEPTED, OrderStatus.RECEIVED],
      [OrderStatus.ACCEPTED, OrderStatus.COMPLETED],
      // CRITICAL: From IN_PROGRESS (3 invalid - including rejected)
      [OrderStatus.IN_PROGRESS, OrderStatus.REJECTED], // ← TASKS.md Agent Note focus
      [OrderStatus.IN_PROGRESS, OrderStatus.RECEIVED],
      [OrderStatus.IN_PROGRESS, OrderStatus.ACCEPTED],
      // From COMPLETED (4 invalid)
      [OrderStatus.COMPLETED, OrderStatus.RECEIVED],
      [OrderStatus.COMPLETED, OrderStatus.ACCEPTED],
      [OrderStatus.COMPLETED, OrderStatus.IN_PROGRESS],
      [OrderStatus.COMPLETED, OrderStatus.REJECTED],
      // From REJECTED (4 invalid)
      [OrderStatus.REJECTED, OrderStatus.RECEIVED],
      [OrderStatus.REJECTED, OrderStatus.ACCEPTED],
      [OrderStatus.REJECTED, OrderStatus.IN_PROGRESS],
      [OrderStatus.REJECTED, OrderStatus.COMPLETED],
    ])('rejects %s → %s', (from, to) => {
      expect(isValidTransition(from, to)).toBe(false);
    });

    // EXPLICIT CRITICAL VERIFICATION (TASKS.md Agent Note requirement)
    it('explicitly rejects in_progress → rejected (common implementation error)', () => {
      expect(isValidTransition(OrderStatus.IN_PROGRESS, OrderStatus.REJECTED)).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('returns false for invalid status values', () => {
      expect(
        isValidTransition('invalid_status' as unknown as OrderStatus, OrderStatus.ACCEPTED),
      ).toBe(false);
      expect(
        isValidTransition(OrderStatus.RECEIVED, 'invalid_status' as unknown as OrderStatus),
      ).toBe(false);
    });

    it('is pure function (deterministic output)', () => {
      const result1 = isValidTransition(OrderStatus.RECEIVED, OrderStatus.ACCEPTED);
      const result2 = isValidTransition(OrderStatus.RECEIVED, OrderStatus.ACCEPTED);
      expect(result1).toBe(result2);
      expect(result1).toBe(true);
    });

    it('transition map structure matches specification', () => {
      // Verify RECEIVED has exactly 2 allowed transitions
      expect([...VALID_TRANSITIONS[OrderStatus.RECEIVED]]).toEqual(
        expect.arrayContaining([OrderStatus.ACCEPTED, OrderStatus.REJECTED]),
      );
      expect([...VALID_TRANSITIONS[OrderStatus.RECEIVED]].length).toBe(2);

      // Verify IN_PROGRESS has ONLY completed (critical for rejection test)
      expect([...VALID_TRANSITIONS[OrderStatus.IN_PROGRESS]]).toEqual([OrderStatus.COMPLETED]);

      // Verify terminal states have no transitions
      expect([...VALID_TRANSITIONS[OrderStatus.COMPLETED]]).toHaveLength(0);
      expect([...VALID_TRANSITIONS[OrderStatus.REJECTED]]).toHaveLength(0);
    });
  });
});
