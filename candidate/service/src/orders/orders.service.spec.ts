import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OrderEntity } from './entities/order.entity';
import { OrderPriority } from './domain/order-priority.enum';
import { OrderStatus } from './domain/order-status.enum';
import * as payloadHashModule from './domain/payload-hash';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

// Type-safe mock repository interface
interface MockRepository {
  create: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  findOneBy: ReturnType<typeof vi.fn>;
  findOneByOrFail: ReturnType<typeof vi.fn>;
}

// Vitest-native mock repository factory
const createMockRepository = (): MockRepository => ({
  create: vi.fn(),
  save: vi.fn(),
  findOneBy: vi.fn(),
  findOneByOrFail: vi.fn(),
});

describe('OrdersService (T-21 Idempotency Tests)', () => {
  let service: OrdersService;
  let mockRepo: MockRepository;

  beforeEach(async () => {
    // Create mock repository BEFORE module initialization
    mockRepo = createMockRepository();
    vi.spyOn(payloadHashModule, 'hashPayload');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: getRepositoryToken(OrderEntity),
          useValue: mockRepo, // Use pre-created mock
        },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // TEST CASE 1: New order (no prior key) → { created: true }
  describe('create() - New Order', () => {
    it('creates new order with created: true when no idempotency key provided', async () => {
      const dto: CreateOrderDto = {
        partnerId: 'p1',
        patientReference: 'ref1',
        requestedLocation: 'loc1',
        priority: OrderPriority.ROUTINE,
      };

      // Create minimal valid entity (TypeScript infers shape)
      const mockEntity = {
        id: 'new-id',
        partnerId: 'p1',
        patientReference: 'ref1',
        requestedLocation: 'loc1',
        priority: OrderPriority.ROUTINE,
        idempotencyKey: null,
        payloadHash: 'hash123',
        status: OrderStatus.RECEIVED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(payloadHashModule, 'hashPayload').mockReturnValue('hash123');
      mockRepo.create.mockReturnValue(mockEntity);
      mockRepo.save.mockResolvedValue(mockEntity);

      const result = await service.create(dto, undefined);

      expect(mockRepo.create).toHaveBeenCalledWith({
        ...dto,
        idempotencyKey: null,
        payloadHash: 'hash123',
        status: OrderStatus.RECEIVED,
      });
      expect(mockRepo.save).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ order: mockEntity, created: true });
      expect(payloadHashModule.hashPayload).toHaveBeenCalledWith(dto);
    });

    // ... (other tests follow identical pattern - using mockRepo instead of repo)
    it('creates new order with created: true when unique idempotency key provided', async () => {
      const dto: CreateOrderDto = {
        partnerId: 'p1',
        patientReference: 'ref1',
        requestedLocation: 'loc1',
        priority: OrderPriority.ROUTINE,
      };

      const mockEntity = {
        id: 'new-id',
        ...dto,
        idempotencyKey: 'unique-key',
        payloadHash: 'hash123',
        status: OrderStatus.RECEIVED,
      };

      vi.spyOn(payloadHashModule, 'hashPayload').mockReturnValue('hash123');
      mockRepo.create.mockReturnValue(mockEntity);
      mockRepo.save.mockResolvedValue(mockEntity);

      const result = await service.create(dto, 'unique-key');

      expect(mockRepo.create.mock.calls[0][0]).toMatchObject({
        idempotencyKey: 'unique-key',
      });
      expect(result.created).toBe(true);
    });
  });

  // TEST CASE 2: Same key, same payload → { created: false }
  describe('create() - Idempotency Replay', () => {
    it('returns existing order with created: false for same key + same payload', async () => {
      const dto: CreateOrderDto = {
        partnerId: 'p1',
        patientReference: 'ref1',
        requestedLocation: 'loc1',
        priority: OrderPriority.ROUTINE,
      };

      const existingOrder = {
        id: 'existing-id',
        idempotencyKey: 'replay-key',
        payloadHash: 'same-hash',
        partnerId: 'p1',
        patientReference: 'ref1',
        requestedLocation: 'loc1',
        priority: OrderPriority.ROUTINE,
        status: OrderStatus.RECEIVED,
      };

      mockRepo.save.mockRejectedValue({ code: '23505' });
      mockRepo.findOneByOrFail.mockResolvedValue(existingOrder);
      vi.spyOn(payloadHashModule, 'hashPayload').mockReturnValue('same-hash');

      const result = await service.create(dto, 'replay-key');

      expect(mockRepo.save).toHaveBeenCalledTimes(1);
      expect(mockRepo.findOneByOrFail).toHaveBeenCalledWith({ idempotencyKey: 'replay-key' });
      expect(result).toEqual({ order: existingOrder, created: false });
    });
  });

  // TEST CASE 3: Same key, different payload → ConflictException
  describe('create() - Payload Mismatch', () => {
    it('throws ConflictException for same key + different payload', async () => {
      const dto: CreateOrderDto = {
        partnerId: 'p1',
        patientReference: 'ref1',
        requestedLocation: 'loc1',
        priority: OrderPriority.ROUTINE,
      };

      const existingOrder = {
        id: 'existing-id',
        idempotencyKey: 'conflict-key',
        payloadHash: 'original-hash',
      };

      mockRepo.save.mockRejectedValue({ code: '23505' });
      mockRepo.findOneByOrFail.mockResolvedValue(existingOrder);
      vi.spyOn(payloadHashModule, 'hashPayload').mockReturnValue('new-hash');

      await expect(service.create(dto, 'conflict-key')).rejects.toThrow(ConflictException);
      await expect(service.create(dto, 'conflict-key')).rejects.toThrow(
        "Idempotency-Key 'conflict-key' has already been used with a different request payload",
      );
      expect(mockRepo.findOneByOrFail).toHaveBeenCalledWith({ idempotencyKey: 'conflict-key' });
    });
  });

  // TEST CASE 4: Non-unique error → re-thrown unchanged
  describe('create() - Non-Unique Errors', () => {
    it('re-throws database errors that are NOT unique violations', async () => {
      const dto: CreateOrderDto = {
        partnerId: 'p1',
        patientReference: 'ref1',
        requestedLocation: 'loc1',
        priority: OrderPriority.ROUTINE,
      };

      mockRepo.save.mockRejectedValue({ code: '23503' });
      vi.spyOn(payloadHashModule, 'hashPayload').mockReturnValue('hash123');

      await expect(service.create(dto, 'key')).rejects.toEqual({ code: '23503' });
      expect(mockRepo.findOneByOrFail).not.toHaveBeenCalled();
    });

    it('re-throws unique violation when no idempotency key provided', async () => {
      const dto: CreateOrderDto = {
        partnerId: 'p1',
        patientReference: 'ref1',
        requestedLocation: 'loc1',
        priority: OrderPriority.ROUTINE,
      };

      mockRepo.save.mockRejectedValue({ code: '23505' });
      vi.spyOn(payloadHashModule, 'hashPayload').mockReturnValue('hash123');

      await expect(service.create(dto, undefined)).rejects.toEqual({ code: '23505' });
      expect(mockRepo.findOneByOrFail).not.toHaveBeenCalled();
    });
  });

  // TEST CASE 5: No idempotency key → creates without deduplication
  describe('create() - No Idempotency Key', () => {
    it('creates new order without checking for duplicates when no key provided', async () => {
      const dto: CreateOrderDto = {
        partnerId: 'p1',
        patientReference: 'ref1',
        requestedLocation: 'loc1',
        priority: OrderPriority.ROUTINE,
      };

      const mockEntity = {
        id: 'new-id',
        ...dto,
        idempotencyKey: null,
        payloadHash: 'hash123',
        status: OrderStatus.RECEIVED,
      };

      vi.spyOn(payloadHashModule, 'hashPayload').mockReturnValue('hash123');
      mockRepo.create.mockReturnValue(mockEntity);
      mockRepo.save.mockResolvedValue(mockEntity);

      const result = await service.create(dto, undefined);

      expect(mockRepo.create.mock.calls[0][0]).toMatchObject({
        idempotencyKey: null,
      });
      expect(result.created).toBe(true);
    });

    it('allows multiple orders with null idempotencyKey', async () => {
      const dto: CreateOrderDto = {
        partnerId: 'p1',
        patientReference: 'ref1',
        requestedLocation: 'loc1',
        priority: OrderPriority.ROUTINE,
      };

      mockRepo.save.mockResolvedValue({});
      vi.spyOn(payloadHashModule, 'hashPayload').mockReturnValue('hash123');

      await service.create(dto, undefined);
      await service.create(dto, undefined);

      expect(mockRepo.save).toHaveBeenCalledTimes(2);
    });
  });

  // CRITICAL VERIFICATION: Hash computed BEFORE insert attempt
  it('computes payloadHash BEFORE database operations', async () => {
    const dto: CreateOrderDto = {
      partnerId: 'p1',
      patientReference: 'ref1',
      requestedLocation: 'loc1',
      priority: OrderPriority.ROUTINE,
    };

    const callSequence: string[] = [];

    vi.spyOn(payloadHashModule, 'hashPayload').mockImplementation(() => {
      callSequence.push('hashPayload');
      return 'hash123';
    });

    // ✅ Promise.resolve() instead of async () — no require-await warning
    mockRepo.create.mockReturnValue({} as OrderEntity);
    mockRepo.save.mockImplementation(() => {
      callSequence.push('save');
      return Promise.resolve({} as OrderEntity);
    });

    await service.create(dto, 'key');

    expect(callSequence).toEqual(['hashPayload', 'save']);
  });
});
