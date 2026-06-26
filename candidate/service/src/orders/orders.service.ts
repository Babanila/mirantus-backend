import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { OrderEntity } from './entities/order.entity';
import { OrderStatus } from './domain/order-status.enum';
import { hashPayload } from './domain/payload-hash';

/**
 * T-10: OrdersService with idempotency-safe create()
 * CRITICAL IMPLEMENTATION CONSTRAINTS (SPEC.md §7):
 * 1. NO pre-insert SELECT query (race condition prevention)
 * 2. UNIQUE constraint is the lock (database-enforced)
 * 3. Handle violation ONLY in catch block
 * 4. Payload hash comparison for conflict detection
 */
@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly repo: Repository<OrderEntity>,
  ) {}

  /**
   * Creates a new order with idempotency key protection
   * @param dto - Order creation payload
   * @param idempotencyKey - Optional client-provided idempotency key
   * @returns { order, created } - created=true for new orders, false for replays
   * @throws ConflictException if same key used with different payload
   */
  async create(
    dto: CreateOrderDto,
    idempotencyKey?: string,
  ): Promise<{ order: OrderEntity; created: boolean }> {
    // Compute payload hash BEFORE insert (required for conflict detection)
    const payloadHash = hashPayload(dto as unknown as Record<string, unknown>);

    try {
      // ATOMIC INSERT: Attempt to create order with idempotency key
      // UNIQUE constraint on idempotency_key enforces idempotency at DB level
      const entity = this.repo.create({
        ...dto,
        idempotencyKey: idempotencyKey ?? null, // NULL if not provided (allows multiple NULLs)
        payloadHash,
        status: OrderStatus.RECEIVED, // Initial lifecycle state
      });

      const order = await this.repo.save(entity);
      return { order, created: true };
    } catch (err: unknown) {
      // Handle ONLY unique violation errors (PostgreSQL error code 23505)
      if (this.isUniqueViolation(err)) {
        // Safety check: Should not occur without idempotencyKey
        if (!idempotencyKey) {
          throw err; // Re-throw unexpected unique violation
        }

        // Fetch existing order using idempotency key
        const existing = await this.repo.findOneByOrFail({ idempotencyKey });

        // CRITICAL: Detect payload mismatch (same key, different request)
        if (existing.payloadHash !== payloadHash) {
          throw new ConflictException(
            `Idempotency-Key '${idempotencyKey}' has already been used with a different request payload`,
          );
        }

        // Replay detected: Return existing order
        return { order: existing, created: false };
      }

      // Re-throw all other errors (connection issues, etc.)
      throw err;
    }
  }

  /**
   * T-11: Paginated order listing with optional filters
   * CRITICAL IMPLEMENTATION DETAILS:
   * - 1-indexed pages: skip = (page - 1) * pageSize
   * - Filters combined with AND logic
   * - Empty results return { data: [], total: 0 } (never throws 404)
   * - Default sort: createdAt DESC
   *
   * @param query - Filter and pagination parameters
   * @returns Paginated result envelope with metadata
   */
  async findAll(query: ListOrdersQueryDto): Promise<{
    data: OrderEntity[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    // Destructure with explicit defaults (DTO provides defaults but we reinforce here)
    const { status, partnerId, page = 1, pageSize = 20 } = query;

    // Build TypeORM where condition with AND logic
    const where: FindOptionsWhere<OrderEntity> = {};
    if (status !== undefined) where.status = status;
    if (partnerId !== undefined) where.partnerId = partnerId;

    // Execute query with pagination and sorting
    const [data, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' }, // SPEC.md §5: Most recent first
      skip: (page - 1) * pageSize, // CRITICAL: 1-indexed page conversion
      take: pageSize,
    });

    return {
      data,
      total,
      page,
      pageSize,
    };
  }

  /**
   * Checks if error is PostgreSQL unique violation (error code 23505)
   * @param err - Unknown error object
   * @returns true if unique constraint violation
   */
  private isUniqueViolation(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === '23505' // PostgreSQL unique_violation
    );
  }
}
