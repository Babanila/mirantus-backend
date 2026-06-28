import { OrderResource, OrderStatus, OrderPriority } from './index';

// This should compile without errors
const validOrder: OrderResource = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  partnerId: 'partner-123',
  patientReference: 'patient-456',
  requestedLocation: 'New York Lab',
  priority: OrderPriority.ROUTINE,
  status: OrderStatus.RECEIVED,
  createdAt: '2026-06-27T10:00:00.000Z',
  updatedAt: '2026-06-27T10:00:00.000Z',
};

// Enum value checks
const routine: OrderPriority = OrderPriority.ROUTINE;
const urgent: OrderPriority = OrderPriority.URGENT;

const received: OrderStatus = OrderStatus.RECEIVED;
const accepted: OrderStatus = OrderStatus.ACCEPTED;
const inProgress: OrderStatus = OrderStatus.IN_PROGRESS;
const completed: OrderStatus = OrderStatus.COMPLETED;
const rejected: OrderStatus = OrderStatus.REJECTED;

console.log('Type check passed');
console.log('Order:', validOrder);
console.log('Priorities:', { routine, urgent });
console.log('Statuses:', { received, accepted, inProgress, completed, rejected });
