import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, API_BASE_URL, NetworkError } from './api';
import type { ListOrdersResult } from './api';
import { CreateOrderForm } from './components/CreateOrderForm';
import { DebugPanel } from './components/DebugPanel';
import { OrdersTable } from './components/OrdersTable';
import { ORDER_STATUSES } from './types';
import type {
  CreateOrderInput,
  DebugEntry,
  OrderStatus,
} from './types';

type Banner =
  | { kind: 'unreachable'; message: string }
  | { kind: 'error'; message: string }
  | { kind: 'success'; message: string }
  | null;

const DEFAULT_PAGE_SIZE = 20;

export function App() {
  const [result, setResult] = useState<ListOrdersResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [transitioningId, setTransitioningId] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner>(null);

  // Filters & pagination. The harness sends these; the service may ignore them
  // (we degrade gracefully) — see normaliseList in api.ts.
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('');
  const [partnerFilter, setPartnerFilter] = useState('');
  const [page, setPage] = useState(1);

  const [debug, setDebug] = useState<DebugEntry[]>([]);
  const pushDebug = useCallback((entry: DebugEntry) => {
    setDebug((prev) => [entry, ...prev].slice(0, 50));
  }, []);

  // Turns any thrown error into a banner. NetworkError → the calm friendly
  // "is it running?" message; ApiError → status + raw body summary; anything
  // else → a generic message. Never throws further (no crash).
  const reportError = useCallback((err: unknown): void => {
    if (err instanceof NetworkError) {
      setBanner({ kind: 'unreachable', message: err.message });
      return;
    }
    if (err instanceof ApiError) {
      const detail =
        typeof err.body === 'string'
          ? err.body
          : err.body
            ? JSON.stringify(err.body)
            : '';
      const prefix =
        err.status === 409
          ? `Invalid transition (409)`
          : `Request failed (${err.status})`;
      setBanner({
        kind: 'error',
        message: detail ? `${prefix}: ${detail}` : prefix,
      });
      return;
    }
    setBanner({
      kind: 'error',
      message: err instanceof Error ? err.message : 'Unexpected error',
    });
  }, []);

  const loadOrders = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await api.listOrders(
        {
          status: statusFilter,
          partnerId: partnerFilter,
          page,
          pageSize: DEFAULT_PAGE_SIZE,
        },
        pushDebug,
      );
      setResult(res);
      // Clear only stale unreachable/error banners on a successful load.
      setBanner((prev) =>
        prev && prev.kind !== 'success' ? null : prev,
      );
    } catch (err) {
      reportError(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, partnerFilter, page, pushDebug, reportError]);

  // Initial load and reload whenever filters/page change.
  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  async function handleCreate(
    input: CreateOrderInput,
    idempotencyKey: string,
  ): Promise<void> {
    setCreating(true);
    try {
      await api.createOrder(input, idempotencyKey, pushDebug);
      setBanner({ kind: 'success', message: 'Order created (or returned).' });
      await loadOrders();
    } catch (err) {
      reportError(err);
    } finally {
      setCreating(false);
    }
  }

  async function handleTransition(
    id: string,
    status: OrderStatus,
  ): Promise<void> {
    setTransitioningId(id);
    try {
      await api.transitionStatus(id, status, pushDebug);
      setBanner({
        kind: 'success',
        message: `Order ${id} → ${status}.`,
      });
      await loadOrders();
    } catch (err) {
      reportError(err);
    } finally {
      setTransitioningId(null);
    }
  }

  const orders = result?.orders ?? [];

  return (
    <div className="app">
      <header className="app-header">
        <h1>Screening Order Service — test harness</h1>
        <p className="muted">
          Talking to <code>{API_BASE_URL}</code>. This is a provided harness —
          you are not graded on it.
        </p>
      </header>

      {banner && (
        <div className={`banner ${banner.kind}`} role="status">
          {banner.message}
          {banner.kind === 'unreachable' && (
            <button
              type="button"
              className="banner-retry"
              onClick={() => void loadOrders()}
            >
              Retry
            </button>
          )}
        </div>
      )}

      <div className="layout">
        <div className="col">
          <CreateOrderForm onSubmit={handleCreate} busy={creating} />

          <section className="panel">
            <div className="panel-header">
              <h2>Orders</h2>
              <button
                type="button"
                onClick={() => void loadOrders()}
                disabled={loading}
              >
                {loading ? 'Loading…' : 'Refresh'}
              </button>
            </div>

            <div className="filters">
              <label>
                <span>status</span>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as OrderStatus | '');
                    setPage(1);
                  }}
                >
                  <option value="">(any)</option>
                  {ORDER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>partnerId</span>
                <input
                  value={partnerFilter}
                  placeholder="(any)"
                  onChange={(e) => {
                    setPartnerFilter(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <div className="pagination">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={loading || page <= 1}
                >
                  Prev
                </button>
                <span className="muted">page {page}</span>
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={loading}
                >
                  Next
                </button>
              </div>
            </div>

            <OrdersTable
              orders={orders}
              busyId={transitioningId}
              onTransition={(id, status) => void handleTransition(id, status)}
            />
            {result?.total !== undefined && (
              <p className="muted">Reported total: {result.total}</p>
            )}
          </section>
        </div>

        <div className="col">
          <DebugPanel entries={debug} onClear={() => setDebug([])} />
        </div>
      </div>
    </div>
  );
}
