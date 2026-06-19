# Mirantus Case Study — Screening Order Service (Backend / DevOps)

Welcome, and thanks for taking the time. In this case study you will build a small
**Screening Order Service** backend and the operational scaffolding around it
(persistence, tests, Docker, CI, and a Terraform module). The full brief lives in
**[CASE_STUDY.md](./CASE_STUDY.md)** — please read it first.

This repository ships with a small **provided frontend** (a thin React test-harness)
so you can see your API working end-to-end without writing any UI. **You are not
graded on the frontend** — it is a tool, not a deliverable. You may modify or ignore it.

---

## Recommended order of work

1. **Read [CASE_STUDY.md](./CASE_STUDY.md)** — the requirements, required stack, and what to hand in.
2. **Write your spec and tasks** (`SPEC.md`, `TASKS.md`) under `candidate/`.
3. **Build your service** under `candidate/service/` — a **NestJS + TypeScript** service
   that listens on **`http://localhost:3000`** and implements the contract described in
   [`provided/frontend/README.md`](./provided/frontend/README.md).
4. **Run the provided frontend** against your service to exercise it end-to-end
   (list orders, create one with an `Idempotency-Key`, transition its status).
5. **Write up your work** (`AI_USAGE.md`, `README` for your service, etc.) under `candidate/`.

Everything you hand in lives under **`candidate/`**.

---

## Quick start — provided frontend

The provided frontend is a Vite + React + TypeScript single-page app. It expects your
service to be reachable at `http://localhost:3000` (configurable).

```bash
cd provided/frontend
cp .env.example .env      # sets VITE_API_BASE_URL=http://localhost:3000
npm install
npm run dev               # prints the local dev URL (e.g. http://localhost:5173)
```

Open the printed URL in your browser. If your service is not running yet, the app will
show a calm "couldn't reach the service" message rather than crashing — that is expected.

To point the frontend at a different service URL, edit `VITE_API_BASE_URL` in
`provided/frontend/.env`. See [`provided/frontend/README.md`](./provided/frontend/README.md)
for the exact API contract the harness assumes.

---

## Expected service URL

The provided frontend defaults to **`http://localhost:3000`**. Either have your service
listen there, or update `VITE_API_BASE_URL` in `provided/frontend/.env` to match your port.

---

## Repository layout

```
.
├── README.md                  # this file
├── CASE_STUDY.md              # the full case-study brief
├── provided/
│   └── frontend/              # PROVIDED test-harness UI (you are NOT graded on it)
└── candidate/
    └── service/               # YOUR workspace — build your NestJS service here
```

---

A note on the frontend: it is intentionally minimal — a harness to exercise your API,
not a polished product. Focus your time on the service and its operational story.
