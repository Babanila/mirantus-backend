import { OrderPriority } from './order-priority.enum';
import { OrderStatus } from './order-status.enum';

/**
 * T-03: PUBLIC API RESPONSE SHAPE (SPEC.md §5)
 * CRITICAL: Must NOT include internal fields (idempotencyKey, payloadHash)
 * Used by: Service layer (T-10-T-13), Response DTO (T-09), Controller (T-16)
 */
export interface OrderResource {
  id: string;
  partnerId: string;
  patientReference: string;
  requestedLocation: string;
  priority: OrderPriority; // Serialized as string in JSON response
  status: OrderStatus;     // Serialized as string in JSON response
  createdAt: string;       // ISO8601 UTC string (e.g., "2026-06-27T10:00:00.000Z")
  updatedAt: string;       // ISO8601 UTC string
}
