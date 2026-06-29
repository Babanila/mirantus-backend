# Mirantus Screening Order Service (Technical Specification)

| Field        | Value                                         |
|--------------|-----------------------------------------------|
| Version      | 1.0                                           |
| Date         | June 27, 2026                                 |
| Status       | **Normative — Approved for Implementation**   |
| Author       | Babajide Williams.                            |
| Repository   | `candidate/service/`                          |

> **Authority.** This document is the single source of truth for all implementation
> decisions. Where this document uses **MUST** or **MUST NOT**, that requirement is
> non-negotiable — deviation is a defect, not a trade-off. Where it uses **SHOULD**, the
> guidance is strong and requires an explicit justification to override.
> If this document conflicts with any other document, this document takes precedence.

---

## Table of Contents

1. [Background & Goals](#1-background--goals)
2. [Scope & Out-of-Scope Decisions](#2-scope--out-of-scope-decisions)
3. [Architecture Overview](#3-architecture-overview)
4. [Technology Stack & Decisions](#4-technology-stack--decisions)
5. [Data Model](#5-data-model)
6. [State Machine — Status Lifecycle](#6-state-machine--status-lifecycle)
7. [Idempotency Design](#7-idempotency-design)
8. [API Surface](#8-api-surface)
9. [Validation Rules](#9-validation-rules)
10. [Error Handling Contract](#10-error-handling-contract)
11. [Observability & Operability](#11-observability--operability)
12. [Security & Privacy Considerations](#12-security--privacy-considerations)
13. [Configuration](#13-configuration)
14. [Infrastructure & Deployment](#14-infrastructure--deployment)
15. [Testing Requirements](#15-testing-requirements)
16. [Engineering Best-Practice Self-Review](#16-engineering-best-practice-self-review)
17. [Production Acceptance Checklist](#17-production-acceptance-checklist)
18. [Assumptions Register](#18-assumptions-register)

---

## Preface: Common Implementation Pitfalls

> Read this before writing a single line of code.

90% of all defects in this service are predictably one of the following:

| # | Mistake | Consequence |
|---|---------|-------------|
| 1 | Forgetting `forbidNonWhitelisted: true` on the global `ValidationPipe` | Unknown client properties silently accepted; security surface widens; future schema changes become dangerous |
| 2 | Checking the idempotency key *after* creating the order | Race condition under concurrent retries creates duplicates |
| 3 | Using a plain `UPDATE … WHERE id = ?` for status transitions | Lost update anomaly under concurrent writes; two writers can both read `received`, both write `accepted`, masking a bug |
| 4 | Returning `201` on an idempotent retry | Breaks every client that distinguishes first-create from replay |
| 5 | Diverging from the standard error response schema | Breaks frontend error rendering globally; every consumer must update parsers |
| 6 | Returning timestamps in local time instead of UTC | Produces non-deterministic output depending on host timezone |
| 7 | Forgetting to update `updatedAt` on status transition | Order history appears frozen; audit trail is wrong |

---

## 1. Background & Goals

### Context

Mirantus partners (opticians, clinics) submit screening orders that flow into Mirantus
operations. Currently no backend service exists to ingest, persist, and manage these
orders. This service fills that gap.

### Goals

1. Accept order creation with robust idempotency guarantees
2. Persist orders to a durable relational store with strict schema migrations
3. Enforce a defined order lifecycle via a validated state machine
4. Expose filtering and pagination for operations tooling
5. Signal health and readiness to infrastructure probes
6. Be operable from day one: structured logs, environment-driven config, runnable tests

### Non-Goals

This service will **NOT** do the following in v1. Each is a deliberate scope cut, not an
oversight. Re-evaluating any of these requires an explicit ADR.

| Not in v1 | Rationale |
|-----------|-----------|
| Authentication / API key validation | Assumed to be handled by an upstream API gateway |
| Per-partner authorisation (partner A cannot read partner B's orders) | Increases complexity significantly; deferred to v2 |
| Rate limiting | API gateway responsibility |
| Sorting (other than default `created_at DESC`) | Not requested; adds index complexity |
| Full-text search | Not requested |
| Wildcard or ILIKE filtering | Not requested; increases query attack surface |
| Partial updates (PATCH fields other than status) | Orders are immutable after creation |
| Soft-delete / archiving | Not requested; legal hold handled externally |
| GraphQL or any non-JSON response format | REST + JSON only |
| Multi-region replication | Deferred to infrastructure layer |
| Event streaming / message queue integration | Deferred to v2 |

---

## 2. Scope & Out-of-Scope Decisions

### In-Scope Deliverables

- NestJS + TypeScript service implementing all endpoints described in §8
- PostgreSQL persistence with versioned, reversible migrations
- Idempotent `POST /orders` via `Idempotency-Key` header
- Status lifecycle enforcement (§6)
- `GET /health` (liveness) and `GET /ready` (readiness) endpoints
- Structured JSON logging with request correlation IDs
- Environment-driven configuration (12-factor)
- `Dockerfile` and `docker-compose.yml` for local + CI use
- GitHub Actions CI: lint → build → unit tests → integration tests (with Postgres service)
- Terraform module describing the service's cloud deployment topology
- `TASKS.md`, `AI_USAGE.md`, and this `SPEC.md`

---

## 3. Architecture Overview

### Logical Layers

```
┌─────────────────────────────────────────────────────────────┐
│  React Test Harness (provided/frontend)                     │
│  Vite + TypeScript SPA — NOT a deliverable                  │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP + CORS
                            ▼
┌────────────────────────────────────────────────────────────┐
│  NestJS Application (candidate/service)                    │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  HTTP Layer                                         │   │
│  │  - Global ValidationPipe (whitelist, forbidExtra)   │   │
│  │  - Global Exception Filter (standard error schema)  │   │
│  │  - Request ID Middleware (X-Request-ID)             │   │
│  │  - Request Logging Middleware                       │   │
│  └───────────────────────┬─────────────────────────────┘   │
│                          │                                 │
│  ┌───────────────────────┴─────────────────────────────┐   │
│  │  Module Layer                                       │   │
│  │                                                     │   │
│  │  ┌───────────────┐  ┌──────────┐  ┌─────────────┐   │   │
│  │  │ OrdersModule  │  │  Health  │  │   Config    │   │   │
│  │  │ Controller    │  │  Module  │  │   Module    │   │   │
│  │  │ Service       │  │ /health  │  │ (env vars)  │   │   │
│  │  │ Repository    │  │ /ready   │  │             │   │   │
│  │  └───────┬───────┘  └────┬─────┘  └─────────────┘   │   │
│  │          │               │                          │   │
│  └──────────┼───────────────┼──────────────────────────┘   │
│             │               │                              │
│  ┌──────────┴───────────────┴───────────────────────────┐  │
│  │  Persistence Layer (TypeORM)                         │  │
│  │  - OrderEntity                                       │  │
│  │  - Migrations                                        │  │
│  └──────────────────────────┬───────────────────────────┘  │
└─────────────────────────────┼──────────────────────────────┘
                              │ TCP 5432
                              ▼
                   ┌──────────────────────┐
                   │  PostgreSQL 15       │
                   │  (Docker / managed)  │
                   └──────────────────────┘
```

### Project Structure

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

### Module Responsibilities

| Module | Responsibility |
|--------|----------------|
| `OrdersModule` | Create, read, list, status-transition all orders; idempotency logic |
| `HealthModule` | Liveness (`/health`) and readiness (`/ready`) probes |
| `AppConfigModule` | Load and validate all environment variables at startup |
| `DatabaseModule` | TypeORM DataSource setup, connection management |

---

## 4. Technology Stack & Decisions

### Required Stack (Non-Negotiable)

| Component | Choice | Justification |
|-----------|--------|---------------|
| Language | TypeScript (strict mode) | Type safety; required by case study |
| Framework | NestJS | Required by case study; IoC container, decorators, built-in validation |
| Database | PostgreSQL 15 | Required by case study; ACID, strong typing |
| Test runner | Vitest (preferred) or Jest | Required by case study |
| CI | GitHub Actions | Required by case study |
| IaC | Terraform | Required by case study |

### ORM Selection

**Choice: TypeORM**

Rationale: Decorator-based entity definitions align naturally with NestJS's class-based
approach. Migration tooling is mature and well-understood. Integration with NestJS via
`@nestjs/typeorm` is first-party and requires minimal configuration.

Trade-offs accepted:
- Prisma would offer better type inference and a more ergonomic query API; deferred to v2
- Drizzle would reduce runtime overhead but requires more ceremony at this scale
- Kysely is excellent for complex queries; unnecessary for this schema

**Migration tooling:** TypeORM CLI via `npm run migration:generate` and
`migration:run`. Migrations are committed to source control. Rollback via `migration:revert`.

### Dependency Justifications

| Package | Purpose | Why included |
|---------|---------|--------------|
| `@nestjs/common`, `@nestjs/core` | Framework | Required |
| `@nestjs/typeorm` | ORM integration | Required |
| `typeorm` | ORM | Required |
| `pg` | Postgres driver | Required |
| `class-validator` | DTO validation | Required for `ValidationPipe` |
| `class-transformer` | DTO transformation | Required for `ValidationPipe` with `transform: true` |
| `uuid` | UUID generation | Idempotency key comparison, order ID fallback |
| `winston` / `nest-winston` | Structured logging | JSON logs, level control per environment |
| `@nestjs/config` | Environment config | 12-factor config management |

---

## 5. Data Model

### Entity: `orders`

```sql
CREATE TABLE orders (
  id               UUID          NOT NULL DEFAULT gen_random_uuid(),
  idempotency_key  VARCHAR(512)  NULL,
  partner_id       VARCHAR(255)  NOT NULL,
  patient_reference VARCHAR(255) NOT NULL,
  requested_location VARCHAR(255) NOT NULL,
  priority         VARCHAR(20)   NOT NULL,
  status           VARCHAR(20)   NOT NULL DEFAULT 'received',
  payload_hash     VARCHAR(64)   NULL,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT orders_pkey
    PRIMARY KEY (id),
  CONSTRAINT orders_idempotency_key_uq
    UNIQUE (idempotency_key),
  CONSTRAINT orders_priority_check
    CHECK (priority IN ('routine', 'urgent')),
  CONSTRAINT orders_status_check
    CHECK (status IN ('received', 'accepted', 'in_progress', 'completed', 'rejected'))
);
```

### Indices

```sql
-- Fast lookup by idempotency key (most latency-sensitive path)
CREATE UNIQUE INDEX idx_orders_idempotency_key
  ON orders (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Supports GET /orders?partnerId=...
CREATE INDEX idx_orders_partner_id ON orders (partner_id);

-- Supports GET /orders?status=...
CREATE INDEX idx_orders_status ON orders (status);

-- Default sort order for list endpoint
CREATE INDEX idx_orders_created_at ON orders (created_at DESC);

-- Composite for the most common filtered+sorted list query
CREATE INDEX idx_orders_partner_status
  ON orders (partner_id, status, created_at DESC);
```

### Field Definitions

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | UUID | No | Primary key; server-generated |
| `idempotency_key` | VARCHAR(512) | Yes | Client-supplied; unique when present |
| `partner_id` | VARCHAR(255) | No | Partner organisation identifier |
| `patient_reference` | VARCHAR(255) | No | Pseudonymous patient token; not raw PII |
| `requested_location` | VARCHAR(255) | No | Facility or geographic identifier |
| `priority` | VARCHAR(20) | No | `routine` or `urgent` |
| `status` | VARCHAR(20) | No | Current lifecycle state; default `received` |
| `payload_hash` | VARCHAR(64) | Yes | SHA-256 of normalised request payload; used for idempotency conflict detection |
| `created_at` | TIMESTAMPTZ | No | UTC; set on insert, never modified |
| `updated_at` | TIMESTAMPTZ | No | UTC; **MUST** be updated on every write |

### TypeScript Entity

```typescript
@Entity('orders')
export class OrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 512, nullable: true, unique: true })
  idempotencyKey: string | null;

  @Column({ name: 'partner_id', type: 'varchar', length: 255 })
  partnerId: string;

  @Column({ name: 'patient_reference', type: 'varchar', length: 255 })
  patientReference: string;

  @Column({ name: 'requested_location', type: 'varchar', length: 255 })
  requestedLocation: string;

  @Column({ type: 'varchar', length: 20 })
  priority: 'routine' | 'urgent';

  @Column({ type: 'varchar', length: 20, default: 'received' })
  status: OrderStatus;

  @Column({ name: 'payload_hash', type: 'varchar', length: 64, nullable: true })
  payloadHash: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
```

### TypeScript Enums

```typescript
export enum OrderStatus {
  RECEIVED    = 'received',
  ACCEPTED    = 'accepted',
  IN_PROGRESS = 'in_progress',
  COMPLETED   = 'completed',
  REJECTED    = 'rejected',
}

export enum OrderPriority {
  ROUTINE = 'routine',
  URGENT  = 'urgent',
}
```

### Serialised Order Resource (API Response Shape)

Every endpoint that returns an order **MUST** return exactly this JSON shape:

```json
{
  "id":                "3f2cb0d4-1c6a-4e1b-8a5f-aa291d8e3210",
  "partnerId":         "partner-clinic-sf",
  "patientReference":  "patient-abc-1234",
  "requestedLocation": "clinic-san-francisco",
  "priority":          "routine",
  "status":            "received",
  "createdAt":         "2026-06-27T10:00:00.000Z",
  "updatedAt":         "2026-06-27T10:00:00.000Z"
}
```

**MUST NOT** expose: `idempotencyKey`, `payloadHash`, or any internal column.

---

## 6. State Machine — Status Lifecycle

### Allowed Transitions

```
  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  received ──────────────────────────────────────┐    │
  │      │                                          │    │
  │      │ accept                                   │    │
  │      ▼                                          │    │
  │  accepted ──────────────────────────────────┐   │    │
  │      │                                      │   │    │
  │      │ start                                │   │    │
  │      ▼                                      │   │    │
  │  in_progress                                │   │    │
  │      │                                      │   │    │
  │      │ complete                             │ reject │
  │      ▼                                      │   │    │
  │  completed ◄─ (TERMINAL, no exit)           │   │    │
  │                                             ▼   ▼    │
  │                                          rejected    │
  │                                   (TERMINAL, no exit)│
  └──────────────────────────────────────────────────────┘
```

### Transition Table

| From | To | Allowed | HTTP Response on Violation |
|------|----|---------|----------------------------|
| `received` | `accepted` | ✅ | — |
| `received` | `rejected` | ✅ | — |
| `received` | `in_progress` | ❌ | `409 Conflict` |
| `received` | `completed` | ❌ | `409 Conflict` |
| `accepted` | `in_progress` | ✅ | — |
| `accepted` | `rejected` | ✅ | — |
| `accepted` | `received` | ❌ | `409 Conflict` |
| `accepted` | `completed` | ❌ | `409 Conflict` |
| `in_progress` | `completed` | ✅ | — |
| `in_progress` | `rejected` | ❌ | `409 Conflict` (terminal path must be accepted first) |
| `in_progress` | `received` | ❌ | `409 Conflict` |
| `in_progress` | `accepted` | ❌ | `409 Conflict` |
| `completed` | *(any)* | ❌ | `409 Conflict` — terminal state |
| `rejected` | *(any)* | ❌ | `409 Conflict` — terminal state |

> **Note on `rejected` from `in_progress`:** Rejecting after work has started is a
> deliberate business restriction. If the product requirement changes to allow it, that
> is a spec amendment, not a bug fix.

### Implementation Contract

The transition validator **MUST** be a pure function with zero side-effects:

```typescript
const VALID_TRANSITIONS: Record<OrderStatus, ReadonlySet<OrderStatus>> = {
  [OrderStatus.RECEIVED]:    new Set([OrderStatus.ACCEPTED, OrderStatus.REJECTED]),
  [OrderStatus.ACCEPTED]:    new Set([OrderStatus.IN_PROGRESS, OrderStatus.REJECTED]),
  [OrderStatus.IN_PROGRESS]: new Set([OrderStatus.COMPLETED]),
  [OrderStatus.COMPLETED]:   new Set(),
  [OrderStatus.REJECTED]:    new Set(),
};

export function isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
  return VALID_TRANSITIONS[from]?.has(to) ?? false;
}
```

This function **MUST** be unit-tested exhaustively (every cell in the transition table above).

### Atomicity Requirement

Status updates **MUST** use a compare-and-swap pattern to prevent lost updates under
concurrent writes:

```sql
UPDATE orders
SET    status     = :newStatus,
       updated_at = NOW()
WHERE  id         = :id
AND    status     = :expectedCurrentStatus
RETURNING *;
```

If the `UPDATE` returns zero rows, the service **MUST** re-fetch the current order and
determine whether the order no longer exists (`404`) or whether a concurrent write
changed the status first (`409`). It **MUST NOT** assume a specific cause.

---

## 7. Idempotency Design

### Purpose

Partners (clients) may retry `POST /orders` on network failure. Without idempotency
controls, each retry creates a duplicate order. The `Idempotency-Key` header provides an
atomic, once-and-only-once guarantee.

### Behaviour Specification

| Scenario | Expected Response | Status Code |
|----------|--------------------|-------------|
| First request — new key, valid payload | Created order | `201 Created` |
| Retry — same key, same payload | Existing order (unchanged) | `200 OK` |
| Conflict — same key, different payload | Error response | `409 Conflict` |
| No `Idempotency-Key` header | Created order (no deduplication) | `201 Created` |
| Idempotency store unavailable | Error response | `503 Service Unavailable` |

### Critical Implementation Constraints

1. **Lock before write.** The idempotency key **MUST** be written to the database as
   part of the same transaction that creates the order. It **MUST NOT** be checked in a
   prior query that is separate from the insert — this is a race condition.

2. **Use a database UNIQUE constraint.** The unique constraint on `idempotency_key` is
   the enforcer. Application-level checks are a pre-flight optimisation, not a
   substitute. Under concurrent load, two threads can both pass an application-level
   "does key exist?" check simultaneously; only the database constraint is serialised.

3. **Atomic insert pattern:**

   ```typescript
   try {
     const order = this.repo.create({ ...dto, idempotencyKey: key, payloadHash: hash });
     return { order: await this.repo.save(order), created: true };
   } catch (err) {
     if (isUniqueViolation(err)) {
       const existing = await this.repo.findOneByOrFail({ idempotencyKey: key });
       if (existing.payloadHash !== hash) {
         throw new ConflictException('Idempotency key already used with a different payload');
       }
       return { order: existing, created: false };
     }
     throw err;
   }
   ```

   Where `isUniqueViolation` checks `error.code === '23505'` (PostgreSQL unique violation).

4. **Payload comparison.** To detect a different-payload conflict, compute a
   **SHA-256** hash of the normalised request body (keys sorted, whitespace stripped)
   before any defaults are applied, and store it alongside the order. Compare hashes on
   lookup. **MUST NOT** compare raw JSON strings (field ordering is not guaranteed across
   client implementations).

   ```typescript
   function hashPayload(dto: CreateOrderDto): string {
     const normalised = JSON.stringify(
       Object.fromEntries(Object.entries(dto).sort())
     );
     return createHash('sha256').update(normalised).digest('hex');
   }
   ```

5. **Key format.** The `Idempotency-Key` header **SHOULD** be a UUID v4. The service
   **MUST** accept any non-empty string ≤ 512 characters; it **MUST NOT** reject
   non-UUID keys, as some clients generate other formats. The service **SHOULD** log a
   warning if the value is not UUID-shaped.

6. **Idempotency-Key TTL.** Keys are stored indefinitely in v1 (no TTL / expiry). A
   cleanup job is a v2 concern.

### Idempotency Error Body

For a same-key different-payload conflict:

```json
{
  "statusCode": 409,
  "message": "Idempotency-Key has already been used with a different request payload",
  "timestamp": "2026-06-27T10:00:00.000Z",
  "path": "/orders"
}
```

---

## 8. API Surface

### Global Validation Pipe Configuration

This is the single most critical piece of configuration in the entire application.

```typescript
// main.ts — MUST be exactly this
app.useGlobalPipes(
  new ValidationPipe({
    whitelist:            true,   // Strip unknown properties
    forbidNonWhitelisted: true,   // Reject (400) if unknown properties are present
    transform:            true,   // Coerce query params to declared types
    transformOptions: {
      enableImplicitConversion: false,  // Explicit conversions only
    },
  }),
);
```

**`forbidNonWhitelisted: true` is non-negotiable.** Disabling it opens the service to
silent future schema confusion and is a security surface.

---

### 8.1 `POST /orders` — Create Order

| Attribute | Value |
|-----------|-------|
| Method | `POST` |
| Path | `/orders` |
| Idempotent | Yes, via `Idempotency-Key` header |
| Auth | None (gateway responsibility) |

**Request Headers:**

| Header | Required | Format | Example |
|--------|----------|--------|---------|
| `Content-Type` | Yes | `application/json` | `application/json` |
| `Idempotency-Key` | Recommended | String ≤ 512 chars (UUID v4 preferred) | `550e8400-e29b-41d4-a716-446655440000` |

**Request Body DTO:**

```typescript
export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  partnerId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  patientReference: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  requestedLocation: string;

  @IsEnum(OrderPriority)
  priority: OrderPriority;
}
```

**Responses:**

| Scenario | Status | Body |
|----------|--------|------|
| Order created (first time) | `201 Created` | Serialised `Order` resource |
| Idempotent replay (same key, same payload) | `200 OK` | Serialised `Order` resource (original, unchanged) |
| Same key, different payload | `409 Conflict` | Standard error body |
| Validation failure | `400 Bad Request` | Standard error body with `errors[]` |
| Server error | `500 Internal Server Error` | Standard error body |

---

### 8.2 `GET /orders` — List Orders

| Attribute | Value |
|-----------|-------|
| Method | `GET` |
| Path | `/orders` |
| Idempotent | Yes (read-only) |

**Query Parameters DTO:**

```typescript
export class ListOrdersQueryDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  partnerId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}
```

**Response Body (200 OK):**

```json
{
  "data":     [ /* ...Order[] */ ],
  "total":    150,
  "page":     1,
  "pageSize": 20
}
```

> The frontend harness accepts `data`, `orders`, `items`, or `results` as the array
> key. Use `data` for consistency.

**Filtering rules:**
- Filters are combined with AND logic
- Filters are exact-match only (no ILIKE, no regex)
- An empty result set returns `200 OK` with `{ "data": [], "total": 0, ... }` — never `404`
- Default sort: `created_at DESC`

**Pagination:**
- `page` is 1-indexed (`page=1` returns rows 1–`pageSize`)
- `offset = (page - 1) * pageSize`
- `total` reflects the count of matching rows across all pages

**Responses:**

| Scenario | Status | Body |
|----------|--------|------|
| Success (any result set including empty) | `200 OK` | Paginated envelope |
| Invalid query parameter | `400 Bad Request` | Standard error body |

---

### 8.3 `GET /orders/:id` — Get Single Order

| Attribute | Value |
|-----------|-------|
| Method | `GET` |
| Path | `/orders/:id` |
| Idempotent | Yes (read-only) |

**Path Parameter:**

| Param | Type | Validation | Error |
|-------|------|------------|-------|
| `id` | UUID | `@IsUUID('4')` | `400` if not a valid UUID v4 |

**Responses:**

| Scenario | Status | Body |
|----------|--------|------|
| Found | `200 OK` | Serialised `Order` resource |
| Not found | `404 Not Found` | Standard error body |
| Malformed ID (not a UUID) | `400 Bad Request` | Standard error body |

---

### 8.4 `PATCH /orders/:id/status` — Transition Status

| Attribute | Value |
|-----------|-------|
| Method | `PATCH` |
| Path | `/orders/:id/status` |
| Idempotent | Yes, if transitioning to the current status (noop); **MUST** not re-apply |

**Path Parameter:** Same UUID validation as §8.3.

**Request Body DTO:**

```typescript
export class TransitionStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;
}
```

**Responses:**

| Scenario | Status | Body |
|----------|--------|------|
| Valid transition applied | `200 OK` | Updated serialised `Order` resource |
| Invalid state machine transition | `409 Conflict` | Standard error body |
| Order not found | `404 Not Found` | Standard error body |
| Malformed ID | `400 Bad Request` | Standard error body |
| Validation failure (bad `status` value) | `400 Bad Request` | Standard error body |

**409 Conflict error message format:**

```json
{
  "statusCode": 409,
  "message": "Invalid status transition from 'in_progress' to 'received'",
  "timestamp": "2026-06-27T10:00:00.000Z",
  "path": "/orders/3f2cb0d4-1c6a-4e1b-8a5f-aa291d8e3210/status"
}
```

The `message` field **MUST** include both the `from` and `to` status names.

---

### 8.5 `GET /health` — Liveness Probe

| Attribute | Value |
|-----------|-------|
| Method | `GET` |
| Path | `/health` |

- **MUST** always return `200 OK`
- **MUST NOT** check any dependency (database, network)
- Purpose: Kubernetes liveness probe. If this fails, the container is restarted.

**Response (200 OK):**

```json
{
  "status":    "ok",
  "timestamp": "2026-06-27T10:00:00.000Z"
}
```

---

### 8.6 `GET /ready` — Readiness Probe

| Attribute | Value |
|-----------|-------|
| Method | `GET` |
| Path | `/ready` |

- **MUST** verify database connectivity via a trivial query (e.g., `SELECT 1`)
- Returns `200 OK` when the database is reachable
- Returns `503 Service Unavailable` when it is not
- Purpose: Kubernetes readiness probe. Service receives no traffic until this passes.
- **MUST** complete within 1 second; use a connection timeout.

**Response (200 OK — ready):**

```json
{
  "status":    "ready",
  "database":  "connected",
  "timestamp": "2026-06-27T10:00:00.000Z"
}
```

**Response (503 Service Unavailable — not ready):**

```json
{
  "status":    "not_ready",
  "database":  "disconnected",
  "timestamp": "2026-06-27T10:00:00.000Z"
}
```

---

## 9. Validation Rules

### Global Rules

- All input **MUST** be validated via NestJS `ValidationPipe` with `forbidNonWhitelisted: true`
- Any request body containing a property not declared in its DTO **MUST** be rejected with `400`
- All string fields **MUST** be trimmed of leading/trailing whitespace before storage

### `CreateOrderDto` — Field Constraints

| Field | Type | Required | Min | Max | Allowed Values | Notes |
|-------|------|----------|-----|-----|----------------|-------|
| `partnerId` | string | Yes | 1 char | 255 chars | Any non-empty string | Trimmed |
| `patientReference` | string | Yes | 1 char | 255 chars | Any non-empty string | Trimmed; pseudonymous |
| `requestedLocation` | string | Yes | 1 char | 255 chars | Any non-empty string | Trimmed |
| `priority` | enum | Yes | — | — | `routine`, `urgent` | Case-sensitive |

### `ListOrdersQueryDto` — Field Constraints

| Field | Type | Required | Default | Min | Max | Allowed Values |
|-------|------|----------|---------|-----|-----|----------------|
| `status` | enum | No | (all) | — | — | `received`, `accepted`, `in_progress`, `completed`, `rejected` |
| `partnerId` | string | No | (all) | — | 255 chars | Any non-empty string |
| `page` | integer | No | `1` | 1 | — | Positive integer |
| `pageSize` | integer | No | `20` | 1 | 100 | Positive integer |

### `TransitionStatusDto` — Field Constraints

| Field | Type | Required | Allowed Values |
|-------|------|----------|----------------|
| `status` | enum | Yes | `received`, `accepted`, `in_progress`, `completed`, `rejected` |

### Idempotency-Key Header Validation

| Constraint | Requirement |
|------------|-------------|
| Format | Any non-empty string |
| Max length | 512 characters |
| Preferred format | UUID v4 (service logs a warning if otherwise) |
| Empty string | Treated as absent (no deduplication) |

---

## 10. Error Handling Contract

### Standard Error Schema (FROZEN — MUST NOT be changed)

All error responses — regardless of endpoint, HTTP status code, or error type — **MUST**
conform to exactly this schema:

```json
{
  "statusCode": 400,
  "message":    "Validation failed",
  "errors": [
    { "field": "partnerId", "message": "partnerId is required" }
  ],
  "timestamp": "2026-06-27T10:00:00.000Z",
  "path":       "/orders"
}
```

**Schema rules:**
- `statusCode` (integer, always present): mirrors the HTTP response status code
- `message` (string, always present): a human-readable summary of the error
- `errors` (array, optional): present only for validation errors (400); each element has `field` (string) and `message` (string)
- `timestamp` (ISO8601 UTC string, always present): when the error occurred
- `path` (string, always present): the request path (and query string where relevant)

### Global Exception Filter

A NestJS `@Catch()` global exception filter **MUST** intercept all unhandled exceptions
and serialise them into the standard schema above. It **MUST NOT** allow the NestJS
default exception shape to reach clients.

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

    const body = exception instanceof HttpException
      ? exception.getResponse()
      : null;

    // Build standardised error body...
  }
}
```

### HTTP Status Code Reference

| Code | When to use |
|------|-------------|
| `200 OK` | Successful `GET`, `PATCH`, and idempotent `POST` retries |
| `201 Created` | First-time successful `POST /orders` (new order created) |
| `400 Bad Request` | Input validation failure; unknown properties in request body; malformed UUID in path |
| `404 Not Found` | Order ID does not exist in the database |
| `409 Conflict` | Invalid state machine transition; idempotency key used with a different payload |
| `500 Internal Server Error` | Unhandled exception; any error not covered by above |
| `503 Service Unavailable` | Database unreachable (`/ready` probe only; propagate to callers if needed) |

---

## 11. Observability & Operability

### Structured Logging

All log output **MUST** be JSON. Plain text is not acceptable in any environment.

**Minimum required log fields:**

```json
{
  "timestamp":   "2026-06-27T10:00:00.000Z",
  "level":       "info",
  "message":     "Order created",
  "requestId":   "550e8400-e29b-41d4-a716-446655440000",
  "service":     "screening-order-service",
  "environment": "production",
  "orderId":     "3f2cb0d4-1c6a-4e1b-8a5f-aa291d8e3210",
  "partnerId":   "partner-123",
  "durationMs":  45
}
```

**Log levels:**

| Level | When |
|-------|------|
| `error` | Unhandled exception, 5xx response, database failure, startup failure |
| `warn` | Idempotent replay (same key seen again), non-UUID idempotency key, invalid transition attempt |
| `info` | Order created, status transitioned, service started, migration completed |
| `debug` | Full request/response bodies (disabled in production; enabled in development) |

### Request Correlation

Every request **MUST** receive a unique `X-Request-ID` response header. If the client
sends `X-Request-ID`, echo it; otherwise, generate a new UUID v4.

This ID **MUST** appear in all log lines produced during that request's handling.

### Instrumentation

For v1, meaningful structured logs are sufficient. If time permits, expose a Prometheus
`/metrics` endpoint using `prom-client` with the following counters/histograms:

| Metric | Type | Labels |
|--------|------|--------|
| `http_requests_total` | Counter | `method`, `path`, `status_code` |
| `http_request_duration_seconds` | Histogram | `method`, `path` |
| `orders_created_total` | Counter | `partner_id` |
| `orders_transitioned_total` | Counter | `from_status`, `to_status` |
| `idempotent_replays_total` | Counter | — |

If metrics are not implemented, the `AI_USAGE.md` must note this as a conscious
trade-off.

---

## 12. Security & Privacy Considerations

### Patient Data

- `patientReference` is pseudonymous. It **MUST NOT** be a real name, date of birth,
  NHS number, or any other directly identifying value. All test data in this service is
  synthetic.
- The service treats `patientReference` as sensitive and **MUST NOT** log it at any
  level above `debug`. Log `orderId` and `partnerId` instead.
- In production, the column **SHOULD** be encrypted at rest (database-level or
  column-level encryption). This is a v2 infrastructure concern; document the intent.
- If this service were deployed in an NHS or GDPR-regulated context, a Data Protection
  Impact Assessment (DPIA) would be required before handling real patient data.

### Transport Security

- All production traffic **MUST** be over TLS 1.2+. Assume this is enforced by the
  load balancer / API gateway.
- The service itself does not terminate TLS (12-factor principle: keep transport security
  at the ingress layer).

### Input Sanitisation

- `forbidNonWhitelisted: true` on the global `ValidationPipe` prevents property injection
- String length limits on all fields prevent trivially large payloads
- UUID validation on path parameters prevents SQL injection via ID fields (TypeORM also
  uses parameterised queries throughout)

### CORS Policy

- **Development default:** `CORS_ORIGIN=http://localhost:5173`
- **Production:** Set `CORS_ORIGIN` to the exact frontend origin; do not use wildcard `*`
  in production
- Credentials (`credentials: true`) enabled for environments that require cookies or
  auth headers

### Secrets Management

- Database credentials **MUST** be injected via environment variables
- **MUST NOT** be committed to source control under any circumstances
- `.env` files are `.gitignore`d; `.env.example` contains only placeholder values

---

## 13. Configuration

### Environment Variables

All configuration **MUST** be environment-driven (12-factor). The service **MUST** fail
to start if a required variable is absent. Use `@nestjs/config` with a validation schema
(Joi or Zod) for startup validation.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | Full PostgreSQL connection string (`postgresql://user:pass@host:5432/db`) |
| `NODE_ENV` | No | `development` | `development`, `test`, `production` |
| `API_PORT` | No | `3000` | Port the HTTP server listens on |
| `LOG_LEVEL` | No | `info` (prod), `debug` (dev) | `error`, `warn`, `info`, `debug` |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Comma-separated list of allowed CORS origins |
| `DB_POOL_MAX` | No | `10` | Max database connection pool size |
| `DB_POOL_MIN` | No | `2` | Min database connection pool size |
| `DB_CONNECT_TIMEOUT_MS` | No | `5000` | Database connection timeout for readiness probe |

### `.env.example`

```dotenv
# Required
DATABASE_URL=postgresql://user:password@localhost:5432/screening_orders

# Optional — shown with defaults
NODE_ENV=development
API_PORT=3000
LOG_LEVEL=debug
CORS_ORIGIN=http://localhost:5173
DB_POOL_MAX=10
DB_POOL_MIN=2
DB_CONNECT_TIMEOUT_MS=5000
```

---

## 14. Infrastructure & Deployment

### Docker

**Multi-stage `Dockerfile`:**

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
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1))"
CMD ["node", "dist/main.js"]
```

**`docker-compose.yml` (development + integration tests):**

```yaml
version: '3.9'

services:
  api:
    build: .
    ports:
      - "${API_PORT:-3000}:3000"
    environment:
      DATABASE_URL: postgresql://user:password@postgres:5432/screening_orders
      NODE_ENV: development
      LOG_LEVEL: debug
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

### GitHub Actions CI

The CI pipeline **MUST** pass on a clean checkout of the main branch.

```yaml
# .github/workflows/ci.yml

name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  ci:
    runs-on: ubuntu-latest

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

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run typecheck

      - name: Build
        run: npm run build

      - name: Run migrations
        run: npm run migration:run

      - name: Unit tests
        run: npm run test:unit

      - name: Integration tests
        run: npm run test:integration
```

### Terraform Module

**Scope:** Plan-only; targets AWS. Not applied against a live account.
**Rationale:** AWS is the likely production platform; using a real provider makes the
module reviewable without requiring a cloud account.

**Module structure:**

```
terraform/
├── main.tf           # ECS service + task definition
├── variables.tf      # All configurable inputs
├── outputs.tf        # Service URL, ARNs
├── database.tf       # RDS PostgreSQL instance + subnet group
├── networking.tf     # Security groups, VPC references
└── README.md         # Usage, inputs, outputs table
```

**Key resources:** ECS Fargate service (container), RDS PostgreSQL (managed DB),
ECR repository (container image), CloudWatch log group, security groups.

---

## 15. Testing Requirements

### Unit Tests

**MUST cover:**

| Test Case | Why Mandatory |
|-----------|---------------|
| `isValidTransition` — every cell in the transition table | State machine correctness is the core business rule |
| `isValidTransition` — terminal states (`completed`, `rejected`) cannot transition | Ensures no silent state mutation |
| Idempotency key deduplication — same key returns existing order | Core idempotency contract |
| Idempotency key conflict — same key, different payload, returns 409 | Conflict detection |
| `CreateOrderDto` validation — all required fields, all length limits | Validates DTO completeness |
| `CreateOrderDto` validation — `priority` enum (valid and invalid values) | Enum guard |
| `TransitionStatusDto` validation — invalid status value | Enum guard |
| `ListOrdersQueryDto` — `pageSize` clamped to max 100 | Pagination guard |
| `hashPayload` — deterministic for same input regardless of key order | Idempotency conflict detection depends on this |

### Integration Tests

Must run against a real containerised PostgreSQL (not an in-memory mock).

**MUST cover:**

| Test Case | Why Mandatory |
|-----------|---------------|
| `POST /orders` → `201`, order persisted | Happy path end-to-end |
| `POST /orders` twice with same key → second call `200` with same `id` | Idempotency |
| **10 concurrent `POST /orders` with same key → exactly 1 order created** | Concurrency correctness — the single most important test |
| `POST /orders` same key different payload → `409` | Conflict detection |
| `GET /orders` — returns paginated results | List endpoint |
| `GET /orders?status=received&partnerId=x` — filters correctly | Filter logic |
| `GET /orders/:id` — returns correct order | Single fetch |
| `GET /orders/:id` with non-existent ID → `404` | 404 handling |
| `GET /orders/not-a-uuid` → `400` | Malformed ID handling |
| Full lifecycle: create → accept → start → complete | State machine end-to-end |
| Invalid transition: `in_progress` → `received` → `409` | State machine rejection |
| Unknown property in POST body → `400` (not silently stripped) | `forbidNonWhitelisted` validation |
| `GET /health` → `200` | Liveness probe |
| `GET /ready` (DB connected) → `200` | Readiness probe |

### Test Coverage Targets

- Unit tests: ≥ 90% statement coverage on service and utility modules
- Integration tests: full happy path + all documented error scenarios

---

## 16. Engineering Best-Practice Self-Review

This section documents the spec's own self-review pass, conducted before implementation.

### Validation

- **Addressed:** `forbidNonWhitelisted: true` is specified explicitly and flagged as the
  most critical single configuration.
- **Addressed:** All DTOs have field-level constraints with `class-validator` decorators.
- **Addressed:** Path parameter UUID validation returns `400`, not `500`.

### Idempotency

- **Addressed:** Lock-before-write pattern documented and required. Application-level
  pre-check explicitly noted as insufficient under concurrency.
- **Addressed:** Payload hash comparison using SHA-256 on normalised input prevents false
  negatives from field-ordering differences.
- **Addressed:** The single most important integration test (10 concurrent requests → 1
  order) is mandatory.

### Observability

- **Addressed:** Structured JSON logging is required in all environments.
- **Addressed:** `patientReference` must not appear in logs above `debug` level.
- **Addressed:** Prometheus metrics defined; implementation is optional with a required
  trade-off note.

### Security

- **Addressed:** Patient data handling, GDPR/DPIA considerations, and production
  encryption intent all documented.
- **Addressed:** No secrets in source control; `.env` in `.gitignore`.

### Testability

- **Addressed:** State machine is a pure function — straightforward to unit-test.
- **Addressed:** Repository is injected (not instantiated directly) — mockable.
- **Addressed:** Integration tests run against a real database — no brittle in-memory fakes.

### Known Gaps (Deferred to v2)

| Gap | Consequence if left | Mitigation in v1 |
|-----|---------------------|------------------|
| No authentication | Any caller can read/write all orders | Document assumption: upstream gateway authenticates |
| No per-partner authorisation | Partner A can read Partner B's orders | Document explicitly; acceptable for internal tooling only |
| No idempotency key TTL | Table grows unboundedly | Low risk at case-study scale; add cleanup job in v2 |
| Limit-offset pagination | O(n) scans on large tables at high page numbers | Acceptable at this data volume; cursor-based in v2 |
| No event emission | Other services can't react to status changes | Async event stream in v2 |

---

## 17. Production Acceptance Checklist

> This checklist **MUST** be 100% complete before any deployment to production.

### Correctness

- [ ] `forbidNonWhitelisted: true` is set on the global `ValidationPipe`
- [ ] Unknown properties in any request body return `400`, not a stripped `201`/`200`
- [ ] All status transitions validated against the state machine before execution
- [ ] All invalid transitions return `409 Conflict`
- [ ] Status transition uses compare-and-swap; concurrent writes do not cause lost updates
- [ ] Terminal states (`completed`, `rejected`) cannot be transitioned

### Idempotency

- [ ] Idempotency key is written atomically with order creation (same transaction)
- [ ] 10 concurrent `POST /orders` with the same key create exactly 1 order
- [ ] Idempotent retry returns `200`, not `201`
- [ ] Same key with a different payload returns `409 Conflict`
- [ ] `payloadHash` stored as SHA-256 of normalised request body

### API Contract

- [ ] All error responses conform exactly to the standard schema
- [ ] All timestamps are ISO8601 UTC (not local time)
- [ ] `updatedAt` is updated on every status transition
- [ ] `patientReference` is never logged above `debug` level
- [ ] `X-Request-ID` header present on all responses
- [ ] `idempotencyKey` and `payloadHash` are never serialised in API responses

### Operability

- [ ] `GET /health` returns `200` without checking any dependency
- [ ] `GET /ready` returns `200` only when the database is connected; `503` otherwise
- [ ] All logs are structured JSON
- [ ] Service fails to start if `DATABASE_URL` is absent or invalid
- [ ] CORS origin is configurable via `CORS_ORIGIN` environment variable
- [ ] CORS defaults to `http://localhost:5173` for development

### Infrastructure

- [ ] `docker compose up` → service starts, migrations run, API is reachable
- [ ] CI pipeline passes on a clean checkout (lint → build → unit tests → integration tests)
- [ ] Integration tests spin up Postgres as a service in CI
- [ ] Terraform module is syntactically valid (`terraform validate` passes)
- [ ] No secrets committed to source control

---

## 18. Assumptions Register

The following assumptions underpin this spec. If any is invalidated, the spec requires
an amendment.

| # | Assumption | Impact if wrong |
|---|------------|-----------------|
| A1 | Authentication is handled by an upstream API gateway before requests reach this service | Need to add JWT/API-key middleware; auth module; RBAC |
| A2 | `patientReference` values are pre-pseudonymised by the calling system; this service does not receive raw PII | Would need encryption-at-rest, DPIA, stricter logging controls immediately |
| A3 | Order IDs are server-generated UUIDs; clients do not supply IDs | If clients need to set IDs, POST /orders contract changes |
| A4 | Order data is never deleted (no soft-delete, no purge) | Would need `deleted_at` column, filter changes, and an audit trail |
| A5 | Pagination volume is modest (< 1M orders); limit-offset is adequate | At high page depth, switch to cursor-based pagination |
| A6 | A single instance of this service is sufficient; no horizontal-scaling race conditions beyond the concurrency test scenario | Distributed locking or a stronger idempotency store would be needed at scale |
| A7 | PostgreSQL is the only data store required; no caching layer | Caching would require cache-invalidation on status transitions |
| A8 | The Terraform module targets AWS but does not need to be applied against a live account | If live deployment is required, real credentials, state backend, and environment configs are needed |

---

**Document Status:** Approved for implementation  
**Author:** Babajide Williams  
**Last Updated:** June 27, 2026
