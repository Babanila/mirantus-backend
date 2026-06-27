import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateOrderDto } from './create-order.dto';
import { ListOrdersQueryDto } from './list-orders-query.dto';
import { TransitionStatusDto } from './transition-status.dto';
import { OrderPriority } from '../domain/order-priority.enum';
import { OrderStatus } from '../domain/order-status.enum';

describe('DTO Validation', () => {
  // CREATE ORDER DTO TESTS
  describe('CreateOrderDto', () => {
    it('rejects missing required field (partnerId)', async () => {
      const dto = plainToInstance(CreateOrderDto, {
        patientReference: 'ref',
        requestedLocation: 'loc',
        priority: OrderPriority.ROUTINE,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('partnerId');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('rejects invalid priority enum value', async () => {
      const dto = plainToInstance(CreateOrderDto, {
        partnerId: 'p1',
        patientReference: 'ref',
        requestedLocation: 'loc',
        priority: 'invalid_priority' as unknown,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('priority');
      expect(errors[0].constraints).toHaveProperty('isEnum');
    });

    it('accepts valid priority enum values', async () => {
      for (const priority of [OrderPriority.ROUTINE, OrderPriority.URGENT]) {
        const dto = plainToInstance(CreateOrderDto, {
          partnerId: 'p1',
          patientReference: 'ref',
          requestedLocation: 'loc',
          priority,
        });
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('rejects string exceeding maxLength (partnerId > 255 chars)', async () => {
      const longString = 'a'.repeat(256);
      const dto = plainToInstance(CreateOrderDto, {
        partnerId: longString,
        patientReference: 'ref',
        requestedLocation: 'loc',
        priority: OrderPriority.ROUTINE,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('maxLength');
    });

    it('accepts valid string within maxLength limits', async () => {
      const dto = plainToInstance(CreateOrderDto, {
        partnerId: 'a'.repeat(255),
        patientReference: 'b'.repeat(255),
        requestedLocation: 'c'.repeat(255),
        priority: OrderPriority.ROUTINE,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    // CRITICAL: Unknown fields PASS validation here (handled by pipe's forbidNonWhitelisted)
    it('passes validation with unknown field (filtering handled by ValidationPipe)', async () => {
      const dto = plainToInstance(CreateOrderDto, {
        partnerId: 'p1',
        patientReference: 'ref',
        requestedLocation: 'loc',
        priority: OrderPriority.ROUTINE,
        unknownField: 'should be rejected by pipe, not DTO',
      });
      const errors = await validate(dto);
      // class-validator does NOT validate unknown properties by default
      // forbidNonWhitelisted enforcement happens in ValidationPipe (T-14/T-25)
      expect(errors).toHaveLength(0);
    });
  });

  // LIST ORDERS QUERY DTO TESTS
  describe('ListOrdersQueryDto', () => {
    it('rejects pageSize=200 (exceeds max 100)', async () => {
      const dto = plainToInstance(ListOrdersQueryDto, {
        pageSize: '200', // Query params arrive as strings
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('pageSize');
      expect(errors[0].constraints).toHaveProperty('max');
    });

    it('accepts pageSize=100 (at max limit)', async () => {
      const dto = plainToInstance(ListOrdersQueryDto, {
        pageSize: '100',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      // Verify transformation to number (critical for pagination math)
      expect(dto.pageSize).toBe(100);
    });

    it('accepts pageSize=1 (at min limit)', async () => {
      const dto = plainToInstance(ListOrdersQueryDto, {
        pageSize: '1',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.pageSize).toBe(1);
    });

    it('rejects invalid status enum value', async () => {
      const dto = plainToInstance(ListOrdersQueryDto, {
        status: 'invalid_status' as unknown,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('status');
      expect(errors[0].constraints).toHaveProperty('isEnum');
    });

    it('accepts valid status enum values', async () => {
      for (const status of Object.values(OrderStatus)) {
        const dto = plainToInstance(ListOrdersQueryDto, { status });
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('accepts partial query (only partnerId)', async () => {
      const dto = plainToInstance(ListOrdersQueryDto, {
        partnerId: 'specific-partner',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.partnerId).toBe('specific-partner');
    });

    it('transforms string page/pageSize to numbers', async () => {
      const dto = plainToInstance(ListOrdersQueryDto, {
        page: '2',
        pageSize: '50',
      });
      // Critical: Must be numbers for pagination math (T-11)
      expect(dto.page).toBe(2);
      expect(dto.pageSize).toBe(50);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  // TRANSITION STATUS DTO TESTS
  describe('TransitionStatusDto', () => {
    it('rejects invalid status enum value', async () => {
      const dto = plainToInstance(TransitionStatusDto, {
        status: 'flying' as unknown, // Intentional invalid value
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('status');
      expect(errors[0].constraints).toHaveProperty('isEnum');
    });

    it('accepts all valid status enum values', async () => {
      for (const status of Object.values(OrderStatus)) {
        const dto = plainToInstance(TransitionStatusDto, { status });
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('rejects missing status field', async () => {
      const dto = plainToInstance(TransitionStatusDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('status');
      expect(errors[0].constraints).toHaveProperty('isEnum'); // isEnum implies required
    });
  });
});
