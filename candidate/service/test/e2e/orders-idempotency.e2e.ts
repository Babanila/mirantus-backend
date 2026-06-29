import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { createTestingApp } from '../app-factory';
import { truncateTables, verifySchema } from '../database-setup';
import { OrderPriority } from '../../src/orders/domain/order-priority.enum';
import { OrderStatus } from '../../src/orders/domain/order-status.enum';

type Server = ReturnType<INestApplication['getHttpServer']>;

const BASE_PAYLOAD = {
  partnerId: 't24-concurrent-test',
  patientReference: 'T24-PAT-REF',
  requestedLocation: 'T24-LOCATION',
  priority: OrderPriority.ROUTINE,
};

const CONCURRENT_REQUESTS = 5;
const TEST_TIMEOUT = 60000;

describe('Orders — Concurrent Idempotency (Integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let server: Server;

  beforeAll(async () => {
    app = await createTestingApp();
    server = app.getHttpServer();
    dataSource = app.get(DataSource);

    await verifySchema(dataSource);
  }, TEST_TIMEOUT);

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateTables(dataSource, ['orders']);
  });

  it('should return 200 (not 201) for duplicate request with identical payload', async () => {
    const idempotencyKey = `t24-dup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const firstRes = await request(server)
      .post('/orders')
      .set('Idempotency-Key', idempotencyKey)
      .send(BASE_PAYLOAD)
      .expect(201);

    const secondRes = await request(server)
      .post('/orders')
      .set('Idempotency-Key', idempotencyKey)
      .send(BASE_PAYLOAD)
      .expect(200);

    expect(secondRes.body.id).toBe(firstRes.body.id);
    expect(secondRes.body).toEqual(firstRes.body);
  }, 30000);

  it('should return 409 Conflict when same idempotency key reused with different payload', async () => {
    const idempotencyKey = `t24-conflict-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await request(server)
      .post('/orders')
      .set('Idempotency-Key', idempotencyKey)
      .send(BASE_PAYLOAD)
      .expect(201);

    const modifiedPayload = {
      ...BASE_PAYLOAD,
      patientReference: `MODIFIED-${Date.now()}`,
    };

    const conflictRes = await request(server)
      .post('/orders')
      .set('Idempotency-Key', idempotencyKey)
      .send(modifiedPayload)
      .expect(409);

    expect(conflictRes.body).toMatchObject({
      statusCode: 409,
      message: expect.stringContaining('different request payload'),
      timestamp: expect.any(String),
      path: '/orders',
    });

    // Verify single row exists
    const [{ count }] = await dataSource.query(
      `SELECT COUNT(*) FROM orders WHERE idempotency_key = $1`,
      [idempotencyKey],
    );
    expect(parseInt(count, 10)).toBe(1);
  }, 30000);

  it(
    `should create exactly one order when ${CONCURRENT_REQUESTS} concurrent requests use the same idempotency key`,
    async () => {
      const idempotencyKey = uuidv4();

      // Added jitter: Prevents thundering herd effect on CI runners
      // while maintaining true concurrency validation
      const responses = await Promise.all<request.Response>(
        Array.from(
          { length: CONCURRENT_REQUESTS },
          (_, i) =>
            new Promise<request.Response>((resolve) => {
              setTimeout(() => {
                resolve(
                  request(server)
                    .post('/orders')
                    .set('Idempotency-Key', idempotencyKey)
                    .send(BASE_PAYLOAD),
                );
              }, i * 10);
            }),
        ),
      );

      // HTTP Assertions
      const created = responses.filter((r) => r.status === 201);
      const replayed = responses.filter((r) => r.status === 200);
      const failed = responses.filter((r) => r.status >= 400);

      expect(created).toHaveLength(1);
      expect(replayed).toHaveLength(CONCURRENT_REQUESTS - 1);
      expect(failed).toHaveLength(0);

      // Every response must reference the exact same order
      const ids = [...new Set(responses.map((r) => r.body.id))];

      expect(ids).toHaveLength(1);

      const createdBody = created[0].body;

      for (const response of replayed) {
        expect(response.body).toEqual(createdBody);
      }

      // Database Assertions
      const [result] = await dataSource.query(
        `
        SELECT
          COUNT(*)::int AS total,
          COUNT(DISTINCT id)::int AS unique_ids,
          COUNT(DISTINCT payload_hash)::int AS unique_hashes
        FROM orders
        WHERE idempotency_key = $1
        `,
        [idempotencyKey],
      );

      expect(result).toEqual({
        total: 1,
        unique_ids: 1,
        unique_hashes: 1,
      });

      // Verify persisted row
      const [order] = await dataSource.query(
        `
        SELECT
          id,
          partner_id,
          status
        FROM orders
        WHERE idempotency_key = $1
        `,
        [idempotencyKey],
      );

      expect(order).toMatchObject({
        id: ids[0],
        partner_id: BASE_PAYLOAD.partnerId,
        status: OrderStatus.RECEIVED,
      });
    },
    TEST_TIMEOUT,
  );

  it('should handle requests without idempotency key independently', async () => {
    const res1 = await request(server).post('/orders').send(BASE_PAYLOAD).expect(201);
    const res2 = await request(server).post('/orders').send(BASE_PAYLOAD).expect(201);

    expect(res1.body.id).not.toBe(res2.body.id);

    const [{ count }] = await dataSource.query(
      `SELECT COUNT(*) FROM orders WHERE partner_id = $1 AND patient_reference = $2`,
      [BASE_PAYLOAD.partnerId, BASE_PAYLOAD.patientReference],
    );
    expect(parseInt(count, 10)).toBe(2);
  }, 30000);
});
