import { createHash } from 'node:crypto';

/**
 * T-05: Deterministic SHA-256 hash for idempotency conflict detection
 * NORMALIZATION RULES (critical for idempotency):
 * 1. Exclude all undefined values (optional fields)
 * 2. Sort keys alphabetically (order-independent hashing)
 * 3. No whitespace in JSON string (compact representation)
 *
 * @param dto - Flat DTO object (matches CreateOrderDto structure)
 * @returns 64-character lowercase hex string (SHA-256)
 *
 * * @example
 * hashPayload({ b: '2', a: '1' }) === hashPayload({ a: '1', b: '2' }) // → true
 * hashPayload({ a: '1' }) !== hashPayload({ a: '2' }) // → true
 */
export function hashPayload(dto: Record<string, unknown>): string {
  // Normalize: remove undefined values + sort keys alphabetically
  const normalized = JSON.stringify(
    Object.fromEntries(
      Object.entries(dto)
        .filter(([, value]) => value !== undefined) // Exclude undefined values
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB)), // Deterministic key order
    ),
  );

  // Generate SHA-256 hash as hex string
  return createHash('sha256').update(normalized).digest('hex');
}
