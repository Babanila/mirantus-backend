# Take-Home Case Study — Backend / DevOps-Leaning Fullstack Engineer

**Role focus:** Backend with strong DevOps / CI-CD and a "you build it, you run it" mindset, in an AI-driven development workflow
**Expected effort:** ~4 hours for the core. Please do **not** over-invest — we care more about *how* you work than about how much you ship.
**Tooling:** You are expected to solve this using coding agents (e.g. **Claude Code, Codex, Antigravity**). This is not a test of whether you can hand-type a NestJS service — it is a test of how you direct AI to build and operate software well.

---

## 1. Why we run this case study

At Mirantus, we're committed to AI-driven development — it's a core part of how we want to build, and we're early in the adoption phase, actively figuring out what good looks like. That's exactly why this case study matters to us: we want to understand how you think when a coding agent is doing a lot of the typing — how you frame a problem, how you keep an agent on the rails, and how you review what comes back, especially when the thing you're building has to *run* in production, not just compile. We're as interested in learning from your approach as we are in evaluating it.

The artefacts you produce *around* the code matter as much as the code itself. A service with a clear spec, a sensible task breakdown, a runnable pipeline, and an honest review of where the agent went wrong tells us more than a larger feature with none of that visible thinking.

## 2. Our high-level approach (a recommendation, not a requirement)

This is how *we* tend to work, shared as a helpful starting point — not a checklist you have to follow. If you have a process that works better for you, use it; we're genuinely interested in seeing it. Either way, please leave enough of a trail (notes, spec, task list) that we can follow your thinking.

For reference, our usual flow is:

1. **Understand the requirements and prepare a specification.** Turn the brief below into a short written spec (`SPEC.md`): API surface, data model, failure modes, operational concerns, and explicit out-of-scope decisions.
2. **Review the specification for engineering best practices.** Before writing code, sanity-check your own spec (ideally with an agent as a critic): validation, idempotency, observability, security, testability. Note what you changed and why.
3. **Decompose the specification into manageable tasks.** Produce a `TASKS.md` with small, independently verifiable tasks.
4. **Execute the tasks.** Implement with your coding agent(s), task by task.
5. **Review the implementation.** Review the agent's output as you would a teammate's PR. Capture what you accepted, what you rejected, and what you'd improve with more time.

Treat the steps as a guide, not a script. If you skip, reorder, or replace any of them, just tell us where and why — a better approach, well-reasoned, is a strong signal.

## 3. The challenge — "Screening Order Service"

Mirantus partners (opticians, clinics) submit **screening orders** that flow into our operations. Build a small backend service that owns this resource end-to-end.

Build a service with the following core features:

**a) REST API for screening orders**
- `POST /orders` — create an order. Payload includes `partnerId`, `patientReference` (a pseudonymous string, **not** real PII), `requestedLocation`, and `priority` (`routine` | `urgent`). Returns `201` with the created resource.
- `GET /orders` — list orders with filtering by `status` and `partnerId`, and pagination.
- `GET /orders/:id` — fetch one.
- `PATCH /orders/:id/status` — transition status through a valid lifecycle (`received` → `accepted` → `in_progress` → `completed`, plus `rejected`). Reject invalid transitions with a clear `409`.

**b) Validation and idempotency**
- Validate all input (reject bad payloads with `400` and useful messages).
- Make `POST /orders` **idempotent** via an `Idempotency-Key` header so a partner retrying a request doesn't create duplicates.

**c) Persistence**
- Persist to **PostgreSQL** (run via Docker Compose). Use migrations.

**d) Operability ("you build it, you run it")**
- Add a `GET /health` (and ideally `/ready`) endpoint.
- Add structured logging and at least basic request/error instrumentation (a metrics endpoint or meaningful logs are both acceptable — tell us your reasoning).
- Make configuration environment-driven (12-factor style).

### Required frameworks and tools

Please use this stack so your submission is comparable to others and representative of ours:

- **NestJS + TypeScript** (strict mode) for the service.
- **PostgreSQL**, orchestrated with **Docker** / **Docker Compose**, with migrations (TypeORM, Prisma, Drizzle, or Kysely — your choice; justify it briefly).
- **Tests:** **Vitest** or **Jest** — unit tests for the status-transition logic and the idempotency logic, plus at least one integration test that exercises the API against a real (containerised) Postgres.
- **CI:** a **GitHub Actions** workflow that installs, lints, builds, and runs the tests (spinning up Postgres as a service). It should pass on a clean checkout.
- **Terraform:** a small, well-structured **Terraform** module that describes how this service *would* be deployed (e.g. a container service + its managed Postgres + the few resources around it). It does **not** need to apply against a real cloud account — we're evaluating structure, variables/outputs, and clarity, not a live deployment. Targeting `localstack`, a `null`/`local` provider, or a plan-only AWS/GCP module are all fine; say which you chose and why.

You are free to add small libraries where reasonable, but keep dependencies justified.

## 4. What to hand in

A Git repository (link or zip) containing:

- The working service, tests, Docker Compose, CI workflow, and Terraform module.
- `SPEC.md` — your specification (step 1) and your self-review notes (step 2).
- `TASKS.md` — your task decomposition (step 3).
- `AI_USAGE.md` — a short, honest account (½–1 page) of how you used coding agents: which agent(s), how you prompted/steered them, **where the agent got it wrong and how you caught and corrected it** (the idempotency and the invalid-transition handling are good places to look), and what you would do differently. Representative prompts or a transcript excerpt are welcome but not required.
- A `README.md` with setup/run/test instructions — someone on our team should be able to `docker compose up`, run the migrations, hit the API, and run the tests by following it.

> **Where deliverables live:** Put everything you hand in under **`candidate/`**
> (service under `candidate/service/`, with `SPEC.md`, `TASKS.md`, `AI_USAGE.md`, Docker,
> CI, and Terraform alongside it). The `provided/` folder is ours; leave it as the harness.

## 5. Constraints and notes

- **Time-box it.** A focused ~4-hour core is the target. If you run out of time, leave a clear "what I'd do next" note rather than rushing — we read those.
- **Scope down on purpose.** Cutting scope with a documented reason is a positive signal, not a negative one. (For example: a plan-only Terraform module, or a single happy-path integration test, are perfectly acceptable trade-offs if you say so.)
- **No real patient data.** Everything is synthetic and pseudonymous; treat it as if it were sensitive (we're health-tech) and mention any privacy/PII or regulatory considerations you'd carry into production.
- **A provided frontend is available.** This repo ships with a small React test-harness UI under `provided/frontend/` that exercises your API (list orders, create with an `Idempotency-Key`, transition status). It **expects the API contract exactly as written above** (see [`provided/frontend/README.md`](./provided/frontend/README.md) for the precise contract it assumes). Use it to see your service working end-to-end. **You are not evaluated on it, and may modify or ignore it.**
- Use of AI is **expected and encouraged** — this is exactly what we want to see. We are not looking for hand-written heroics; we're looking for good engineering and operational judgement applied to AI-assisted delivery.

## 6. The follow-up conversation

In the next interview step we'll ask you to walk us through your `AI_USAGE.md` and your repo: why you scoped it the way you did, a moment where the agent produced something you rejected (e.g. an incorrect status-transition or a non-idempotent create), how your CI and Terraform would evolve, and what "running it in production" would actually require. Come ready to discuss trade-offs and operations, not to defend perfection.

Good luck — and have fun with it.
