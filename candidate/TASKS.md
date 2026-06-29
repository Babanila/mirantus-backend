# Mirantus Screening Order Service (Tasks)

---

## Project Structure

```
candidate/service/
├── src/
│   ├── config/
│   │   ├── config.module.ts
│   │   └── config.schema.ts
│   ├── database/
│   │   ├── database.module.ts
│   │   └── datasource.ts
│   ├── filters/
│   │   └── global-exception.filter.ts
│   ├── health/
│   │   ├── health.controller.ts
│   │   └── health.module.ts
│   ├── middleware/
│   │   └── request-id.middleware.ts
│   ├── orders/
│   │   ├── domain/
│   │   │   ├── order-status.enum.ts
│   │   │   ├── order-priority.enum.ts
│   │   │   ├── order.types.ts
│   │   │   ├── payload-hash.ts
│   │   │   └── transitions.ts
│   │   ├── dto/
│   │   │   ├── create-order.dto.ts
│   │   │   ├── list-orders-query.dto.ts
│   │   │   ├── order-response.dto.ts
│   │   │   └── transition-status.dto.ts
│   │   ├── entities/
│   │   │   └── order.entity.ts
│   │   ├── orders.controller.ts
│   │   ├── orders.module.ts
│   │   └── orders.service.ts
│   ├── app.module.ts
│   ├── main.ts
│   ├── migrations/
│          └── 1719482400000-CreateOrdersTable.ts
├── test/
│   ├── e2e/
│   ├── app-factory.ts
│   ├── database-setup.ts
│   └── global-setup.ts
├── .env.example
├── .eslintrc.js
├── .dockerignore
├── Dockerfile
├── docker-compose.yml
├── docker-compose.test.yml
├── nest-cli.json
├── package.json
├── tsconfig.json
├── tsconfig.build.json
└── vitest.config.ts
```

---

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Date | June 27, 2026 |
| Source spec | `SPEC.md` v1.0 |
| Target directory | `candidate/service/` |
| Estimated total effort | ~4 hours (core) + ~1 hour (Terraform + docs) |

> **How to use this file.**
> Work through tasks in phase order. Each task is a single, independently verifiable
> unit of work. Complete all acceptance criteria before moving to the next task.
> The "Agent Notes" block in each task is the guidance to give a coding agent — and what
> to watch for in its output. Mark each task `[x]` when done.


---

## Task Map

| ID | Title | Phase | Est. | Depends on |
|----|-------|-------|------|------------|
| [T-01](#t-01-project-scaffold) | Project Scaffold | 0 — Foundation | 15 min | — |
| [T-02](#t-02-configuration-module) | Configuration Module | 0 — Foundation | 10 min | T-01 |
| [T-03](#t-03-domain-types--enums) | Domain Types & Enums | 1 — Domain | 5 min | T-01 |
| [T-04](#t-04-state-machine-validator) | State Machine Validator | 1 — Domain | 10 min | T-03 |
| [T-05](#t-05-payload-hash-utility) | Payload Hash Utility | 1 — Domain | 5 min | T-01 |
| [T-06](#t-06-database-module--typeorm-datasource) | Database Module & DataSource | 2 — Persistence | 10 min | T-02 |
| [T-07](#t-07-order-entity) | Order Entity | 2 — Persistence | 10 min | T-03, T-06 |
| [T-08](#t-08-initial-database-migration) | Initial Database Migration | 2 — Persistence | 10 min | T-07 |
| [T-09](#t-09-request--response-dtos) | Request & Response DTOs | 3 — HTTP Contract | 10 min | T-03 |
| [T-10](#t-10-ordersservice--create-with-idempotency) | OrdersService — create (with idempotency) | 4 — Service Layer | 20 min | T-04, T-05, T-07, T-09 |
| [T-11](#t-11-ordersservice--findall-filter--pagination) | OrdersService — findAll (filter + pagination) | 4 — Service Layer | 10 min | T-10 |
| [T-12](#t-12-ordersservice--findone) | OrdersService — findOne | 4 — Service Layer | 5 min | T-10 |
| [T-13](#t-13-ordersservice--transitionstatus-compare-and-swap) | OrdersService — transitionStatus (CAS) | 4 — Service Layer | 20 min | T-04, T-10 |
| [T-14](#t-14-application-bootstrap--global-middleware) | Application Bootstrap & Global Middleware | 5 — HTTP Layer | 15 min | T-02, T-06 |
| [T-15](#t-15-global-exception-filter) | Global Exception Filter | 5 — HTTP Layer | 15 min | T-14 |
| [T-16](#t-16-orderscontroller) | OrdersController | 5 — HTTP Layer | 15 min | T-11, T-12, T-13, T-15 |
| [T-17](#t-17-response-serialiser--field-exclusion) | Response Serialiser & Field Exclusion | 5 — HTTP Layer | 10 min | T-09, T-16 |
| [T-18](#t-18-health-module) | Health Module | 6 — Operability | 10 min | T-06, T-14 |
| [T-19](#t-19-structured-logging) | Structured Logging | 6 — Operability | 15 min | T-14 |
| [T-20](#t-20-unit-tests--state-machine) | Unit Tests — State Machine | 7 — Tests | 15 min | T-04 |
| [T-21](#t-21-unit-tests--idempotency--payload-hash) | Unit Tests — Idempotency & Payload Hash | 7 — Tests | 15 min | T-05, T-10 |
| [T-22](#t-22-unit-tests--dto-validation) | Unit Tests — DTO Validation | 7 — Tests | 10 min | T-09 |
| [T-23](#t-23-integration-tests--happy-path-lifecycle) | Integration Tests — Happy Path Lifecycle | 8 — Integration | 20 min | T-16, T-18 |
| [T-24](#t-24-integration-tests--concurrent-idempotency) | Integration Tests — Concurrent Idempotency | 8 — Integration | 20 min | T-23 |
| [T-25](#t-25-integration-tests--error-scenarios) | Integration Tests — Error Scenarios | 8 — Integration | 20 min | T-23 |
| [T-26](#t-26-dockerfile--multi-stage-build) | Dockerfile — Multi-Stage Build | 9 — Infrastructure | 10 min | T-16 |
| [T-27](#t-27-docker-composeyml) | docker-compose.yml | 9 — Infrastructure | 10 min | T-26 |
| [T-28](#t-28-github-actions-ci-workflow) | GitHub Actions CI Workflow | 9 — Infrastructure | 15 min | T-25, T-27 |
| [T-29](#t-29-terraform-module) | Terraform Module | 10 — Terraform | 20 min | T-27 |
| [T-30](#t-30-readmemd) | README.md | 11 — Docs | 15 min | T-28 |

---

## Dependency Graph

```
T-01 (Scaffold)
 ├─ T-02 (Config) ───────────────────────────────► T-06 (DB Module) ──► T-07 (Entity) ──► T-08 (Migration)
 │                                                                               │
 ├─ T-03 (Enums) ──► T-04 (State Machine)                                        │
 │       │                    │                                                  │
 │       └──► T-05 (Hash) ◄───┤                                                  │
 │                    │       │                                                  │
 │                    └───────┴──────────────────► T-10 (create) ──► T-11, T-12, T-13
 │                                                                               │
 ├─ T-09 (DTOs) ──────────────────────────────────────────────────────────────► T-10
 │                                                                               │
 └─ T-14 (Bootstrap) ──► T-15 (ExFilter) ──────────────────────────────────── T-16 (Controller)
              │                                                                  │
              └──► T-18 (Health) ◄───────────────────────────────────────────── T-17 (Serialiser)
              │                                                                  │
              └──► T-19 (Logging)                                                │
                                                                                 │
                                          T-20, T-21, T-22 (Unit Tests) ───────  │
                                                                                 │
                                          T-23, T-24, T-25 (Integration)  ◄──────┘
                                                                                 │
                                          T-26 (Dockerfile) ──► T-27 (Compose) ◄┘
                                                                      │
                                          T-28 (CI)  ◄────────────────┘ T-25
                                          T-29 (Terraform)
                                          T-30 (README) ◄──── T-28
```

---

## Phase Rationale

| Phase | Name | Rationale |
|-------|------|-----------|
| 0 | Foundation | Scaffold and configuration must exist before any other module can be written |
| 1 | Domain | Pure functions and types with zero external dependencies — safest to write and test first |
| 2 | Persistence | Entity and migration establish the schema contract all service logic depends on |
| 3 | HTTP Contract | DTOs pin the public API surface before service methods reference them |
| 4 | Service Layer | Business logic, testable in isolation via injected mock repositories |
| 5 | HTTP Layer | Controller and filters wire service methods to HTTP — requires service to be complete |
| 6 | Operability | Health probes and logging are independent of business logic; can be done in parallel |
| 7 | Unit Tests | Written after the code they test exists, but before integration tests |
| 8 | Integration Tests | Require the full stack including Docker/Compose Postgres |
| 9 | Infrastructure | Dockerfile, Compose, and CI workflow solidify what's already running locally |
| 10 | Terraform | Architectural description; does not affect the running service |
| 11 | Docs | README written last — reflects the actual setup, not the intended one |

---

## Phase 0 — Foundation

### T-01 Project Scaffold

- [ ] **Status:** Not started

**Objective:** Initialise a production-ready NestJS + TypeScript project at
`candidate/service/` with strict mode, linting, and all required dependencies installed.

**Outputs:**
```
candidate/service/
├── src/
│   └── main.ts              (empty bootstrap shell)
├── package.json
├── tsconfig.json            (strict: true, strictNullChecks: true, noImplicitAny: true)
├── tsconfig.build.json
├── .eslintrc.js             (or eslint.config.js)
├── .prettierrc
├── nest-cli.json
└── .env.example
```

**Acceptance Criteria:**
```bash
cd candidate/service
npm install          # exits 0, no peer-dep errors
npm run build        # exits 0, dist/ created
npm run lint         # exits 0, no errors
npx tsc --noEmit     # exits 0, no type errors
```

**Dependencies required (install all upfront):**
```bash
npm install @nestjs/common @nestjs/core @nestjs/platform-express reflect-metadata rxjs
npm install @nestjs/typeorm typeorm pg
npm install @nestjs/config
npm install class-validator class-transformer
npm install uuid
npm install winston nest-winston
npm install --save-dev @nestjs/testing @types/node @types/uuid
npm install --save-dev vitest @vitest/coverage-v8 supertest @types/supertest
npm install --save-dev eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
npm install --save-dev prettier
```

**`tsconfig.json` — non-negotiable settings:**
```json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "strictPropertyInitialization": false,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "target": "ES2021",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

> **Agent Note:** When prompting an agent to scaffold a NestJS project, explicitly
> instruct it to use `strict: true` and to not use `@nestjs/cli` scaffolding that resets
> `tsconfig.json` to permissive defaults. Agents frequently omit `emitDecoratorMetadata`
> which causes TypeORM decorators to silently fail at runtime. Verify the flag is present
> before proceeding.

---

### T-02 Configuration Module

- [ ] **Status:** Not started

**Objective:** Wire `@nestjs/config` with Joi-based startup validation so the service
refuses to boot if `DATABASE_URL` is absent or malformed.

**Outputs:**
```
src/
└── config/
    ├── config.module.ts
    ├── config.schema.ts     (Joi schema)
    └── config.service.ts    (typed getters)
```

**Acceptance Criteria:**
- `DATABASE_URL=` npm run start:dev` → process exits with a clear validation error, not a cryptic TypeORM connection error
- All variables in SPEC.md §13 are declared in the schema with correct types and defaults
- `ConfigService.get('DATABASE_URL')` is typed as `string`, not `string | undefined`

**Config schema (enforce these exactly):**

```typescript
// config.schema.ts
import * as Joi from 'joi';

export const configSchema = Joi.object({
  DATABASE_URL:           Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).required(),
  NODE_ENV:               Joi.string().valid('development', 'test', 'production').default('development'),
  API_PORT:               Joi.number().integer().min(1024).max(65535).default(3000),
  LOG_LEVEL:              Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  CORS_ORIGIN:            Joi.string().default('http://localhost:5173'),
  DB_POOL_MAX:            Joi.number().integer().min(1).default(10),
  DB_POOL_MIN:            Joi.number().integer().min(1).default(2),
  DB_CONNECT_TIMEOUT_MS:  Joi.number().integer().min(100).default(5000),
});
```

> **Agent Note:** Agents frequently make `ConfigService.get()` return `string | undefined`
> rather than `string` for required variables. Enforce the typed getter pattern or use
> `configService.getOrThrow<string>('DATABASE_URL')`. Also check that Joi is installed
> (`npm install joi`) — agents sometimes emit the schema without installing the package.

---

## Phase 1 — Domain

### T-03 Domain Types & Enums

- [ ] **Status:** Not started

**Objective:** Define all shared TypeScript types, enums, and the serialised Order
response interface in a single `domain` barrel. No external dependencies.

**Outputs:**
```
src/
└── orders/
    └── domain/
        ├── order-status.enum.ts
        ├── order-priority.enum.ts
        └── order.types.ts          (OrderResource response interface)
```

**Required enum values (copy exactly — string values must match DB column values):**

```typescript
// order-status.enum.ts
export enum OrderStatus {
  RECEIVED    = 'received',
  ACCEPTED    = 'accepted',
  IN_PROGRESS = 'in_progress',
  COMPLETED   = 'completed',
  REJECTED    = 'rejected',
}

// order-priority.enum.ts
export enum OrderPriority {
  ROUTINE = 'routine',
  URGENT  = 'urgent',
}

// order.types.ts — the API response shape (SPEC.md §5)
export interface OrderResource {
  id:                string;
  partnerId:         string;
  patientReference:  string;
  requestedLocation: string;
  priority:          OrderPriority;
  status:            OrderStatus;
  createdAt:         string;   // ISO8601 UTC
  updatedAt:         string;   // ISO8601 UTC
}
```

**Acceptance Criteria:**
```bash
npx tsc --noEmit   # exits 0
```
- No `any` types anywhere in this module
- `idempotencyKey` and `payloadHash` are absent from `OrderResource`

> **Agent Note:** Agents will often put `idempotencyKey` in the response interface because
> it exists on the entity. Explicitly instruct: "The `OrderResource` interface must NOT
> include `idempotencyKey`, `payloadHash`, or any internal persistence column."

---

### T-04 State Machine Validator

- [ ] **Status:** Not started

**Objective:** Implement `isValidTransition` as a pure function with zero side-effects
and `VALID_TRANSITIONS` as an immutable constant. This is the authoritative enforcer of
the order lifecycle.

**Outputs:**
```
src/orders/domain/
├── transitions.ts          (VALID_TRANSITIONS map + isValidTransition)
└── transitions.spec.ts     (exhaustive unit tests — written in this task)
```

**Implementation (copy from SPEC.md §6 exactly):**
```typescript
// transitions.ts
import { OrderStatus } from './order-status.enum';

const VALID_TRANSITIONS: Readonly<Record<OrderStatus, ReadonlySet<OrderStatus>>> = {
  [OrderStatus.RECEIVED]:    new Set([OrderStatus.ACCEPTED, OrderStatus.REJECTED]),
  [OrderStatus.ACCEPTED]:    new Set([OrderStatus.IN_PROGRESS, OrderStatus.REJECTED]),
  [OrderStatus.IN_PROGRESS]: new Set([OrderStatus.COMPLETED]),
  [OrderStatus.COMPLETED]:   new Set(),
  [OrderStatus.REJECTED]:    new Set(),
} as const;

export function isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
  return VALID_TRANSITIONS[from]?.has(to) ?? false;
}
```

**Acceptance Criteria:**
```bash
npm run test:unit -- --reporter=verbose   # all transition tests pass
```
- Tests cover every row in the transition table in SPEC.md §6
- 20 test cases minimum (all `from × to` permutations in the table)
- `isValidTransition('completed', 'received')` → `false`
- `isValidTransition('in_progress', 'rejected')` → `false`
- `isValidTransition('received', 'accepted')` → `true`

> **Agent Note:** The most common mistake here is implementing transitions as a simple
> `switch` statement where the agent forgets some of the ❌ cases from the table.
> Instruct it explicitly: "Write the transition map as a Record of Sets, then write a
> test for EVERY row in this table:" and paste the full SPEC.md transition table.
> Also verify `in_progress → rejected` is `false` — agents often allow it by analogy
> with `received → rejected` and `accepted → rejected`.

---

### T-05 Payload Hash Utility

- [ ] **Status:** Not started

**Objective:** Implement `hashPayload` — a deterministic SHA-256 hash of a
normalised DTO (sorted keys, no whitespace) used for idempotency conflict detection.

**Outputs:**
```
src/orders/domain/
├── payload-hash.ts
└── payload-hash.spec.ts
```

**Implementation:**
```typescript
// payload-hash.ts
import { createHash } from 'node:crypto';

export function hashPayload(dto: Record<string, unknown>): string {
  const normalised = JSON.stringify(
    Object.fromEntries(
      Object.entries(dto)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
    )
  );
  return createHash('sha256').update(normalised).digest('hex');
}
```

**Acceptance Criteria:**
```bash
npm run test:unit -- --reporter=verbose
```
- `hashPayload({ b: '2', a: '1' })` === `hashPayload({ a: '1', b: '2' })` → same hash
- `hashPayload({ a: '1' })` !== `hashPayload({ a: '2' })` → different hash
- Output is always a 64-character hex string
- Function is pure (no I/O, no side-effects)

> **Agent Note:** Agents will sometimes use `JSON.stringify(dto)` without key
> normalisation, which produces different hashes for `{a:1, b:2}` and `{b:2, a:1}`.
> Paste the exact implementation above into the prompt. Also check that the agent is
> using `node:crypto` (built-in), not installing a third-party hashing library.

---

## Phase 2 — Persistence

### T-06 Database Module & TypeORM DataSource

- [ ] **Status:** Not started

**Objective:** Create a `DatabaseModule` that initialises a TypeORM `DataSource` from
`DATABASE_URL`, with the pool settings and connection timeout from `ConfigService`.

**Outputs:**
```
src/
└── database/
    └── database.module.ts
```

**Key configuration requirements:**
```typescript
TypeOrmModule.forRootAsync({
  imports:    [AppConfigModule],
  inject:     [ConfigService],
  useFactory: (config: ConfigService) => ({
    type:              'postgres',
    url:               config.getOrThrow<string>('DATABASE_URL'),
    entities:          [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize:       false,          // NEVER true — use migrations
    migrationsRun:     false,          // Run explicitly via CLI
    logging:           config.get('NODE_ENV') === 'development',
    extra: {
      max:             config.get<number>('DB_POOL_MAX'),
      min:             config.get<number>('DB_POOL_MIN'),
      connectionTimeoutMillis: config.get<number>('DB_CONNECT_TIMEOUT_MS'),
    },
  }),
})
```

**Acceptance Criteria:**
- `synchronize: false` is confirmed in source (grep the file)
- `DATABASE_URL` for a non-existent host throws at boot, not silently at first query
- `npm run build` exits 0

> **Agent Note:** The single most dangerous thing an agent does here is set
> `synchronize: true` "for convenience." This will silently drop columns in production.
> Pin this in your prompt: "`synchronize` MUST be `false`. Never change this."
> Agents also often use `entities: [OrderEntity]` with a direct import instead of
> the glob pattern — this works but breaks when migrations live in `dist/`. Use the glob.

---

### T-07 Order Entity

- [ ] **Status:** Not started

**Objective:** Implement the `OrderEntity` TypeORM entity mapping every column defined
in SPEC.md §5 with correct decorators, types, and column names.

**Outputs:**
```
src/orders/
└── entities/
    └── order.entity.ts
```

**Implementation must match exactly:**
```typescript
@Entity('orders')
export class OrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 512, nullable: true, unique: true })
  idempotencyKey: string | null;

  @Column({ name: 'partner_id',          type: 'varchar', length: 255 })
  partnerId: string;

  @Column({ name: 'patient_reference',   type: 'varchar', length: 255 })
  patientReference: string;

  @Column({ name: 'requested_location',  type: 'varchar', length: 255 })
  requestedLocation: string;

  @Column({ type: 'varchar', length: 20 })
  priority: OrderPriority;

  @Column({ type: 'varchar', length: 20, default: OrderStatus.RECEIVED })
  status: OrderStatus;

  @Column({ name: 'payload_hash', type: 'varchar', length: 64, nullable: true })
  payloadHash: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
```

**Acceptance Criteria:**
```bash
npx tsc --noEmit   # exits 0, no type errors on entity
```
- `synchronize: false` is unchanged (entity addition must not auto-create the table)
- `type: 'timestamptz'` confirmed for both timestamp columns (not `timestamp`)
- `@UpdateDateColumn` is used for `updatedAt` — TypeORM will update it automatically

> **Agent Note:** Agents frequently use `@Column({ type: 'timestamp' })` instead of
> `'timestamptz'`. This causes UTC offset bugs when the database server is not in UTC.
> Explicitly require `timestamptz`. Also check that both `idempotencyKey` and
> `payloadHash` are `nullable: true` — agents often omit this.

---

### T-08 Initial Database Migration

- [ ] **Status:** Not started

**Objective:** Generate and review the initial migration that creates the `orders` table
with all columns, constraints, and indices from SPEC.md §5.

**Outputs:**
```
src/migrations/
└── XXXXXXXXXX-CreateOrdersTable.ts    (TypeORM migration)
```

**Steps:**
1. Add migration CLI scripts to `package.json`:
```json
{
  "scripts": {
    "migration:generate": "typeorm-ts-node-commonjs migration:generate src/migrations/$npm_config_name -d src/database/datasource.ts",
    "migration:run":      "typeorm-ts-node-commonjs migration:run -d src/database/datasource.ts",
    "migration:revert":   "typeorm-ts-node-commonjs migration:revert -d src/database/datasource.ts"
  }
}
```
2. Create a standalone `datasource.ts` for the CLI (not the app DataSource):
```typescript
// src/database/datasource.ts
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

export default new DataSource({
  type:       'postgres',
  url:        process.env.DATABASE_URL,
  entities:   ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
});
```
3. Run `npm run migration:generate -- --name=CreateOrdersTable`
4. Review generated migration and verify all indices from SPEC.md §5 are present. If they are missing, add them manually to the `up()` method.

**Required indices (manually add to `up()` if missing):**
```typescript
await queryRunner.query(`CREATE INDEX idx_orders_partner_id ON orders (partner_id)`);
await queryRunner.query(`CREATE INDEX idx_orders_status ON orders (status)`);
await queryRunner.query(`CREATE INDEX idx_orders_created_at ON orders (created_at DESC)`);
await queryRunner.query(`CREATE INDEX idx_orders_partner_status ON orders (partner_id, status, created_at DESC)`);
```

**Acceptance Criteria:**
```bash
# With Postgres running:
npm run migration:run      # exits 0
npm run migration:revert   # exits 0 (down() is runnable)
npm run migration:run      # exits 0 again (idempotent re-run)

# Verify schema:
psql $DATABASE_URL -c "\d orders"   # shows all columns
psql $DATABASE_URL -c "\di orders*" # shows all 5 indices
```
- `TIMESTAMPTZ` confirmed for both timestamp columns
- `UNIQUE` constraint on `idempotency_key` confirmed
- `CHECK` constraints on `priority` and `status` confirmed
- `down()` method reverses everything (drops table)

> **Agent Note:** TypeORM's migration generator does NOT generate index creation
> statements from `@Index()` decorators — it only generates column `CREATE TABLE`
> statements. You must manually add the `CREATE INDEX` calls to `up()`. Always review
> the generated file and compare against the indices in SPEC.md §5 before running.

---

## Phase 3 — HTTP Contract

### T-09 Request & Response DTOs

- [ ] **Status:** Not started

**Objective:** Define all four DTOs that form the public API contract, decorated with
`class-validator` rules matching SPEC.md §9 exactly.

**Outputs:**
```
src/orders/dto/
├── create-order.dto.ts
├── list-orders-query.dto.ts
├── transition-status.dto.ts
└── order-response.dto.ts       (serialisation class)
```

**`create-order.dto.ts`:**
```typescript
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { OrderPriority } from '../domain/order-priority.enum';

export class CreateOrderDto {
  @IsString() @IsNotEmpty() @MaxLength(255)
  partnerId: string;

  @IsString() @IsNotEmpty() @MaxLength(255)
  patientReference: string;

  @IsString() @IsNotEmpty() @MaxLength(255)
  requestedLocation: string;

  @IsEnum(OrderPriority)
  priority: OrderPriority;
}
```

**`list-orders-query.dto.ts`:**
```typescript
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, Max } from 'class-validator';
import { OrderStatus } from '../domain/order-status.enum';

export class ListOrdersQueryDto {
  @IsOptional() @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional() @IsString() @MaxLength(255)
  partnerId?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize?: number = 20;
}
```

**`transition-status.dto.ts`:**
```typescript
import { IsEnum } from 'class-validator';
import { OrderStatus } from '../domain/order-status.enum';

export class TransitionStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;
}
```

**`order-response.dto.ts`:**
```typescript
import { Exclude, Expose } from 'class-transformer';
import { OrderEntity } from '../entities/order.entity';

@Exclude()
export class OrderResponseDto {
  @Expose() id:                string;
  @Expose() partnerId:         string;
  @Expose() patientReference:  string;
  @Expose() requestedLocation: string;
  @Expose() priority:          string;
  @Expose() status:            string;
  @Expose() createdAt:         string;
  @Expose() updatedAt:         string;

  constructor(partial: Partial<OrderEntity>) {
    Object.assign(this, partial);
    this.createdAt = partial.createdAt?.toISOString() ?? '';
    this.updatedAt = partial.updatedAt?.toISOString() ?? '';
  }
}
```

**Acceptance Criteria:**
```bash
npx tsc --noEmit   # exits 0
```
- `idempotencyKey` and `payloadHash` are NOT in any response DTO
- `createdAt` and `updatedAt` are serialised via `.toISOString()` (UTC guaranteed)
- `ListOrdersQueryDto` uses `@Type(() => Number)` for `page` and `pageSize` to coerce
  query string values from strings to numbers

> **Agent Note:** Agents forget `@Type(() => Number)` on `ListOrdersQueryDto` numeric
> fields. Without it, `page` arrives as the string `"1"` instead of integer `1`, and
> `@IsInt()` validation passes but arithmetic downstream breaks. Also check `@MaxLength`
> on all string fields — agents frequently omit it on `patientReference`.

---

## Phase 4 — Service Layer

### T-10 OrdersService — `create` (with Idempotency)

- [ ] **Status:** Not started

**Objective:** Implement `OrdersService.create()` using the atomic insert / unique
violation pattern from SPEC.md §7. This is the highest-risk method in the service.

**Outputs:**
```
src/orders/
├── orders.module.ts
└── orders.service.ts    (create method only for this task)
```

**Implementation contract (must match SPEC.md §7 Critical Implementation Constraints):**

```typescript
async create(
  dto: CreateOrderDto,
  idempotencyKey?: string,
): Promise<{ order: OrderEntity; created: boolean }> {
  const payloadHash = hashPayload(dto as unknown as Record<string, unknown>);

  try {
    const entity = this.repo.create({
      ...dto,
      idempotencyKey: idempotencyKey ?? null,
      payloadHash,
      status: OrderStatus.RECEIVED,
    });
    const order = await this.repo.save(entity);
    return { order, created: true };

  } catch (err: unknown) {
    if (this.isUniqueViolation(err)) {
      if (!idempotencyKey) throw err;          // should not happen, re-throw
      const existing = await this.repo.findOneByOrFail({ idempotencyKey });
      if (existing.payloadHash !== payloadHash) {
        throw new ConflictException(
          'Idempotency-Key has already been used with a different request payload'
        );
      }
      return { order: existing, created: false };
    }
    throw err;
  }
}

private isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === '23505'
  );
}
```

**Acceptance Criteria:**
```bash
npx tsc --noEmit   # exits 0
```
- No `SELECT … WHERE idempotency_key = ?` query exists before the `INSERT`
- `payloadHash` is computed before the insert, not after
- `created: true` for new orders; `created: false` for replays
- Same key, different payload → `ConflictException` (not a duplicate order)
- `isUniqueViolation` checks `err.code === '23505'` (not a try-catch on findOne)

> **Agent Note:** The most common bug here is performing a `findOne` check *before*
> the `save()`. This creates a race condition: two concurrent requests both find
> `null`, both attempt to insert, one succeeds, the other throws — but the timing
> window is wide enough that duplicates occur in practice. Paste the implementation
> above and instruct: "Do not add any pre-insert SELECT. The UNIQUE constraint is
> the lock. Handle the violation in the catch block only."

---

### T-11 OrdersService — `findAll` (Filter + Pagination)

- [ ] **Status:** Not started

**Objective:** Implement `OrdersService.findAll()` returning a paginated, filtered list
with the envelope shape `{ data, total, page, pageSize }`.

**Outputs:** `orders.service.ts` (add `findAll` method)

**Implementation:**
```typescript
async findAll(query: ListOrdersQueryDto): Promise<{
  data: OrderEntity[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const { status, partnerId, page = 1, pageSize = 20 } = query;
  const where: FindOptionsWhere<OrderEntity> = {};
  if (status)    where.status    = status;
  if (partnerId) where.partnerId = partnerId;

  const [data, total] = await this.repo.findAndCount({
    where,
    order:  { createdAt: 'DESC' },
    skip:   (page - 1) * pageSize,
    take:   pageSize,
  });

  return { data, total, page, pageSize };
}
```

**Acceptance Criteria:**
```bash
npx tsc --noEmit
```
- Empty result returns `{ data: [], total: 0, page: 1, pageSize: 20 }` (never 404)
- `skip` uses `(page - 1) * pageSize` (1-indexed pages)
- Filters are combined with AND (both `status` and `partnerId` filters when both provided)
- Default sort is `createdAt DESC`

---

### T-12 OrdersService — `findOne`

- [ ] **Status:** Not started

**Objective:** Implement `OrdersService.findOne()` returning the order or throwing
`NotFoundException`.

**Outputs:** `orders.service.ts` (add `findOne` method)

```typescript
async findOne(id: string): Promise<OrderEntity> {
  const order = await this.repo.findOneBy({ id });
  if (!order) throw new NotFoundException('Order not found');
  return order;
}
```

**Acceptance Criteria:**
- Non-existent ID → `NotFoundException` (maps to 404 in controller)
- Existing ID → returns `OrderEntity`

---

### T-13 OrdersService — `transitionStatus` (Compare-and-Swap)

- [ ] **Status:** Not started

**Objective:** Implement `OrdersService.transitionStatus()` using the compare-and-swap
UPDATE from SPEC.md §6 to prevent lost updates under concurrent writes.

**Outputs:** `orders.service.ts` (add `transitionStatus` method)

**Implementation (CAS pattern — do not simplify):**
```typescript
async transitionStatus(
  id: string,
  newStatus: OrderStatus,
): Promise<OrderEntity> {
  const current = await this.findOne(id);   // throws 404 if not found

  if (!isValidTransition(current.status, newStatus)) {
    throw new ConflictException(
      `Invalid status transition from '${current.status}' to '${newStatus}'`
    );
  }

  // Compare-and-swap: update only if status hasn't changed since we read it
  const result = await this.repo
    .createQueryBuilder()
    .update(OrderEntity)
    .set({ status: newStatus })
    .where('id = :id AND status = :expectedStatus', {
      id,
      expectedStatus: current.status,
    })
    .returning('*')
    .execute();

  if (result.affected === 0) {
    // Concurrent write changed status before we could — re-fetch and determine cause
    const refetched = await this.repo.findOneBy({ id });
    if (!refetched) throw new NotFoundException('Order not found');
    throw new ConflictException(
      `Concurrent update detected — status is now '${refetched.status}'`
    );
  }

  return result.raw[0] as OrderEntity;
}
```

**Acceptance Criteria:**
```bash
npx tsc --noEmit
```
- `isValidTransition` is called before any DB write
- The `UPDATE` includes `AND status = :expectedStatus` in the WHERE clause
- Zero `affected` rows → re-fetches and throws `ConflictException`, not a silent success
- Error message includes both `from` and `to` status names (required by SPEC.md §8.4)
- `updatedAt` is updated automatically by TypeORM `@UpdateDateColumn` (verify no manual set)

> **Agent Note:** Agents will almost always implement this as two separate queries:
> a `findOne` then an `update`. This is wrong — it has the lost-update race condition.
> Paste the CAS implementation and say: "Use this exact pattern. Do not simplify it
> to a findOne + save." Also check that the error message interpolates both statuses —
> agents sometimes produce `"Invalid transition"` without the specific values.

---

## Phase 5 — HTTP Layer

### T-14 Application Bootstrap & Global Middleware

- [ ] **Status:** Not started

**Objective:** Wire the NestJS app in `main.ts` with the global `ValidationPipe` (exact
settings), CORS configuration from env, port from `ConfigService`, and request ID
middleware.

**Outputs:**
```
src/
├── main.ts
└── middleware/
    └── request-id.middleware.ts
```

**`main.ts` — required setup (do not deviate):**
```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const config = app.get(ConfigService);

  // 1. Global validation pipe — MUST be exactly this
  app.useGlobalPipes(new ValidationPipe({
    whitelist:            true,
    forbidNonWhitelisted: true,    // ← CRITICAL: do not remove
    transform:            true,
    transformOptions:     { enableImplicitConversion: false },
  }));

  // 2. CORS from env
  const corsOrigins = config.get<string>('CORS_ORIGIN', 'http://localhost:5173')
    .split(',')
    .map(o => o.trim());
  app.enableCors({ origin: corsOrigins, credentials: true });

  // 3. Request ID middleware
  app.use(requestIdMiddleware);

  const port = config.get<number>('API_PORT', 3000);
  await app.listen(port);
}
```

**`request-id.middleware.ts`:**
```typescript
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const id = (req.headers['x-request-id'] as string) ?? uuidv4();
  req.headers['x-request-id'] = id;
  res.setHeader('X-Request-ID', id);
  next();
}
```

**Acceptance Criteria:**
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health   # → 200
curl -I http://localhost:3000/health | grep -i x-request-id           # header present

# Verify forbidNonWhitelisted:
curl -s -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"partnerId":"p","patientReference":"r","requestedLocation":"l","priority":"routine","unknownField":"bad"}' \
  | jq .statusCode    # → 400
```

> **Agent Note:** After generating `main.ts`, verify `forbidNonWhitelisted: true` is
> still present — agents sometimes "clean up" the pipe config to just `{ whitelist: true }`
> because they treat it as less important. This is the single most critical setting in
> the entire application. Run the `curl` test above to confirm it works before
> continuing.

---

### T-15 Global Exception Filter

- [ ] **Status:** Not started

**Objective:** Implement and register a `GlobalExceptionFilter` that intercepts all
exceptions and serialises them into the **frozen** standard error schema from SPEC.md §10.

**Outputs:**
```
src/filters/
└── global-exception.filter.ts
```

**Required output shape (never deviate — see SPEC.md §10):**
```typescript
{
  statusCode: number;
  message:    string;
  errors?:    Array<{ field: string; message: string }>;
  timestamp:  string;   // ISO8601 UTC
  path:       string;
}
```

**Implementation outline:**
```typescript
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx    = host.switchToHttp();
    const res    = ctx.getResponse<Response>();
    const req    = ctx.getRequest<Request>();
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    let message = 'Internal server error';
    let errors: Array<{ field: string; message: string }> | undefined;

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;
        message = (b['message'] as string) ?? message;
        // NestJS ValidationPipe produces { message: string[], ... }
        if (Array.isArray(b['message'])) {
          message = 'Validation failed';
          errors  = (b['message'] as string[]).map(m => ({
            field:   m.split(' ')[0] ?? 'unknown',
            message: m,
          }));
        }
      }
    }

    res.status(status).json({
      statusCode: status,
      message,
      ...(errors ? { errors } : {}),
      timestamp: new Date().toISOString(),
      path:      req.url,
    });
  }
}
```

**Register in `AppModule`:**
```typescript
providers: [{ provide: APP_FILTER, useClass: GlobalExceptionFilter }]
```

**Acceptance Criteria:**
```bash
# 400 from ValidationPipe
curl -s -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"priority":"bad"}' | jq .
# Must have: statusCode, message, errors[], timestamp, path

# 404
curl -s http://localhost:3000/orders/00000000-0000-0000-0000-000000000000 | jq .
# Must have: statusCode=404, message, timestamp, path
```

> **Agent Note:** Agents frequently return NestJS's default error shape for unhandled
> exceptions (which has `error: "Internal Server Error"` not `message`). After
> implementing, manually throw a raw `Error` in a handler and confirm the response
> still matches the standard schema.

---

### T-16 OrdersController

- [ ] **Status:** Not started

**Objective:** Implement all five route handlers, correctly mapping HTTP verbs, status
codes, headers, and service return values to the contract in SPEC.md §8.

**Outputs:**
```
src/orders/
└── orders.controller.ts
```

**Route handlers summary:**

| Handler | Decorator | Method | Path | Success code |
|---------|-----------|--------|------|--------------|
| `create` | `@Post()` | POST | `/orders` | 201 (new) / 200 (replay) |
| `findAll` | `@Get()` | GET | `/orders` | 200 |
| `findOne` | `@Get(':id')` | GET | `/orders/:id` | 200 |
| `transitionStatus` | `@Patch(':id/status')` | PATCH | `/orders/:id/status` | 200 |

**Critical controller implementations:**

```typescript
// create — status code depends on whether order is new or replayed
@Post()
async create(
  @Body() dto: CreateOrderDto,
  @Headers('idempotency-key') idempotencyKey: string | undefined,
  @Res() res: Response,
): Promise<void> {
  const { order, created } = await this.ordersService.create(dto, idempotencyKey);
  const status = created ? HttpStatus.CREATED : HttpStatus.OK;
  res.status(status).json(new OrderResponseDto(order));
}

// findOne — validate UUID before hitting DB
@Get(':id')
async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<OrderResponseDto> {
  const order = await this.ordersService.findOne(id);
  return new OrderResponseDto(order);
}

// transitionStatus — validate UUID before hitting DB
@Patch(':id/status')
async transitionStatus(
  @Param('id', ParseUUIDPipe) id: string,
  @Body() dto: TransitionStatusDto,
): Promise<OrderResponseDto> {
  const order = await this.ordersService.transitionStatus(id, dto.status);
  return new OrderResponseDto(order);
}
```

**Acceptance Criteria:**
```bash
# POST → 201
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"partnerId":"p1","patientReference":"ref1","requestedLocation":"loc1","priority":"routine"}'
# → 201

# POST replay → 200
KEY=$(uuidgen)
curl -s -X POST http://localhost:3000/orders -H "Idempotency-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{"partnerId":"p1","patientReference":"ref1","requestedLocation":"loc1","priority":"routine"}'
# Run twice; second → 200

# Invalid UUID → 400
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/orders/not-a-uuid
# → 400

# Non-existent UUID → 404
curl -s -o /dev/null -w "%{http_code}" \
  http://localhost:3000/orders/00000000-0000-0000-0000-000000000000
# → 404
```

> **Agent Note:** Two common mistakes here:
> 1. The agent returns `201` for all `POST /orders` responses including replays. The
>    handler MUST use `@Res()` to control the status code dynamically. Paste the
>    `create` handler above verbatim.
> 2. The agent uses `@Get(':id')` before `@Get()`, breaking Express routing — always
>    put the more specific route last or use explicit route strings.

---

### T-17 Response Serialiser & Field Exclusion

- [ ] **Status:** Not started

**Objective:** Ensure `idempotencyKey` and `payloadHash` are never included in any API
response, and that `Date` objects are always serialised to ISO8601 UTC strings.

**Outputs:** Verify `OrderResponseDto` from T-09 is applied correctly in controller.
No new files if T-09 was implemented correctly.

**Verification steps:**
1. Enable `ClassSerializerInterceptor` globally in `AppModule`:
   ```typescript
   providers: [
     { provide: APP_INTERCEPTOR, useClass: ClassSerializerInterceptor }
   ]
   ```
2. Confirm `@Exclude()` on `OrderResponseDto` class and `@Expose()` on permitted fields.

**Acceptance Criteria:**
```bash
ORDER_ID=$(curl -s -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"partnerId":"p","patientReference":"r","requestedLocation":"l","priority":"routine"}' \
  | jq -r .id)

curl -s http://localhost:3000/orders/$ORDER_ID | jq 'keys'
# Must be exactly: ["createdAt","id","partnerId","patientReference","priority","requestedLocation","status","updatedAt"]
# idempotencyKey and payloadHash must NOT appear

curl -s http://localhost:3000/orders/$ORDER_ID | jq '.createdAt'
# Must end in "Z" (UTC): "2026-06-27T10:00:00.000Z"
```

---

## Phase 6 — Operability

### T-18 Health Module

- [ ] **Status:** Not started

**Objective:** Implement `GET /health` (liveness — no deps checked) and `GET /ready`
(readiness — checks DB connectivity).

**Outputs:**
```
src/health/
├── health.module.ts
└── health.controller.ts
```

**Controller implementation:**
```typescript
@Controller()
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  async ready(@Res() res: Response) {
    try {
      await this.dataSource.query('SELECT 1');
      res.status(200).json({
        status:    'ready',
        database:  'connected',
        timestamp: new Date().toISOString(),
      });
    } catch {
      res.status(503).json({
        status:    'not_ready',
        database:  'disconnected',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
```

**Acceptance Criteria:**
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health  # → 200
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ready   # → 200
curl -s http://localhost:3000/health | jq .status   # → "ok"
curl -s http://localhost:3000/ready  | jq .database # → "connected"
```
- `/health` does NOT query the database
- `/ready` returns `503` when DB is unreachable (test by stopping Postgres container)

---

### T-19 Structured Logging

- [ ] **Status:** Not started

**Objective:** Replace the default NestJS logger with Winston in JSON format. Emit
structured fields (`requestId`, `orderId`, `partnerId`, `durationMs`) on key events.
Ensure `patientReference` never appears in logs above `debug` level.

**Outputs:**
```
src/
├── logger/
│   ├── logger.module.ts
│   └── logger.service.ts     (Winston wrapper)
└── middleware/
    └── request-logging.middleware.ts
```

**`logger.module.ts`** — configure Winston with JSON transport:
```typescript
WinstonModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
        silent: config.get('NODE_ENV') === 'test',
      }),
    ],
    level: config.get('LOG_LEVEL', 'info'),
  }),
})
```

**Acceptance Criteria:**
```bash
npm run start:dev 2>&1 | head -5 | jq .   # each log line is valid JSON
npm run start:dev 2>&1 | grep patientRef   # → no output (not logged at info)
```
- Log lines are valid JSON (parseable by `jq`)
- `level`, `timestamp`, `message` present in every line
- `requestId` present in request-scoped log lines
- `patientReference` never appears in non-debug logs

---

## Phase 7 — Unit Tests

### T-20 Unit Tests — State Machine

- [ ] **Status:** Not started

**Objective:** Write exhaustive unit tests for `isValidTransition`, covering every row
in the SPEC.md §6 transition table (both allowed and disallowed).

**Outputs:** `src/orders/domain/transitions.spec.ts`

**Test structure — every case must be explicit:**
```typescript
describe('isValidTransition', () => {
  // Allowed transitions
  it.each([
    ['received',    'accepted'],
    ['received',    'rejected'],
    ['accepted',    'in_progress'],
    ['accepted',    'rejected'],
    ['in_progress', 'completed'],
  ])('allows %s → %s', (from, to) => {
    expect(isValidTransition(from as OrderStatus, to as OrderStatus)).toBe(true);
  });

  // Disallowed transitions
  it.each([
    ['received',    'in_progress'],
    ['received',    'completed'],
    ['accepted',    'received'],
    ['accepted',    'completed'],
    ['in_progress', 'rejected'],
    ['in_progress', 'received'],
    ['in_progress', 'accepted'],
    ['completed',   'received'],
    ['completed',   'accepted'],
    ['completed',   'in_progress'],
    ['completed',   'rejected'],
    ['rejected',    'received'],
    ['rejected',    'accepted'],
    ['rejected',    'in_progress'],
    ['rejected',    'completed'],
  ])('rejects %s → %s', (from, to) => {
    expect(isValidTransition(from as OrderStatus, to as OrderStatus)).toBe(false);
  });
});
```

**Acceptance Criteria:**
```bash
npm run test:unit -- transitions.spec --reporter=verbose
# 20 tests — all pass
```

---

### T-21 Unit Tests — Idempotency & Payload Hash

- [ ] **Status:** Not started

**Objective:** Unit-test `hashPayload` determinism and `OrdersService.create`
idempotency logic using a mocked repository.

**Outputs:**
```
src/orders/domain/payload-hash.spec.ts    (extend existing)
src/orders/orders.service.spec.ts
```

**Required test cases for `OrdersService.create`:**
1. New order (no prior key) → `{ created: true }` with the new order
2. Same key, same payload → `{ created: false }` with original order
3. Same key, different payload → throws `ConflictException`
4. Repository `save` throws non-unique error → re-thrown unchanged
5. No idempotency key provided → creates order without deduplication

**Mock pattern:**
```typescript
const mockRepo = {
  create:      vi.fn(),
  save:        vi.fn(),
  findOneBy:   vi.fn(),
  findOneByOrFail: vi.fn(),
  // ...
};
```

**Acceptance Criteria:**
```bash
npm run test:unit -- orders.service.spec --reporter=verbose
# All 5 idempotency cases pass
npm run test:unit -- payload-hash.spec --reporter=verbose
# hashPayload determinism + different payload → different hash
```

---

### T-22 Unit Tests — DTO Validation

- [ ] **Status:** Not started

**Objective:** Test that `class-validator` decorators reject invalid inputs and accept
valid inputs for all three request DTOs.

**Outputs:** `src/orders/dto/dtos.spec.ts`

**Required cases:**
- `CreateOrderDto`: missing `partnerId` → fails; all fields present → passes
- `CreateOrderDto`: `priority: 'bad'` → fails; `priority: 'routine'` → passes
- `CreateOrderDto`: unknown field present → passes validation (filtering handled by pipe)
- `ListOrdersQueryDto`: `pageSize: 200` → fails; `pageSize: 100` → passes
- `ListOrdersQueryDto`: `status: 'unknown'` → fails; `status: 'received'` → passes
- `TransitionStatusDto`: `status: 'flying'` → fails; `status: 'accepted'` → passes

**Acceptance Criteria:**
```bash
npm run test:unit -- dtos.spec --reporter=verbose   # all pass
```

---

## Phase 8 — Integration Tests

### T-23 Integration Tests — Happy Path Lifecycle

- [ ] **Status:** Not started

**Objective:** Write integration tests that exercise the full order lifecycle against a
real Postgres database, asserting HTTP status codes, response shapes, and database state.

**Outputs:**
```
test/
├── global-setup.ts                   (Postgres connection, migration runner, table cleaner)
└── orders-lifecycle.e2e.ts
```

**Test database setup:**
```typescript
// test/database-setup.ts
import { DataSource } from 'typeorm';

export async function setupTestDb(): Promise<DataSource> {
  const ds = new DataSource({
    type:        'postgres',
    url:         process.env.DATABASE_URL,
    entities:    ['src/**/*.entity.ts'],
    migrations:  ['src/migrations/*.ts'],
    migrationsRun: true,
  });
  await ds.initialize();
  return ds;
}

export async function verifySchema(ds: DataSource): Promise<void> {
  const constraints = await ds.query(`
    SELECT
        tc.constraint_type,
        kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name='orders'
  `);

  const hasPrimaryKey = constraints.some(
    (c: Record<string, unknown>) => c.constraint_type === 'PRIMARY KEY',
  );
  const hasIdempotencyConstraint = constraints.some(
    (c: Record<string, unknown>) =>
      c.constraint_type === 'UNIQUE' && c.column_name === 'idempotency_key',
  );
  if (!hasPrimaryKey) {
    throw new Error('Orders table is missing PRIMARY KEY.');
  }
  if (!hasIdempotencyConstraint) {
    throw new Error('Orders table is missing UNIQUE constraint on idempotency_key.');
  }
}

export async function truncateTables(ds: DataSource, tables: string[]): Promise<void> {
  if (!tables.length) return;
  const sql = tables.map((table) => `"${table}"`).join(', ');
  await ds.query(`TRUNCATE TABLE ${sql} RESTART IDENTITY CASCADE`);
}
```

**Required test cases:**
```typescript
describe('Orders — Happy Path', () => {
  it('POST /orders → 201, returns correct shape');
  it('GET /orders — returns created order in list');
  it('GET /orders/:id — returns correct order');
  it('PATCH /orders/:id/status → accepted — 200, status updated');
  it('PATCH /orders/:id/status → in_progress — 200, status updated');
  it('PATCH /orders/:id/status → completed — 200, status updated');
  it('GET /orders?status=completed — returns only completed orders');
  it('GET /orders?partnerId=partner-x — returns only that partner\'s orders');
  it('GET /orders?page=2&pageSize=1 — returns second page');
  it('response never contains idempotencyKey or payloadHash');
  it('createdAt and updatedAt are ISO8601 UTC strings');
  it('updatedAt changes after status transition');
})
```

**Acceptance Criteria:**
```bash
DATABASE_URL=postgresql://user:password@localhost:5432/screening_orders_test \
  npm run test:integration -- lifecycle --reporter=verbose
# All tests pass
```

---

### T-24 Integration Tests — Concurrent Idempotency

- [ ] **Status:** Not started

**Objective:** Prove that 10 concurrent `POST /orders` requests with the same
`Idempotency-Key` produce exactly one order in the database.

**This is the single most important integration test in the service.**

**Outputs:** `test/orders-idempotency.e2e.ts`

**Required test cases:**
```typescript
describe('Orders — Idempotency', () => {
  it('second POST with same key → 200 (not 201)');
  it('second POST with same key → same order id');
  it('second POST with same key, different payload → 409');

  it('10 concurrent POSTs with same key → exactly 1 order created', async () => {
    const key  = uuidv4();
    const body = { partnerId: 'p', patientReference: 'r',
                   requestedLocation: 'l', priority: 'routine' };

    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(app.getHttpServer())
          .post('/orders')
          .set('Idempotency-Key', key)
          .send(body)
      )
    );

    const statusCodes = responses.map(r => r.status);
    expect(statusCodes.filter(s => s === 201)).toHaveLength(1);
    expect(statusCodes.filter(s => s === 200)).toHaveLength(9);

    const ids = responses.map(r => r.body.id as string);
    expect(new Set(ids).size).toBe(1);   // all return same id

    const count = await ds.query(
      'SELECT COUNT(*) FROM orders WHERE idempotency_key = $1', [key]
    );
    expect(Number(count[0].count)).toBe(1);   // exactly 1 row in DB
  });
});
```

**Acceptance Criteria:**
```bash
npm run test:integration -- idempotency --reporter=verbose
# All pass, especially the 10-concurrent test
```

> **Agent Note:** If this test fails with more than one order in the database, the
> idempotency implementation has the pre-insert SELECT bug from T-10. Do not "fix"
> the test — fix the implementation. The 10-concurrent test is the regression guard.

---

### T-25 Integration Tests — Error Scenarios

- [ ] **Status:** Not started

**Objective:** Confirm that every documented error scenario returns the correct HTTP
status code and the standard error schema.

**Outputs:** `test/orders-errors.e2e.ts`

**Required test cases:**
```typescript
describe('Orders — Error Scenarios', () => {
  // 400
  it('POST with missing required field → 400 with errors[]');
  it('POST with invalid priority enum → 400 with errors[]');
  it('POST with unknown extra field → 400 (not stripped silently)');
  it('GET /orders/:id with non-UUID id → 400');
  it('GET /orders?pageSize=200 → 400');
  it('PATCH with invalid status enum → 400');

  // 404
  it('GET /orders/00000000-... → 404');
  it('PATCH /orders/00000000-.../status → 404');

  // 409 — Invalid transitions
  it.each([
    ['received',    'in_progress'],
    ['received',    'completed'],
    ['in_progress', 'rejected'],
    ['completed',   'received'],
    ['rejected',    'accepted'],
  ])('PATCH status %s → %s → 409', async (_, to) => { /* ... */ });

  // Error schema shape
  it('all error responses have statusCode, message, timestamp, path');
  it('400 responses have errors[] array');
  it('409 conflict message includes from and to status names');
})
```

**Acceptance Criteria:**
```bash
npm run test:integration -- errors --reporter=verbose   # all pass
```

---

## Phase 9 — Infrastructure

### T-26 Dockerfile — Multi-Stage Build

- [ ] **Status:** Not started

**Objective:** Write a production-ready multi-stage Dockerfile with a non-root user,
minimal final image, and a `HEALTHCHECK` using the `/health` endpoint.

**Outputs:** `candidate/service/Dockerfile`

**Required Dockerfile (from SPEC.md §14):**
```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production image
FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup --system app && adduser --system --ingroup app app
COPY --from=builder /app/dist         ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e \
    "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1))"
CMD ["node", "dist/main.js"]
```

**Acceptance Criteria:**
```bash
docker build -t screening-order-service .          # exits 0
docker run --rm -e DATABASE_URL=postgresql://x:y@missing/db \
  screening-order-service 2>&1 | grep -i "DATABASE_URL"
# Service refuses to start and logs the validation error
docker images screening-order-service --format "{{.Size}}"
# Image size < 300MB (alpine base ensures this)
```

---

### T-27 docker-compose.yml

- [ ] **Status:** Not started

**Objective:** Write a `docker-compose.yml` that starts the API service and Postgres with
a healthcheck dependency, runs migrations on startup, and correctly passes environment
variables.

**Outputs:** `candidate/service/docker-compose.yml`

**Required content (from SPEC.md §14):**
Add a migration runner as an init service or as the `command` on startup. Simplest
approach: override CMD to run migrations then start:

```yaml
version: '3.9'
services:
  api:
    build: .
    ports:
      - "${API_PORT:-3000}:3000"
    command: >
      sh -c "node -e \"const {DataSource}=require('typeorm');
        new DataSource({type:'postgres',url:process.env.DATABASE_URL,
        migrations:['dist/migrations/*.js']}).initialize()
        .then(ds=>ds.runMigrations()).then(()=>process.exit(0))\" &&
        node dist/main.js"
    environment:
      DATABASE_URL:  postgresql://user:password@postgres:5432/screening_orders
      NODE_ENV:      development
      LOG_LEVEL:     debug
      CORS_ORIGIN:   http://localhost:5173
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER:     user
      POSTGRES_PASSWORD: password
      POSTGRES_DB:       screening_orders
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test:     ["CMD-SHELL", "pg_isready -U user -d screening_orders"]
      interval: 5s
      timeout:  3s
      retries:  10

volumes:
  postgres_data:
```

**Acceptance Criteria:**
```bash
docker compose up --build -d
sleep 10
curl -s http://localhost:3000/ready | jq .status   # → "ready"
curl -s http://localhost:3000/health | jq .status  # → "ok"
docker compose down -v
```

---

### T-28 GitHub Actions CI Workflow

- [ ] **Status:** Not started

**Objective:** Create a CI workflow that installs, lints, builds, runs all migrations,
runs unit tests, and runs integration tests, with Postgres as a service container.
Must pass on a clean checkout.

**Outputs:** `.github/workflows/ci.yml` (relative to repo root)

**Required workflow (from SPEC.md §14):**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  ci:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: candidate/service

    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER:     user
          POSTGRES_PASSWORD: password
          POSTGRES_DB:       screening_orders_test
        options: >-
          --health-cmd "pg_isready -U user"
          --health-interval 5s
          --health-timeout 3s
          --health-retries 10
        ports:
          - 5432:5432

    env:
      DATABASE_URL: postgresql://user:password@localhost:5432/screening_orders_test
      NODE_ENV:     test

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: candidate/service/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run build
      - run: npm run migration:run
      - run: npm run test:unit
      - run: npm run test:integration
```

**Acceptance Criteria:**
- Push to main branch triggers the workflow
- All steps pass on a clean checkout (no uncommitted files needed)
- Workflow uses `working-directory: candidate/service`
- Integration tests have access to a live Postgres via the `services` block

> **Agent Note:** Agents often forget `working-directory` when the service is in a
> subdirectory, causing all `npm` commands to fail with "package.json not found".
> Also check `cache-dependency-path` points to the correct `package-lock.json`.

---

## Phase 10 — Terraform

### T-29 Terraform Module

- [ ] **Status:** Not started

**Objective:** Write a well-structured Terraform module that describes the cloud
deployment topology for this service — plan-only, targeting AWS, without requiring a
live account.

**Outputs:**
```
candidate/terraform/
├── main.tf           (ECS Fargate service + task definition)
├── database.tf       (RDS PostgreSQL instance + subnet group + parameter group)
├── networking.tf     (security groups, referencing existing VPC via variable)
├── ecr.tf            (ECR repository for container image)
├── logging.tf        (CloudWatch log group)
├── variables.tf      (all configurable inputs)
├── outputs.tf        (service URL, RDS endpoint, ECR repo URL)
└── README.md         (inputs/outputs table, usage example)
```

**Required variables (all must be in `variables.tf`):**

| Variable | Type | Description |
|----------|------|-------------|
| `region` | string | AWS region |
| `environment` | string | `dev`, `staging`, `production` |
| `vpc_id` | string | Existing VPC to deploy into |
| `subnet_ids` | list(string) | Subnets for ECS + RDS |
| `db_instance_class` | string | RDS instance class (e.g. `db.t3.micro`) |
| `db_password` | string, sensitive | RDS master password |
| `service_image` | string | Container image URI (e.g. ECR URL) |
| `service_cpu` | number | ECS task CPU units (e.g. 256) |
| `service_memory` | number | ECS task memory in MiB (e.g. 512) |
| `service_desired_count` | number | Number of ECS task instances |
| `cors_origin` | string | Allowed CORS origin for the service |

**Required outputs (all must be in `outputs.tf`):**
- `service_url` — Load balancer DNS name
- `rds_endpoint` — RDS hostname for service configuration
- `ecr_repository_url` — ECR URL for pushing images

**Acceptance Criteria:**
```bash
cd candidate/terraform
terraform init     # exits 0 (downloads providers)
terraform validate # exits 0 (no syntax errors)
terraform plan -var="region=us-east-1" \
  -var="vpc_id=vpc-00000000" \
  -var="subnet_ids=[\"subnet-00000000\"]" \
  -var="db_password=testpassword" \
  -var="service_image=000000000000.dkr.ecr.us-east-1.amazonaws.com/service:latest" \
  -var="environment=dev"
# exits 0 (plan produces output, even without credentials it validates structure)
```

> **Note:** `terraform plan` without AWS credentials will error on the provider init.
> Use `terraform validate` as the primary check. The plan output demonstrates structure,
> not a working deployment.

---

## Phase 11 — Documentation

### T-30 README.md

- [ ] **Status:** Not started

**Objective:** Write a `README.md` at `candidate/service/README.md` that allows a team
member with no prior context to clone, start, and test the service in under 5 minutes.

**Outputs:** `candidate/service/README.md`

**Required sections:**

```markdown
# Screening Order Service

## Prerequisites
(Node 20+, Docker, Docker Compose, make (optional))

## Quick Start (Docker Compose — recommended)
# Commands to go from zero to running in < 5 minutes

## Local Development (without Docker)
# Install deps, set up .env, run migrations, run dev server

## Running Tests
npm run test:unit
npm run test:integration   # requires Postgres

## API Reference
# One-liner per endpoint with example curl command

## Environment Variables
# Table of all variables with defaults

## Architecture Notes
# Brief description pointing to SPEC.md and TASKS.md

## Known Trade-offs & What's Next
# What was scoped out and why
```

**Acceptance Criteria:**
- A fresh pair of eyes can run `docker compose up --build` and curl the API in < 10 minutes
- All npm scripts are documented (`build`, `lint`, `typecheck`, `test:unit`, `test:integration`, `migration:run`)
- No references to setup steps that don't actually work

---

## `package.json` Scripts Reference

All scripts below must be present and functional before any task in Phase 7 or later.

```json
{
  "scripts": {
    "build":            "nest build",
    "start":            "node dist/main",
    "start:dev":        "nest start --watch",
    "lint":             "eslint \"{src,test}/**/*.ts\" --fix",
    "typecheck":        "tsc --noEmit",
    "test:unit":        "vitest run src --reporter=verbose",
    "test:integration": "vitest run test --reporter=verbose",
    "test:all":         "vitest run --reporter=verbose",
    "test:cov":         "vitest run --coverage",
    "migration:generate": "typeorm-ts-node-commonjs migration:generate src/migrations/$npm_config_name -d src/database/datasource.ts",
    "migration:run":      "typeorm-ts-node-commonjs migration:run -d src/database/datasource.ts",
    "migration:revert":   "typeorm-ts-node-commonjs migration:revert -d src/database/datasource.ts"
  }
}
```

---

## Time Budget

| Phase | Tasks | Estimated |
|-------|-------|-----------|
| 0 — Foundation | T-01, T-02 | 25 min |
| 1 — Domain | T-03, T-04, T-05 | 20 min |
| 2 — Persistence | T-06, T-07, T-08 | 30 min |
| 3 — HTTP Contract | T-09 | 10 min |
| 4 — Service Layer | T-10, T-11, T-12, T-13 | 55 min |
| 5 — HTTP Layer | T-14, T-15, T-16, T-17 | 55 min |
| 6 — Operability | T-18, T-19 | 25 min |
| 7 — Unit Tests | T-20, T-21, T-22 | 40 min |
| 8 — Integration Tests | T-23, T-24, T-25 | 60 min |
| 9 — Infrastructure | T-26, T-27, T-28 | 35 min |
| 10 — Terraform | T-29 | 20 min |
| 11 — Docs | T-30 | 15 min |
| **Total** | **30 tasks** | **~6 h** |

> **4-hour target:** Complete Phases 0–8 (T-01 through T-25). Terraform (T-29) and
> the README (T-30) are the cleanest scope-cut if time is short — document the intent in
> `AI_USAGE.md`.

---

## Agent Orchestration Notes

When directing a coding agent through these tasks:

1. **One task per prompt.** Sending multiple tasks in a single prompt results in the
   agent taking shortcuts, especially skipping validation or test cases it deems
   "redundant." Each task is a single agent invocation.

2. **Always include SPEC.md context.** Paste the relevant SPEC.md section(s) into
   the prompt for each task. Agents working without the spec produce generic NestJS
   code, not Mirantus-compliant code.

3. **Run acceptance criteria before marking done.** The task isn't done when the agent
   says it's done. Run the shell commands under "Acceptance Criteria" and only check
   the task off when they all pass.

4. **Watch for regressions.** After T-15 (Exception Filter), run the T-14 curl test
   again — agents sometimes break the ValidationPipe when adding the filter. After
   T-17 (Serialiser), re-run the T-16 curl tests.

5. **Never let the agent "tidy up" previously working code** unless you have run tests
   first. Agents often refactor working code during unrelated tasks and introduce bugs.

6. **Flag the three critical tests to the agent explicitly:**
   - T-14: Unknown fields return 400 (not stripped silently)
   - T-24: 10 concurrent requests with same key → exactly 1 order
   - T-20: `in_progress → rejected` is false

---

**Document Status:** Ready for implementation  
**Author:** Babajide Williams  
**Last Updated:** June 27, 2026
