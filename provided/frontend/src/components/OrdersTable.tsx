import { ORDER_STATUSES } from '../types';
import type { Order, OrderStatus } from '../types';

interface OrdersTableProps {
  orders: Order[];
  busyId: string | null;
  onTransition: (id: string, status: OrderStatus) => void;
}

const COLUMNS: Array<keyof Order> = [
  'id',
  'partnerId',
  'patientReference',
  'requestedLocation',
  'priority',
  'status',
];

function cell(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }
  return String(value);
}

// Renders orders in a simple table and offers a per-row status transition
// control. The control PATCHes /orders/:id/status; an invalid transition is
// expected to return 409, which the parent surfaces clearly (banner + debug).
export function OrdersTable({ orders, busyId, onTransition }: OrdersTableProps) {
  if (orders.length === 0) {
    return <p className="muted">No orders to show.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {COLUMNS.map((col) => (
              <th key={col}>{col}</th>
            ))}
            <th>transition</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order, index) => {
            const id = cell(order.id);
            const rowKey = order.id ? id : `row-${index}`;
            return (
              <tr key={rowKey}>
                {COLUMNS.map((col) => (
                  <td key={col} className={col === 'status' ? 'status' : ''}>
                    {cell(order[col])}
                  </td>
                ))}
                <td>
                  <div className="transition-control">
                    <select
                      defaultValue=""
                      disabled={busyId === id}
                      onChange={(e) => {
                        const next = e.target.value as OrderStatus | '';
                        if (next) {
                          onTransition(id, next);
                          e.target.value = '';
                        }
                      }}
                      aria-label={`Transition status for order ${id}`}
                    >
                      <option value="" disabled>
                        {busyId === id ? 'working…' : 'set status…'}
                      </option>
                      {ORDER_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
