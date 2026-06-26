import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { OrderPriority } from '../domain/order-priority.enum';

/**
 * DTO for POST /orders request body.
 *
 * Validation rules (SPEC.md §9):
 * - All fields are required — no optional fields
 * - String fields have MaxLength to prevent oversized payloads
 * - priority must be a valid OrderPriority enum value
 *
 * Unknown fields are rejected by the global ValidationPipe
 * (forbidNonWhitelisted: true set in main.ts — T-14).
 */
export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255, { message: 'partnerId must not exceed 255 characters' })
  partnerId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255, { message: 'patientReference must not exceed 255 characters' })
  patientReference: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255, { message: 'requestedLocation must not exceed 255 characters' })
  requestedLocation: string;

  @IsEnum(OrderPriority, { message: 'priority must be "routine" or "urgent"' })
  priority: OrderPriority;
}
