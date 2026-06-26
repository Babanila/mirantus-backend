import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { OrderStatus } from '../domain/order-status.enum';

/**
 * DTO for GET /orders query parameters.
 *
 * Validation rules (SPEC.md §9):
 * - All fields are optional
 * - status must be a valid OrderStatus enum value if provided
 * - page and pageSize are 1-indexed integers with sensible bounds
 * - @Type(() => Number) coerces query string values from string to number
 *   Without this, '1' arrives as string '1' — @IsInt() passes but
 *   arithmetic downstream breaks silently.
 */
export class ListOrdersQueryDto {
  @IsOptional()
  @IsEnum(OrderStatus, { message: 'status must be a valid OrderStatus value' })
  status?: OrderStatus;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'partnerId filter must not exceed 255 characters' })
  partnerId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be an integer' })
  @Min(1, { message: 'page must be at least 1' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize must be an integer' })
  @Min(1, { message: 'pageSize must be at least 1' })
  @Max(100, { message: 'pageSize must not exceed 100' })
  pageSize?: number = 20;
}
