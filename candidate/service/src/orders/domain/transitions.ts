import { OrderStatus } from './order-status.enum';

/**
 * T-04: Authoritative state transition map (SPEC.md §6)
 * IMMUTABLE constant - zero runtime modifications allowed
 * Structure: Record<currentStatus, Set<allowedNextStatuses>>
 */
export const VALID_TRANSITIONS: Readonly<Record<OrderStatus, ReadonlySet<OrderStatus>>> = {
  [OrderStatus.RECEIVED]: new Set([OrderStatus.ACCEPTED, OrderStatus.REJECTED]),
  [OrderStatus.ACCEPTED]: new Set([OrderStatus.IN_PROGRESS, OrderStatus.REJECTED]),
  [OrderStatus.IN_PROGRESS]: new Set([OrderStatus.COMPLETED]),
  [OrderStatus.COMPLETED]: new Set(),
  [OrderStatus.REJECTED]: new Set(),
} as const;

/**
 * T-04: Pure validation function (zero side-effects, no I/O)
 * @returns true ONLY for explicitly allowed transitions in VALID_TRANSITIONS
 */
export function isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
  return VALID_TRANSITIONS[from]?.has(to) ?? false;
}
