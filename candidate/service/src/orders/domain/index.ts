/**
 * Domain module barrel export.
 * Pure types and enums with no external dependencies.
 */
export { OrderStatus } from './order-status.enum';
export { OrderPriority } from './order-priority.enum';
export { OrderResource } from './order.types';
export { isValidTransition, VALID_TRANSITIONS } from './transitions';
export { hashPayload } from './payload-hash';
