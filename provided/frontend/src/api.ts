import type { CreateOrderInput, DebugEntry, Order, OrderStatus } from './types';

// Base URL of the candidate's service, from VITE_API_BASE_URL (see .env.example).
export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'
).replace(/\/+$/, '');

// Raised when the service cannot be reached at all (connection refused, DNS,
// CORS preflight failure, etc.). The UI turns this into a calm, friendly
// "is it running?" message rather than crashing.
export class NetworkError extends Error {
  constructor(public readonly baseUrl: string, cause?: unknown) {
    super(`couldn't reach the service at ${baseUrl} — is it running?`);
    this.name = 'NetworkError';
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

// Raised when the service responds with a non-2xx status. The raw body is kept
// so it can be rendered verbatim in the debug panel (e.g. a 409 transition
// error, or a 400 validation message).
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message?: string,
  ) {
    super(message ?? `request failed with status ${status}`);
    this.name = 'ApiError';
  }
}

export interface ListOrdersParams {
  status?: OrderStatus | '';
  partnerId?: string;
  page?: number;
  pageSize?: number;
}

export interface ListOrdersResult {
  orders: Order[];
  // Pagination metadata is optional: the harness degrades gracefully when the
  // service does not implement it. `raw` is whatever the service actually sent.
  total?: number;
  page?: number;
  pageSize?: number;
  raw: unknown;
}

type DebugSink = (entry: DebugEntry) => void;

function newId(): string {
  return globalThis.crypto.randomUUID();
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (text.length === 0) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    // Not JSON — return the raw text so the debug panel still shows something.
    return text;
  }
}

interface RequestOptions {
  method: string;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  onDebug?: DebugSink;
}

// Core fetch wrapper. Records every interaction to the debug sink, converts
// connection failures into NetworkError, and non-2xx responses into ApiError.
async function request<T>(opts: RequestOptions): Promise<T> {
  const { method, path, body, headers = {}, onDebug } = opts;
  const url = `${API_BASE_URL}${path}`;
  const requestHeaders: Record<string, string> = { ...headers };

  let fetchBody: string | undefined;
  if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json';
    fetchBody = JSON.stringify(body);
  }

  const baseDebug: Omit<DebugEntry, 'ok'> = {
    id: newId(),
    at: new Date().toISOString(),
    method,
    url,
    requestHeaders,
    ...(body !== undefined ? { requestBody: body } : {}),
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: requestHeaders,
      ...(fetchBody !== undefined ? { body: fetchBody } : {}),
    });
  } catch (cause) {
    // fetch rejects only on network-level failures — i.e. the service is down
    // or unreachable. Surface a friendly, non-crashing error.
    const networkError = new NetworkError(API_BASE_URL, cause);
    onDebug?.({
      ...baseDebug,
      ok: false,
      error: networkError.message,
    });
    throw networkError;
  }

  const responseBody = await readBody(res);

  onDebug?.({
    ...baseDebug,
    status: res.status,
    ok: res.ok,
    responseBody,
  });

  if (!res.ok) {
    throw new ApiError(res.status, responseBody);
  }

  return responseBody as T;
}

// Normalise a list response. The service may return either a bare array or an
// envelope like { data: [...], total, page, pageSize }. Both are accepted.
function normaliseList(raw: unknown): ListOrdersResult {
  if (Array.isArray(raw)) {
    return { orders: raw as Order[], raw };
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const candidate = obj.data ?? obj.orders ?? obj.items ?? obj.results;
    if (Array.isArray(candidate)) {
      return {
        orders: candidate as Order[],
        ...(typeof obj.total === 'number' ? { total: obj.total } : {}),
        ...(typeof obj.page === 'number' ? { page: obj.page } : {}),
        ...(typeof obj.pageSize === 'number' ? { pageSize: obj.pageSize } : {}),
        raw,
      };
    }
  }
  // Unknown shape — show nothing in the table but keep the raw body visible.
  return { orders: [], raw };
}

export const api = {
  async listOrders(
    params: ListOrdersParams,
    onDebug?: DebugSink,
  ): Promise<ListOrdersResult> {
    const query = new URLSearchParams();
    if (params.status) {
      query.set('status', params.status);
    }
    if (params.partnerId) {
      query.set('partnerId', params.partnerId);
    }
    if (params.page !== undefined) {
      query.set('page', String(params.page));
    }
    if (params.pageSize !== undefined) {
      query.set('pageSize', String(params.pageSize));
    }
    const qs = query.toString();
    const raw = await request<unknown>({
      method: 'GET',
      path: `/orders${qs ? `?${qs}` : ''}`,
      ...(onDebug ? { onDebug } : {}),
    });
    return normaliseList(raw);
  },

  async createOrder(
    input: CreateOrderInput,
    idempotencyKey: string,
    onDebug?: DebugSink,
  ): Promise<Order> {
    return request<Order>({
      method: 'POST',
      path: '/orders',
      body: input,
      // The contract requires the create request to carry an Idempotency-Key.
      headers: { 'Idempotency-Key': idempotencyKey },
      ...(onDebug ? { onDebug } : {}),
    });
  },

  async transitionStatus(
    id: string,
    status: OrderStatus,
    onDebug?: DebugSink,
  ): Promise<Order> {
    return request<Order>({
      method: 'PATCH',
      path: `/orders/${encodeURIComponent(id)}/status`,
      body: { status },
      ...(onDebug ? { onDebug } : {}),
    });
  },
};

// Convenience for the create form: a fresh Idempotency-Key (UUID).
export function newIdempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}
