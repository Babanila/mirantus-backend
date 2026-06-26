import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { OrderEntity } from './entities/order.entity';
import { isValidTransition } from './domain/transitions';
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
   * T-12: Retrieve single order by ID
   * CRITICAL REQUIREMENTS:
   * - Throws NotFoundException with EXACT message "Order not found"
   * - Never returns null/undefined (Promise<OrderEntity> guarantee)
   * - No logging (PII safety - patientReference would leak)
   *
   * @param id - UUID string of order to retrieve
   * @returns OrderEntity if found
   * @throws NotFoundException if order does not exist (maps to 404 in controller)
   */
  async findOne(id: string): Promise<OrderEntity> {
    const order = await this.repo.findOneBy({ id });
    if (!order) {
      throw new NotFoundException('Order not found'); // EXACT message per TASKS.md
    }
    return order;
  }

  /**
   * T-13: Transition order status with Compare-and-Swap (CAS) protection
   * CRITICAL IMPLEMENTATION CONSTRAINTS (SPEC.md §6):
   * 1. NEVER simplify to findOne + save (lost update race condition)
   * 2. UPDATE includes AND status = :expectedStatus in WHERE clause
   * 3. Zero affected rows → re-fetch and throw ConflictException
   * 4. Error message MUST include both from/to status names
   * 5. updatedAt updated automatically by @UpdateDateColumn (no manual set)
   *
   * @param id - Order UUID
   * @param newStatus - Target status to transition to
   * @returns Updated order entity
   * @throws ConflictException if invalid transition OR concurrent update detected
   * @throws NotFoundException if order does not exist
   */
  async transitionStatus(id: string, newStatus: OrderStatus): Promise<OrderEntity> {
    // Step 1: Fetch current order (validates existence, throws 404 if missing)
    const current = await this.findOne(id); // Uses T-12 method (throws NotFoundException)

    // Step 2: Validate transition BEFORE any DB write (fail fast)
    if (!isValidTransition(current.status, newStatus)) {
      throw new ConflictException(
        `Invalid status transition from '${current.status}' to '${newStatus}'`,
      );
    }

    // Step 3: CAS UPDATE - Only succeeds if status unchanged since Step 1
    // CRITICAL: WHERE clause includes expectedStatus to prevent lost updates
    const result = await this.repo
      .createQueryBuilder()
      .update(OrderEntity)
      .set({ status: newStatus }) // TypeORM auto-updates updatedAt via @UpdateDateColumn
      .where('id = :id AND status = :expectedStatus', {
        id,
        expectedStatus: current.status, // ← CAS protection: fails if status changed concurrently
      })
      .returning('*') // Return updated row for immediate use
      .execute();

    // Step 4: Handle CAS failure (concurrent update detected)
    if (result.affected === 0) {
      // Re-fetch to determine actual current state
      const refetched = await this.repo.findOneBy({ id });
      if (!refetched) {
        throw new NotFoundException('Order not found'); // Deleted after initial read
      }

      // CRITICAL: Error message includes BOTH status values (SPEC.md §8.4 requirement)
      throw new ConflictException(
        `Concurrent update detected — status is now '${refetched.status}' (was '${current.status}')`,
      );
    }

    // Step 5: Return updated entity from database (not modified current)
    // TypeORM returns raw array in result.raw for PostgreSQL
    return result.raw[0] as OrderEntity;
  }
}
