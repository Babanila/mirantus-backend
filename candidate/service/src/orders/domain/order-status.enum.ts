/**
 * T-03: Order status lifecycle states
 * STRING VALUES MUST MATCH DATABASE COLUMN VALUES EXACTLY (SPEC.md §5)
 * Used by: Entity (T-07), State Machine (T-04), DTOs (T-09)
 */
export enum OrderStatus {
  RECEIVED = 'received',
  ACCEPTED = 'accepted',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
}
