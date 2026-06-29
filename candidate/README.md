# Screening Order Service

A production-ready REST API for managing medical screening orders built with
**NestJS**, **TypeORM**, and **PostgreSQL**. Implements idempotent order
creation, a strict status-transition state machine, structured JSON logging,
and a multi-stage Docker build.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start — Docker Compose](#quick-start--docker-compose-recommended)
- [Local Development — Without Docker](#local-development--without-docker)
- [Running Tests](#running-tests)
- [API Reference](#api-reference)
- [Environment Variables](#environment-variables)
- [npm Scripts Reference](#npm-scripts-reference)
- [Architecture Notes](#architecture-notes)
- [Known Trade-offs & What's Next](#known-trade-offs--whats-next)

---

## Prerequisites

| Tool | Minimum version | Notes |
|---|---|---|
| Node.js | 20.0.0 | [nodejs.org](https://nodejs.org) |
| npm | 10.0.0 | Bundled with Node.js |
| Docker | 24.0 | [docs.docker.com/get-docker](https://docs.docker.com/get-docker) |
| Docker Compose | 2.20 | Bundled with Docker Desktop |
| psql | 15 *(optional)* | For direct database inspection |

---

## Quick Start — Docker Compose (recommended)

From zero to a running API in under 5 minutes.

### 1. Clone and enter the service directory

```bash
git clone https://github.com/Babanila/mirantus-backend
cd candidate/service
```

### 2. Create your local environment file

```bash
cp .env.example .env
```

The defaults in `.env.example` work out of the box for local development.
No edits are required unless you want to change ports or credentials.

### 3. Build and start

```bash
npm run compose:up
```

This runs `docker compose up -d --build --wait --wait-timeout 120` which:

1. Builds the multi-stage Docker image (`deps` → `builder` → `runner`)
2. Starts a PostgreSQL 15 container and waits for its health check to pass
3. Runs all pending TypeORM migrations inside the API container
4. Starts the NestJS API and waits until it reports healthy (up to 120 s)

### 4. Confirm everything is healthy

```bash
docker compose ps
```

```
NAME                    STATUS                    PORTS
screening-orders-api    Up 40 seconds (healthy)   0.0.0.0:3000->3000/tcp
screening-orders-db     Up 45 seconds (healthy)   0.0.0.0:5432->5432/tcp
```

### 5. Hit the API

```bash
# Liveness probe
curl -s http://localhost:3000/health | jq .

# Readiness probe — confirms database is reachable
curl -s http://localhost:3000/ready | jq .

# Create your first order
curl -s -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "partnerId":         "partner-001",
    "patientReference":  "patient-ref-001",
    "requestedLocation": "ward-a",
    "priority":          "routine"
  }' | jq .
```

### 6. Stop the stack

```bash
npm run compose:down          # stop containers, keep database volume
docker compose down -v        # stop containers AND wipe database volume
```

---

## Local Development — Without Docker

Use this when you want hot-reload and faster iteration directly on source code.

### 1. Install dependencies

```bash
npm install
```

### 2. Start a local Postgres instance

```bash
docker run -d \
  --name screening-orders-dev-db \
  -e POSTGRES_USER=user \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=screening_orders \
  -p 5432:5432 \
  postgres:15-alpine
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` — when running the app **outside** Docker, `DATABASE_URL` must
use `localhost`, not `postgres`:

```bash
# .env — local development (app running on host, DB in Docker)
DATABASE_URL=postgresql://user:password@localhost:5432/screening_orders
NODE_ENV=development
API_PORT=3000
LOG_LEVEL=debug
CORS_ORIGIN=http://localhost:5173
DB_POOL_MAX=10
DB_POOL_MIN=2
DB_CONNECT_TIMEOUT_MS=5000
```

### 4. Run migrations

```bash
npm run migration:run
```

### 5. Start the development server

```bash
npm run start:dev
```

The server starts on `http://localhost:3000` with file-watching enabled.
Any change to a `.ts` file in `src/` triggers an automatic restart.

---

## Running Tests

### Unit tests — no database required

```bash
npm run test:unit
```

Runs all `src/**/*.spec.ts` files. Repositories are mocked — no network or
database connection is needed.

### Integration / E2E tests — requires Postgres

Run the full E2E flow in one command:

```bash
npm run test:e2e:local
```

This sequentially:
1. Starts an isolated test database on port `5432` (`docker-compose.test.yml`)
2. Waits until Postgres accepts connections
3. Applies all migrations to the test database
4. Runs all `test/**/*.e2e.ts` suites via Vitest
5. Stops and removes the test database container

Or run each step manually:

```bash
npm run db:test:start      # start test Postgres
npm run db:test:wait       # wait for readiness
npm run db:test:migrate    # apply migrations
npm run test:integration   # run Vitest integration tests
npm run e2e:clean          # stop and remove test container
```

### Run a single test file

```bash
npx vitest run test/e2e/orders-lifecycle.e2e.ts    --reporter=verbose
npx vitest run test/e2e/orders-idempotency.e2e.ts  --reporter=verbose
npx vitest run test/e2e/orders-errors.e2e.ts       --reporter=verbose
```

### Coverage report

```bash
npm run test:cov
```

The HTML report is written to `coverage/index.html`.

---

## API Reference

**Base URL:** `http://localhost:3000`

All request bodies are `application/json`.
All responses are `application/json`.
All timestamps are **ISO 8601 UTC** (ending in `Z`).
Internal fields (`idempotencyKey`, `payloadHash`) are **never** returned in any
response.

---

### `GET /health`

Liveness probe. Does **not** query the database. Returns 200 whenever the
process is running.

```bash
curl -s http://localhost:3000/health
```

```json
{
  "status": "ok",
  "timestamp": "2026-06-28T10:00:00.000Z"
}
```

---

### `GET /ready`

Readiness probe. Executes `SELECT 1` against the database. Returns `503` when
the database is unreachable.

```bash
curl -s http://localhost:3000/ready
```

```json
{
  "status": "ready",
  "database": "connected",
  "timestamp": "2026-06-28T10:00:00.000Z"
}
```

---

### `POST /orders`

Create a new screening order.

Supply an `Idempotency-Key` header to enable safe retries. Repeating the same
key and payload returns the original order with **HTTP 200** (no duplicate
created). Repeating the same key with a **different** payload returns **HTTP
409**.

```bash
curl -s -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000" \
  -d '{
    "partnerId":         "partner-001",
    "patientReference":  "patient-ref-001",
    "requestedLocation": "ward-a",
    "priority":          "routine"
  }'
```

**Request body**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `partnerId` | string | ✅ | max 255 chars |
| `patientReference` | string | ✅ | max 255 chars |
| `requestedLocation` | string | ✅ | max 255 chars |
| `priority` | string | ✅ | `routine` \| `urgent` |

**Responses**

| Status | When |
|---|---|
| `201 Created` | New order created |
| `200 OK` | Idempotent replay — original order returned |
| `400 Bad Request` | Validation failure or unknown field |
| `409 Conflict` | Same `Idempotency-Key`, different payload |

**Response body**

```json
{
  "id":                "550e8400-e29b-41d4-a716-446655440000",
  "partnerId":         "partner-001",
  "patientReference":  "patient-ref-001",
  "requestedLocation": "ward-a",
  "priority":          "routine",
  "status":            "received",
  "createdAt":         "2026-06-28T10:00:00.000Z",
  "updatedAt":         "2026-06-28T10:00:00.000Z"
}
```

---

### `GET /orders`

List orders with optional filtering and pagination. Returns newest first.

```bash
# Default — page 1, 20 results, all statuses
curl -s http://localhost:3000/orders

# Filter by status
curl -s "http://localhost:3000/orders?status=received"

# Filter by partner
curl -s "http://localhost:3000/orders?partnerId=partner-001"

# Combine filters
curl -s "http://localhost:3000/orders?partnerId=partner-001&status=accepted"

# Paginate
curl -s "http://localhost:3000/orders?page=2&pageSize=10"
```

**Query parameters**

| Parameter | Type | Default | Constraints |
|---|---|---|---|
| `status` | string | — | `received` \| `accepted` \| `in_progress` \| `completed` \| `rejected` |
| `partnerId` | string | — | max 255 chars |
| `page` | integer | `1` | min 1 |
| `pageSize` | integer | `20` | min 1, max 100 |

**Response body**

```json
{
  "data":     [ /* array of order objects */ ],
  "total":    42,
  "page":     1,
  "pageSize": 20
}
```

An empty result returns `{ "data": [], "total": 0, "page": 1, "pageSize": 20 }` —
never a 404.

---

### `GET /orders/:id`

Fetch a single order by its UUID.

```bash
curl -s http://localhost:3000/orders/550e8400-e29b-41d4-a716-446655440000
```

**Responses**

| Status | When |
|---|---|
| `200 OK` | Order found |
| `400 Bad Request` | `:id` is not a valid UUID |
| `404 Not Found` | No order with that ID |

---

### `PATCH /orders/:id/status`

Transition an order to a new status. Only transitions permitted by the state
machine are accepted — all others return `409 Conflict`.

```bash
curl -s -X PATCH \
  http://localhost:3000/orders/550e8400-e29b-41d4-a716-446655440000/status \
  -H "Content-Type: application/json" \
  -d '{ "status": "accepted" }'
```

**Request body**

| Field | Type | Required | Values |
|---|---|---|---|
| `status` | string | ✅ | `accepted` \| `in_progress` \| `completed` \| `rejected` |

**State machine**

```
             ┌─────────────────────────────────┐
             ↓                                 │
received ──→ accepted ──→ in_progress ──→ completed
    │            │
    └────────────┴──────────────────────────→ rejected
                                              (terminal)
```

| From | Allowed transitions |
|---|---|
| `received` | `accepted`, `rejected` |
| `accepted` | `in_progress`, `rejected` |
| `in_progress` | `completed` |
| `completed` | *(terminal)* |
| `rejected` | *(terminal)* |

**Responses**

| Status | When |
|---|---|
| `200 OK` | Transition applied |
| `400 Bad Request` | Invalid status value or non-UUID `:id` |
| `404 Not Found` | Order does not exist |
| `409 Conflict` | Transition not permitted by state machine |

---

### Error response shape

Every error response follows this exact schema:

```json
{
  "statusCode": 400,
  "message":    "Validation failed",
  "errors": [
    {
      "field":   "priority",
      "message": "priority must be a valid enum value"
    }
  ],
  "timestamp": "2026-06-28T10:00:00.000Z",
  "path":      "/orders"
}
```

`errors[]` is only present on `400` validation responses.

---

## Environment Variables

All variables are validated by Joi at startup. The service **refuses to boot**
if any required variable is absent or malformed.

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | Full PostgreSQL URI. Must start with `postgresql://` or `postgres://` |
| `NODE_ENV` | — | `development` | `development` \| `test` \| `production` |
| `API_PORT` | — | `3000` | HTTP port the server listens on |
| `LOG_LEVEL` | — | `info` | `error` \| `warn` \| `info` \| `debug` |
| `CORS_ORIGIN` | — | `http://localhost:5173` | Comma-separated list of allowed CORS origins |
| `DB_POOL_MAX` | — | `10` | Maximum pg connection pool size |
| `DB_POOL_MIN` | — | `2` | Minimum idle connections in the pool |
| `DB_CONNECT_TIMEOUT_MS` | — | `5000` | Connection attempt timeout in milliseconds |

**Docker Compose only** (Postgres container):

| Variable | Description |
|---|---|
| `POSTGRES_USER` | Postgres superuser name |
| `POSTGRES_PASSWORD` | Postgres superuser password |
| `POSTGRES_DB` | Database name created on first boot |
| `DB_PORT` | Host port bound to Postgres (default `5432`) |

> **Note:** Inside Docker Compose the `DATABASE_URL` host must be `postgres`
> (the service name), not `localhost`. When running the app on the host machine
> use `localhost`.

---

## npm Scripts Reference

| Script | Description |
|---|---|
| `npm run build` | Compile TypeScript → `dist/` via `nest build` |
| `npm run clean` | Remove `dist/`, `coverage/`, `.nyc_output/` |
| `npm run start` | Start the compiled application |
| `npm run start:dev` | Start with hot-reload (watches `src/`) |
| `npm run start:debug` | Start with debugger + hot-reload |
| `npm run format` | Auto-format all `.ts` files with Prettier |
| `npm run lint` | Lint and auto-fix with ESLint |
| `npm run typecheck` | TypeScript type check without emitting files |
| `npm run test:unit` | Run unit tests (`src/**/*.spec.ts`) |
| `npm run test:integration` | Run integration tests (`test/**/*.e2e.ts`) |
| `npm run test:cov` | Run all tests with V8 coverage report |
| `npm run migration:generate` | Generate a migration from entity diff |
| `npm run migration:run` | Apply all pending migrations |
| `npm run migration:revert` | Roll back the last applied migration |
| `npm run migration:show` | List applied and pending migrations |
| `npm run compose:up` | `docker compose up -d --build --wait` |
| `npm run compose:down` | `docker compose down` |
| `npm run db:test:start` | Start isolated test Postgres container |
| `npm run db:test:wait` | Wait until test Postgres is ready |
| `npm run db:test:migrate` | Apply migrations to test database |
| `npm run db:test:stop` | Stop and remove test Postgres container |
| `npm run test:e2e:local` | Full E2E flow: start → wait → migrate → test → stop |
| `npm run e2e:clean` | Stop and remove test database container |

---

## Architecture Notes

For the full product specification see [`SPEC.md`](./SPEC.md).
For the implementation task breakdown see [`TASKS.md`](./TASKS.md).

### Project layout

```
candidate/service/
├── src/
│   ├── config/           ConfigModule — Joi-validated env vars, typed getters
│   ├── database/         DatabaseModule, TypeORM DataSource (CLI + app)
│   ├── filters/          GlobalExceptionFilter — standard error envelope
│   ├── health/           GET /health (liveness) · GET /ready (readiness)
│   ├── middleware/        X-Request-ID propagation
│   ├── migrations/        TypeORM migration files
│   └── orders/
│       ├── domain/        Pure functions: state machine, payload hash, enums
│       ├── dto/           class-validator request/response DTOs
│       ├── entities/      OrderEntity (TypeORM)
│       ├── orders.controller.ts
│       ├── orders.module.ts
│       └── orders.service.ts
├── test/
│   ├── e2e/              T-23 lifecycle · T-24 idempotency · T-25 errors
│   ├── app-factory.ts    NestJS test application factory
│   ├── database-setup.ts Test DataSource + schema verification helpers
│   └──  global-setup.ts   Vitest globalSetup — runs migrations once per suite
├── scripts/
│   └── migrate.js        Standalone migration runner used by docker-compose
├── .env.example          Environment variable template
├── docker-compose.yml    Production-like local stack
├── docker-compose.test.yml  Isolated test database
├── Dockerfile            Multi-stage build (deps → builder → runner)
└── vitest.config.ts
```

### Key design decisions

**Idempotency via atomic INSERT + unique constraint**

`POST /orders` with an `Idempotency-Key` performs a single `INSERT`. If a
duplicate key violation (Postgres error code `23505`) is caught, the service
fetches the existing row and returns it. There is deliberately no pre-insert
`SELECT`. A check-then-insert pattern has a race window where two concurrent
requests both see `null`, both attempt to insert, and one creates a duplicate.
The unique constraint is the lock — handled entirely in the `catch` block.

**Compare-and-swap status transitions**

`PATCH /orders/:id/status` issues:

```sql
UPDATE orders
SET    status = :newStatus
WHERE  id     = :id
AND    status = :expectedStatus
```

If zero rows are affected a concurrent write changed the status between the
read and the write, and `409 Conflict` is returned. This prevents lost updates
without requiring serialisable transactions or application-level locks.

**Field exclusion at the serialisation boundary**

`idempotencyKey` and `payloadHash` are persistence-layer concerns and are never
included in API responses. `OrderResponseDto` uses `class-transformer`
`@Exclude()` / `@Expose()` to enforce this. The `ClassSerializerInterceptor` is
registered globally so the rule applies to every endpoint automatically.

**Configuration validation at boot**

`@nestjs/config` is wired with a Joi schema in `config.schema.ts`. If
`DATABASE_URL` is absent, empty, or not a valid PostgreSQL URI the process exits
immediately with a human-readable error — before any database connection is
attempted. This prevents the service from silently starting in a broken state.

**Multi-stage Docker build**

Three stages keep the final image lean and secure:

| Stage | Purpose | Included in final image? |
|---|---|---|
| `deps` | `npm ci` with all dependencies | No |
| `builder` | `nest build` + `npm ci --omit=dev` | No |
| `runner` | Copy `dist/` + prod `node_modules` only | ✅ Yes |

The runner stage runs as a non-root system user (`app`). The image size is
approximately 230 MB — well under the 300 MB target.

---

## Known Trade-offs & What's Next

### Intentionally scoped out

| Item | Reason |
|---|---|
| HTTPS / TLS termination | Handled at the ALB layer in production (Terraform module in `candidate/terraform/`) |
| Authentication / authorisation | Not specified in SPEC.md |
| Rate limiting | Not specified in SPEC.md |
| Soft deletes / audit log | Not in the domain model |
| OpenAPI / Swagger UI | Not required by SPEC.md — add `@nestjs/swagger` if needed |
| Read replica | Single RDS instance is sufficient for this scope |
| Event streaming | No Kafka/SQS integration required at this stage |

### Recommended next steps for production readiness

- Wire the CloudWatch metric alarms in `candidate/terraform/logging.tf` to an
  SNS topic connected to PagerDuty or OpsGenie
- Add an HTTPS listener to the ALB with an ACM certificate and redirect HTTP →
  HTTPS
- Rotate the `db_password` via AWS Secrets Manager automatic rotation instead
  of a Terraform variable
- Add `@nestjs/throttler` for per-partner request rate limiting
- Enable RDS Multi-AZ (`db_multi_az = true`) and extend backup retention to
  7 days in the production Terraform workspace
- Add a `/metrics` endpoint compatible with Prometheus scraping for ECS
  Container Insights dashboards
