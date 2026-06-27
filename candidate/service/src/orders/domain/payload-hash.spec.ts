import { hashPayload } from './payload-hash';

/**
 * T-05: Exhaustive tests for payload hashing behavior
 * Critical for idempotency conflict detection (T-10, T-21, T-24)
 */
describe('hashPayload', () => {
  describe('Normalization behavior', () => {
    it('produces identical hash for same payload with different key order', () => {
      const hash1 = hashPayload({ b: '2', a: '1', c: '3' });
      const hash2 = hashPayload({ c: '3', a: '1', b: '2' });
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex length
    });

    it('excludes undefined values from hash calculation', () => {
      const hash1 = hashPayload({ a: '1', b: undefined, c: '3' });
      const hash2 = hashPayload({ a: '1', c: '3' });
      expect(hash1).toBe(hash2);
    });

    it('treats missing keys and undefined keys identically', () => {
      const hash1 = hashPayload({ partnerId: 'p1', patientReference: 'ref1' });
      const hash2 = hashPayload({
        partnerId: 'p1',
        patientReference: 'ref1',
        requestedLocation: undefined,
      });
      expect(hash1).toBe(hash2);
    });
  });

  describe('Hash uniqueness', () => {
    it('different payloads produce different hashes', () => {
      const hash1 = hashPayload({ a: '1' });
      const hash2 = hashPayload({ a: '2' });
      expect(hash1).not.toBe(hash2);
    });

    it('different values for same key produce different hashes', () => {
      const hash1 = hashPayload({ partnerId: 'partner-a' });
      const hash2 = hashPayload({ partnerId: 'partner-b' });
      expect(hash1).not.toBe(hash2);
    });

    it('additional defined field changes hash', () => {
      const hash1 = hashPayload({ partnerId: 'p1' });
      const hash2 = hashPayload({ partnerId: 'p1', patientReference: 'ref1' });
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Output format', () => {
    it('always returns 64-character lowercase hex string', () => {
      const hash = hashPayload({
        partnerId: 'test',
        patientReference: 'ref',
        requestedLocation: 'loc',
        priority: 'routine',
      });

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/); // Only hex characters
    });

    it('empty object produces valid hash', () => {
      const hash = hashPayload({});
      expect(hash).toHaveLength(64);
      expect(hash).toBe('44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a'); // SHA-256 of empty string
    });
  });

  describe('Pure function guarantees', () => {
    it('same input always produces identical output (determinism)', () => {
      const input = {
        partnerId: 'p1',
        patientReference: 'ref1',
        requestedLocation: 'loc1',
        priority: 'urgent',
      };

      const hashes = Array.from({ length: 10 }, () => hashPayload(input));
      hashes.forEach((hash) => expect(hash).toBe(hashes[0]));
    });

    it('no side effects (does not mutate input)', () => {
      const input = { a: '1', b: undefined, c: '2' };
      const originalKeys = Object.keys(input).sort();

      hashPayload(input);

      expect(Object.keys(input).sort()).toEqual(originalKeys);
      expect(input.b).toBeUndefined(); // Still undefined
    });
  });

  // CRITICAL REAL-WORLD TEST (matches CreateOrderDto structure from T-09)
  describe('CreateOrderDto compatibility', () => {
    it('normalizes realistic order payloads correctly', () => {
      // Scenario: Two requests with same data but different field order
      const payloadA = {
        partnerId: 'mirantus-hospital',
        patientReference: 'PAT-789',
        requestedLocation: 'Lab 3B',
        priority: 'urgent',
      };

      const payloadB = {
        requestedLocation: 'Lab 3B',
        priority: 'urgent',
        patientReference: 'PAT-789',
        partnerId: 'mirantus-hospital',
      };

      expect(hashPayload(payloadA)).toBe(hashPayload(payloadB));
    });

    it('detects payload mismatch with same idempotency key', () => {
      const original = {
        partnerId: 'p1',
        patientReference: 'ref1',
        requestedLocation: 'loc1',
        priority: 'routine',
      };

      const modified = {
        ...original,
        priority: 'urgent', // Changed value
      };

      expect(hashPayload(original)).not.toBe(hashPayload(modified));
    });
  });

  describe('T-21 Critical Verification', () => {
    it('EXACT requirement: { b: "2", a: "1" } === { a: "1", b: "2" }', () => {
      const hash1 = hashPayload({ b: '2', a: '1' });
      const hash2 = hashPayload({ a: '1', b: '2' });
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // 64-char hex
    });

    it('EXACT requirement: { a: "1" } !== { a: "2" }', () => {
      const hash1 = hashPayload({ a: '1' });
      const hash2 = hashPayload({ a: '2' });
      expect(hash1).not.toBe(hash2);
    });

    it('Output is ALWAYS 64-character lowercase hex string', () => {
      const hash = hashPayload({
        partnerId: 'test',
        patientReference: 'ref',
        requestedLocation: 'loc',
        priority: 'routine',
      });
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(hash).toBe(hash.toLowerCase());
    });

    it('Pure function: Zero side effects on input object', () => {
      const input = { a: '1', b: undefined, c: '2' };
      const originalKeys = Object.keys(input).sort();
      const originalValues = { ...input };

      hashPayload(input);

      expect(Object.keys(input).sort()).toEqual(originalKeys);
      expect(input).toEqual(originalValues);
      expect(input.b).toBeUndefined();
    });
  });
});
