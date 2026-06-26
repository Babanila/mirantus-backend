/**
 * T-03: Order priority levels
 * STRING VALUES MUST MATCH DATABASE COLUMN VALUES EXACTLY (SPEC.md §5)
 * Used by: Entity (T-07), DTOs (T-09)
 */
export enum OrderPriority {
  ROUTINE = 'routine',
  URGENT = 'urgent',
}
