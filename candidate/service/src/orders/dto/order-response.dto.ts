import { Exclude, Expose } from 'class-transformer';
import { OrderEntity } from '../entities/order.entity';

/**
 * DTO for serialising an OrderEntity into a public API response.
 *
 * Field exclusion strategy (SPEC.md §5):
 * - @Exclude() on the class excludes ALL fields by default
 * - @Expose() on permitted fields allows only those through
 * - idempotencyKey and payloadHash are intentionally NOT exposed
 *
 * Timestamp serialisation:
 * - createdAt and updatedAt are converted from Date → ISO8601 UTC string
 *   via .toISOString() in the constructor.
 * - This guarantees the "Z" suffix (UTC) regardless of the database
 *   server timezone.
 *
 * Usage:
 *   return new OrderResponseDto(orderEntity);
 *
 * With ClassSerializerInterceptor registered globally, @Expose() fields
 * are included and all others are stripped from the response.
 */
@Exclude()
export class OrderResponseDto {
  @Expose() id: string;
  @Expose() partnerId: string;
  @Expose() patientReference: string;
  @Expose() requestedLocation: string;
  @Expose() priority: string;
  @Expose() status: string;
  @Expose() createdAt: string;
  @Expose() updatedAt: string;

  constructor(partial: Partial<OrderEntity>) {
    Object.assign(this, partial);

    // Convert Date objects to ISO8601 UTC strings (required by SPEC.md §5)
    if (partial.createdAt instanceof Date) {
      this.createdAt = partial.createdAt.toISOString();
    } else if (typeof partial.createdAt === 'string') {
      this.createdAt = partial.createdAt;
    } else {
      this.createdAt = '';
    }

    if (partial.updatedAt instanceof Date) {
      this.updatedAt = partial.updatedAt.toISOString();
    } else if (typeof partial.updatedAt === 'string') {
      this.updatedAt = partial.updatedAt;
    } else {
      this.updatedAt = '';
    }
  }
}
