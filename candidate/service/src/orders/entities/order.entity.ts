import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrderPriority } from '../domain/order-priority.enum';
import { OrderStatus } from '../domain/order-status.enum';

/**
 * T-07: Order entity mapping SPEC.md §5 schema EXACTLY
 * CRITICAL VALIDATIONS:
 * - timestamptz (NOT timestamp) for timezone safety
 * - idempotency_key/payload_hash nullable: true
 * - UNIQUE constraint on idempotency_key
 * - CHECK constraints implied via enum types
 *
 */
@Entity('orders')
export class OrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'idempotency_key',
    type: 'varchar',
    length: 512,
    nullable: true,
    unique: true,
    comment: 'Client-provided key for idempotency (SPEC.md §7)',
  })
  idempotencyKey: string | null;

  @Column({
    name: 'partner_id',
    type: 'varchar',
    length: 255,
    comment: 'External partner identifier (SPEC.md §5)',
  })
  partnerId: string;

  @Column({
    name: 'patient_reference',
    type: 'varchar',
    length: 255,
    comment: "Partner's patient identifier (SPEC.md §5)",
  })
  patientReference: string;

  @Column({
    name: 'requested_location',
    type: 'varchar',
    length: 255,
    comment: 'Physical location for screening (SPEC.md §5)',
  })
  requestedLocation: string;

  @Column({
    type: 'varchar',
    length: 20,
    comment: 'Order priority level (SPEC.md §5)',
  })
  priority: OrderPriority;

  @Column({
    type: 'varchar',
    length: 20,
    default: OrderStatus.RECEIVED,
    comment: 'Current lifecycle status (SPEC.md §6)',
  })
  status: OrderStatus;

  @Column({
    name: 'payload_hash',
    type: 'varchar',
    length: 64,
    nullable: true,
    comment: 'SHA-256 of normalized payload for conflict detection (SPEC.md §7)',
  })
  payloadHash: string | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz', // 🚨 MUST be timestamptz (timezone-aware)
    comment: 'UTC creation timestamp (SPEC.md §5)',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz', // 🚨 MUST be timestamptz (timezone-aware)
    comment: 'UTC last update timestamp (SPEC.md §5)',
  })
  updatedAt: Date;
}
