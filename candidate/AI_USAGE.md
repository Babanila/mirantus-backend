# AI Integration & Usage Guidelines For Screening Order Service

## Agents and tools used

| Tool | Role |
|---|---|
| **Claude Sonnet 4** (Anthropic) | Primary coding agent — all phases |
| **GitHub Copilot** | Inline autocomplete during manual edits |

All prompting was done through a conversational interface with Claude. No
Claude Code CLI or automated agent loop was used — every prompt was written
manually and every output was reviewed before being applied to the codebase.

---

## How I directed the agent

### Phase 0 — Specification first

Before writing a single line of code I asked Claude to act as a software engineer(backend) and critique a rough requirements brief. The
output became `SPEC.md`. I then asked it to act as a security reviewer and
flag anything privacy-relevant. It surfaced two things I accepted:

- `patientReference` must never appear in logs above `debug` level.
- `idempotencyKey` and `payloadHash` must be excluded from every API response.

Both constraints were written into the spec and enforced as explicit acceptance
criteria in `TASKS.md`.

### Phase 1 — Task decomposition

I pasted `SPEC.md` into Claude and asked for a sequenced task breakdown with
explicit dependency edges and acceptance criteria for each task. The result
became `TASKS.md`. I edited it manually to:

- Reorder T-10 (idempotency) before T-11/T-12 so service tests could be
  written in dependency order.
- Tighten the acceptance criteria on T-24 (concurrent idempotency) — the
  agent's first draft said "requests should return the same ID" without
  specifying that exactly one `201` and nine `200` responses were required.

### Phase 2 — Implementation (one task per prompt)

Each task was a separate prompt. The prompt structure was:

```
Context: [paste of relevant SPEC.md section]
Task: [paste of TASKS.md task block]
Constraint: [any known pitfall from the Agent Notes]
Output: [file path(s) to produce]
```

I did not batch tasks. Batching caused the agent to skip acceptance criteria
it judged as "redundant" in early experiments — notably it silently dropped
`forbidNonWhitelisted: true` from the `ValidationPipe` when asked to implement
the controller and the exception filter in the same prompt.

---

## Where the agent got it wrong and how I caught it

### 1. Idempotency — pre-insert SELECT (critical)

**What the agent produced:**

```typescript
// agent's first attempt at OrdersService.create()
const existing = await this.repo.findOneBy({ idempotencyKey });
if (existing) {
  if (existing.payloadHash !== payloadHash) throw new ConflictException(...);
  return { order: existing, created: false };
}
const order = await this.repo.save(entity);
return { order, created: true };
```

**Why it is wrong:**

This is a classic check-then-insert race condition. Two concurrent requests
both execute `findOneBy` and both see `null`. Both proceed to `save`. One
succeeds; the other throws a unique constraint violation that is not caught,
and the caller receives a `500` instead of a `200` replay. Under the 10-
concurrent-request test in T-24 this produced between 1 and 3 rows in the
database depending on timing — never a consistent 1.

**How I caught it:**

The T-24 integration test (`10 concurrent POSTs → exactly 1 order`) failed
intermittently. I inspected the database after a run that produced 2 rows and
traced it back to the pre-insert SELECT. The `TASKS.md` Agent Note for T-10
explicitly warned about this pattern, which is why the test existed.

**How I fixed it:**

I re-prompted with the exact implementation from `TASKS.md` T-10 and the
instruction: *"Do not add any pre-insert SELECT. The UNIQUE constraint is the
lock. Handle the violation in the catch block only."* The corrected version:

```typescript
try {
  const order = await this.repo.save(entity);
  return { order, created: true };
} catch (err) {
  if (this.isUniqueViolation(err)) {
    const existing = await this.repo.findOneByOrFail({ idempotencyKey });
    if (existing.payloadHash !== payloadHash) throw new ConflictException(...);
    return { order: existing, created: false };
  }
  throw err;
}
```

After this fix the T-24 test passed consistently across 20 successive runs.

---

### 2. Status transitions — `in_progress → rejected` allowed incorrectly

**What the agent produced:**

```typescript
const VALID_TRANSITIONS = {
  received:    ['accepted', 'rejected'],
  accepted:    ['in_progress', 'rejected'],
  in_progress: ['completed', 'rejected'],  // ← wrong
  completed:   [],
  rejected:    [],
};
```

**Why it is wrong:**

The spec (SPEC.md §6) explicitly prohibits `in_progress → rejected`. The agent
inferred the rule by analogy — because `received` and `accepted` both allow
`rejected`, it assumed `in_progress` did too. This is a domain logic error, not
a TypeScript error, so the compiler did not catch it.

**How I caught it:**

The T-20 unit test suite includes an explicit `it.each` case:

```typescript
['in_progress', 'rejected']  // must return false
```

This test failed on the first run. I also have `TASKS.md` Agent Note for T-04:
*"Also verify `in_progress → rejected` is false — agents often allow it by
analogy with `received → rejected` and `accepted → rejected`."*

**How I fixed it:**

I replaced the array-based map with the `Record<OrderStatus, ReadonlySet>`
pattern from the spec and re-ran the 20-case unit test suite to confirm every
cell in the transition table was correct.

---

### 3. `ConfigModule` — `ignoreEnvFile` missing in test environment

**What the agent produced:**

```typescript
NestConfigModule.forRoot({
  validationSchema: configSchema,
  envFilePath: ['.env.local', '.env'],
})
```

**Why it is wrong:**

In the CI environment and in Vitest workers there is no `.env` file. NestJS
attempted to read it, found nothing, and Joi validation failed because
`DATABASE_URL` appeared absent — even though `setup.ts` had already
populated `process.env`. The result was the error:

```
[AppConfigService] ConfigService was not injected.
```

**How I caught it:**

The integration test suite failed in CI on the first push. Locally the tests
passed because `.env` existed. The discrepancy between local and CI pointed
immediately to file loading.

**How I fixed it:**

I added `ignoreEnvFile: process.env.NODE_ENV === 'test'` to the module
configuration so that in test mode `ConfigModule` reads purely from
`process.env` — which `setup.ts` populates before any module is imported.

---

### 4. `ValidationPipe` — `forbidNonWhitelisted` silently removed

**What the agent produced** (when asked to add the exception filter to an
existing `main.ts`):

```typescript
app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
```

**Why it is wrong:**

`forbidNonWhitelisted: true` is the setting that causes unknown fields to return
`400` rather than being silently stripped. Without it, a client sending
`{ ..., unknownField: "bad" }` receives `201` instead of `400`, which is a
contract violation (SPEC.md §9) and a latent security issue.

**How I caught it:**

The T-25 error scenario test:

```typescript
it('POST with unknown extra field → 400 (not stripped silently)')
```

failed. I also ran the manual `curl` check from the T-14 acceptance criteria
before marking the task done.

**How I fixed it:**

I re-applied the exact `ValidationPipe` configuration from `TASKS.md` T-14 and
added a comment marking it `CRITICAL: do not remove`.

---

### 5. `p99` statistic in Terraform CloudWatch alarm

**What the agent produced:**

```hcl
statistic = "p99"
```

**Why it is wrong:**

The AWS Terraform provider only accepts `SampleCount`, `Average`, `Sum`,
`Minimum`, and `Maximum` for the `statistic` field. Percentile statistics
require the separate `extended_statistic` field.

**How I caught it:**

`terraform validate` failed immediately:

```
expected statistic to be one of ["SampleCount" "Average" "Sum" "Minimum"
"Maximum"], got p99
```

**How I fixed it:**

```hcl
extended_statistic = "p99"   # replaces statistic for percentile values
```

---

## What I would do differently

**Tighter initial prompts.** Several of the corrections above were anticipated
in `TASKS.md` Agent Notes but the agent ignored them when they were not
included in the prompt itself. In future I would paste the relevant Agent Note
verbatim into every prompt rather than keeping it only in the task file.

**Run acceptance criteria before moving to the next task.** I started doing
this from T-10 onwards after the idempotency bug. The earlier tasks (T-01 to
T-09) were not verified immediately and required backtracking.

**Integration test earlier.** The `ConfigModule` / `ignoreEnvFile` issue only
surfaced when the integration tests were written. If I had written a minimal
`beforeAll` / `createTestingApp` fixture at T-16 (controller), I would have
caught it six tasks earlier.

**Terraform `validate` in every iteration.** I only ran `terraform validate`
once at the end. Running it after each resource block would have caught the
`p99` / `extended_statistic` error in `logging.tf` immediately rather than at
review time.

---

## Privacy and PII considerations carried forward

- `patientReference` is treated as a pseudonymous identifier. It is stored in
  the database but never written to application logs above `debug` level.
- `idempotencyKey` and `payloadHash` are internal persistence fields excluded
  from all API responses via `class-transformer` `@Exclude()`.
- In a production deployment `DATABASE_URL` is stored in AWS Secrets Manager
  (see `candidate/terraform/main.tf`) and injected at task launch — it is never
  present as a plain-text environment variable in the task definition.
- No real patient data is used anywhere in the codebase, tests, or fixtures.
  All references use synthetic identifiers (`patient-ref-001`, `PAT-T23`, etc.).
