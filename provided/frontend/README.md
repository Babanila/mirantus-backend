# Provided frontend — Screening Order Service test harness

This is a small **Vite + React + TypeScript** single-page app that exercises the
**Screening Order Service** you build for the case study. It is a deliberately minimal
**test harness, not a product** — its only job is to let you create, list, and transition
orders against your API and see exactly what your service returns.

> **You are not evaluated on this frontend.** You may modify it, extend it, or ignore it
> entirely. It is here purely to help you see your service working end-to-end.

---

## Quick start

```bash
cd provided/frontend
cp .env.example .env      # sets VITE_API_BASE_URL=http://localhost:3000
npm install
npm run dev               # prints the local dev URL, e.g. http://localhost:5173/
```

Open the printed URL in your browser. If your service is not running, the app shows a
calm "couldn't reach the service at <url> — is it running?" banner with a Retry button —
it does **not** crash.

Other scripts:

- `npm run build` — type-checks (strict) and produces a production build in `dist/`.
- `npm run preview` — serves the production build locally.
- `npm run typecheck` — runs `tsc` in strict mode with no emit.

---

## Pointing it at your service

The API base URL is read from the `VITE_API_BASE_URL` environment variable
(see `.env.example`). It defaults to `http://localhost:3000`.

To use a different URL, edit `.env`:

```
VITE_API_BASE_URL=http://localhost:8080
```

Restart `npm run dev` after changing `.env` (Vite reads env vars at startup).

> CORS: because the dev server runs on a different origin (e.g. `:5173`) from your service
> (e.g. `:3000`), your service must allow the harness origin — enable CORS in your NestJS
> app (e.g. `app.enableCors()`), or run the harness behind the same origin.

---

## What the harness does

1. **List orders** — `GET /orders`, rendered in a table with columns
   `id`, `partnerId`, `patientReference`, `requestedLocation`, `priority`, `status`.
   Provides `status` and `partnerId` filters and Prev/Next pagination controls. These are
   sent as query parameters; if your service does not implement them yet, the harness
   **degrades gracefully** (it still renders whatever list comes back).
2. **Create an order** — a form that `POST`s to `/orders`. Every create request sends an
   **`Idempotency-Key`** header (a UUID). A **"reuse last key"** toggle keeps the same key
   across submits so you can test idempotency by hand: with reuse ON, submit twice — your
   service should return the original order, not create a duplicate.
3. **Transition status** — a per-row control that `PATCH`es `/orders/:id/status` with
   `{ status }`. When your service rejects an invalid transition with `409`, the harness
   surfaces it clearly (an error banner plus the raw `409` body in the debug panel).
4. **Graceful degradation** — if the service is unreachable, you get the friendly banner
   described above instead of a crash.
5. **Debug panel** — every request/response (and any error) is shown raw, most recent
   first, including request headers (so you can confirm the `Idempotency-Key` was sent) and
   full response bodies (so you can read your exact `400`/`404`/`409` payloads).

---

## The API contract the harness assumes

The harness expects your service to implement the contract from
[`../../CASE_STUDY.md`](../../CASE_STUDY.md). Precisely:

### `POST /orders`
- **Request body:** `{ "partnerId": string, "patientReference": string, "requestedLocation": string, "priority": "routine" | "urgent" }`
- **Request header:** `Idempotency-Key: <uuid>` — the same key must **not** create a
  duplicate; a retry with the same key should return the originally created order.
- **Success:** `201 Created` with the created order resource as JSON.
- **Invalid body:** `400` with a useful message.

### `GET /orders`
- **Query params (optional):** `status`, `partnerId`, `page`, `pageSize`.
- **Success:** `200` with **either** a bare JSON array of orders, **or** an envelope such
  as `{ "data": [...], "total": number, "page": number, "pageSize": number }`. The harness
  accepts `data`, `orders`, `items`, or `results` as the array field. Pagination metadata
  is optional.

### `GET /orders/:id`
- **Success:** `200` with the order. **Missing:** `404`.
  *(The harness does not call this endpoint directly, but your service should provide it
  per the brief.)*

### `PATCH /orders/:id/status`
- **Request body:** `{ "status": "received" | "accepted" | "in_progress" | "completed" | "rejected" }`
- **Valid lifecycle:** `received → accepted → in_progress → completed`, plus `rejected`
  (reachable from the appropriate states per your spec).
- **Success:** `200` with the updated order.
- **Invalid transition:** `409 Conflict` (the harness renders the body so you can confirm
  your error shape).

### An order resource
Minimum fields the table reads:
`id`, `partnerId`, `patientReference`, `requestedLocation`, `priority`, `status`.
Extra fields (timestamps, etc.) are fine and are visible in the debug panel.

---

## Project structure

```
provided/frontend/
├── index.html
├── package.json
├── tsconfig.json            # references app + node configs
├── tsconfig.app.json        # strict TS for src/
├── tsconfig.node.json       # strict TS for vite.config.ts
├── vite.config.ts
├── .env.example             # VITE_API_BASE_URL=http://localhost:3000
└── src/
    ├── main.tsx             # React entry
    ├── App.tsx              # state, filters, banners, 409/network handling
    ├── api.ts               # fetch client: Idempotency-Key, NetworkError, ApiError, debug sink
    ├── types.ts             # Order, status/priority enums, debug entry
    ├── index.css
    └── components/
        ├── CreateOrderForm.tsx   # POST /orders + reuse-key toggle
        ├── OrdersTable.tsx       # table + per-row transition control
        └── DebugPanel.tsx        # raw request/response viewer
```
