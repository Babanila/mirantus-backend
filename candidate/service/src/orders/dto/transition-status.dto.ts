import { IsEnum } from 'class-validator';
import { OrderStatus } from '../domain/order-status.enum';

/**
 * DTO for PATCH /orders/:id/status request body.
 *
 * Validation rules (SPEC.md §9):
 * - status is required
 * - must be a valid OrderStatus enum value
 *
 * Business rule validation (valid transition) is enforced
 * at the service layer via isValidTransition() — not here.
 * The DTO only validates that the value is a known status string.
 */
export class TransitionStatusDto {
  @IsEnum(OrderStatus, {
    message: 'status must be one of: received, accepted, in_progress, completed, rejected',
  })
  status: OrderStatus;
}
