# Your workspace — build the Screening Order Service here

This folder is **yours**. Build your **NestJS + TypeScript** Screening Order Service in
this directory (you may restructure it however you like). The service should listen on
**`http://localhost:3000`** so the provided frontend can reach it out of the box — or, if
you prefer another port, update `VITE_API_BASE_URL` in `provided/frontend/.env` to match.

> This is a **placeholder**. Nothing is implemented yet — that part is your task.

## Where to find what you need

- **The full brief:** [`../../CASE_STUDY.md`](../../CASE_STUDY.md) — requirements, required
  stack (NestJS, PostgreSQL + migrations, Vitest/Jest, GitHub Actions CI, Terraform), and
  exactly what to hand in.
- **The API contract the provided frontend expects:**
  [`../../provided/frontend/README.md`](../../provided/frontend/README.md) — endpoints,
  the `Idempotency-Key` behaviour, the status lifecycle, and the `409` on invalid transitions.

## What lives under `candidate/`

Everything you hand in belongs under `candidate/` (this tree). At minimum:

- `candidate/service/` — the NestJS service, its tests, `Dockerfile`, and `docker-compose.yml`
  (PostgreSQL + migrations).
- A **GitHub Actions** workflow (e.g. `.github/workflows/...` at the repo root, or documented
  here) that installs, lints, builds, and runs the tests with Postgres as a service.
- A small **Terraform** module describing how the service *would* be deployed (plan-only is fine
  — just say so).
- `SPEC.md` — your specification and self-review notes.
- `TASKS.md` — your task decomposition.
- `AI_USAGE.md` — an honest account of how you used coding agents, where they got it wrong, and
  how you caught it.
- A `README.md` for your service with setup / run / test instructions.

## Suggested first steps

1. Read [`../../CASE_STUDY.md`](../../CASE_STUDY.md) and write your `SPEC.md` + `TASKS.md`.
2. Scaffold the NestJS service here and wire up PostgreSQL via Docker Compose with migrations.
3. Implement the API contract, then run the provided frontend
   (`cd ../../provided/frontend && cp .env.example .env && npm install && npm run dev`) to
   exercise it end-to-end.

Good luck!
