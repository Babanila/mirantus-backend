import { useState } from 'react';
import { newIdempotencyKey } from '../api';
import { ORDER_PRIORITIES } from '../types';
import type { CreateOrderInput, OrderPriority } from '../types';

interface CreateOrderFormProps {
  onSubmit: (input: CreateOrderInput, idempotencyKey: string) => Promise<void>;
  busy: boolean;
}

// Form that POSTs to /orders. Every submit sends an `Idempotency-Key` header.
// The "reuse last key" toggle lets the candidate test idempotency from the UI:
// when ON, the same key is reused across submits (the service should return the
// originally created order rather than creating a duplicate). When OFF, a fresh
// UUID is generated for each submit.
export function CreateOrderForm({ onSubmit, busy }: CreateOrderFormProps) {
  const [partnerId, setPartnerId] = useState('partner-001');
  const [patientReference, setPatientReference] = useState('patient-ref-abc');
  const [requestedLocation, setRequestedLocation] = useState('Berlin Clinic');
  const [priority, setPriority] = useState<OrderPriority>('routine');

  const [reuseKey, setReuseKey] = useState(false);
  const [currentKey, setCurrentKey] = useState<string>(() =>
    newIdempotencyKey(),
  );

  function regenerateKey() {
    setCurrentKey(newIdempotencyKey());
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    // When reuse is ON, keep the same key across submits so the candidate can
    // observe idempotent behaviour. When OFF, send the current key, then roll a
    // new one for the next submit.
    const keyToSend = currentKey;
    await onSubmit(
      { partnerId, patientReference, requestedLocation, priority },
      keyToSend,
    );
    if (!reuseKey) {
      regenerateKey();
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Create order</h2>
      </div>
      <form onSubmit={handleSubmit} className="create-form">
        <label>
          <span>partnerId</span>
          <input
            value={partnerId}
            onChange={(e) => setPartnerId(e.target.value)}
            required
          />
        </label>
        <label>
          <span>patientReference (pseudonymous, not real PII)</span>
          <input
            value={patientReference}
            onChange={(e) => setPatientReference(e.target.value)}
            required
          />
        </label>
        <label>
          <span>requestedLocation</span>
          <input
            value={requestedLocation}
            onChange={(e) => setRequestedLocation(e.target.value)}
            required
          />
        </label>
        <label>
          <span>priority</span>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as OrderPriority)}
          >
            {ORDER_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <div className="idempotency-controls">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={reuseKey}
              onChange={(e) => setReuseKey(e.target.checked)}
            />
            <span>Reuse last Idempotency-Key across submits</span>
          </label>
          <div className="key-row">
            <code title="Idempotency-Key header value">{currentKey}</code>
            <button type="button" onClick={regenerateKey} disabled={busy}>
              New key
            </button>
          </div>
          <p className="muted">
            {reuseKey
              ? 'Reuse is ON — the same key is sent on every submit. Submit twice to test idempotency.'
              : 'Reuse is OFF — a fresh key is generated after each submit.'}
          </p>
        </div>

        <button type="submit" disabled={busy}>
          {busy ? 'Submitting…' : 'POST /orders'}
        </button>
      </form>
    </section>
  );
}
