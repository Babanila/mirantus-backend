import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial migration — creates the `orders` table.
 *
 * Schema (SPEC.md §5):
 * - UUID primary key
 * - idempotency_key: unique, nullable — enforces at-most-once insert at DB level
 * - payload_hash: nullable — SHA-256 of normalised CreateOrderDto
 * - priority / status: varchar with CHECK constraints matching enum values
 * - created_at / updated_at: TIMESTAMPTZ (timezone-aware UTC)
 *
 * Indices (SPEC.md §5):
 * - idx_orders_partner_id         — filter by partner
 * - idx_orders_status             — filter by status
 * - idx_orders_created_at         — default sort (DESC)
 * - idx_orders_partner_status     — composite filter + sort
 *
 * down() fully reverses up() — drops indices then the table.
 */
export class CreateOrdersTable1719482400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create Table
    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id"                 UUID          NOT NULL DEFAULT gen_random_uuid(),
        "idempotency_key"    VARCHAR(512)  DEFAULT NULL,
        "partner_id"         VARCHAR(255)  NOT NULL,
        "patient_reference"  VARCHAR(255)  NOT NULL,
        "requested_location" VARCHAR(255)  NOT NULL,
        "priority"           VARCHAR(20)   NOT NULL,
        "status"             VARCHAR(20)   NOT NULL DEFAULT 'received',
        "payload_hash"       VARCHAR(64)   DEFAULT NULL,
        "created_at"         TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "updated_at"         TIMESTAMPTZ   NOT NULL DEFAULT now(),

        CONSTRAINT "PK_orders_id"
          PRIMARY KEY ("id"),

        CONSTRAINT "UQ_orders_idempotency_key"
          UNIQUE ("idempotency_key"),

        CONSTRAINT "CHK_orders_priority"
          CHECK ("priority" IN ('routine', 'urgent')),

        CONSTRAINT "CHK_orders_status"
          CHECK ("status" IN ('received', 'accepted', 'in_progress', 'completed', 'rejected'))
      )
    `);

    // INDICES
    await queryRunner.query(`
      CREATE INDEX "idx_orders_partner_id"
        ON "orders" ("partner_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_orders_status"
        ON "orders" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_orders_created_at"
        ON "orders" ("created_at" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_orders_partner_status"
        ON "orders" ("partner_id", "status", "created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indices first, then the table — reverse order of up()
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_orders_partner_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_orders_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_orders_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_orders_partner_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "orders"`);
  }
}
