// Shared domain types for the Screening Order Service test-harness.
// These mirror the API contract documented in README.md. The candidate's
// service is the source of truth; the harness degrades gracefully if a
// response differs from what is described here.

export const ORDER_STATUSES = [
  'received',
  'accepted',
  'in_progress',
  'completed',
  'rejected',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_PRIORITIES = ['routine', 'urgent'] as const;

export type OrderPriority = (typeof ORDER_PRIORITIES)[number];

export interface Order {
  id: string;
  partnerId: string;
  patientReference: string;
  requestedLocation: string;
  priority: OrderPriority;
  status: OrderStatus;
  // The service may include additional fields (timestamps, etc.); they are
  // ignored by the harness but visible in the debug panel.
  [key: string]: unknown;
}

export interface CreateOrderInput {
  partnerId: string;
  patientReference: string;
  requestedLocation: string;
  priority: OrderPriority;
}

// A single record of an API interaction, surfaced in the debug panel so the
// candidate can see exactly what their service returned.
export interface DebugEntry {
  id: string;
  at: string;
  method: string;
  url: string;
  requestHeaders?: Record<string, string>;
  requestBody?: unknown;
  status?: number;
  ok: boolean;
  responseBody?: unknown;
  error?: string;
}
