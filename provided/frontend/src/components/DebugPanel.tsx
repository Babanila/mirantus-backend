import type { DebugEntry } from '../types';

interface DebugPanelProps {
  entries: DebugEntry[];
  onClear: () => void;
}

function format(value: unknown): string {
  if (value === undefined) {
    return '(none)';
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

// Shows the raw request/response (and any error) for every API interaction,
// most recent first, so the candidate can see exactly what their service sent
// back — including 4xx/5xx bodies such as a 409 invalid-transition error.
export function DebugPanel({ entries, onClear }: DebugPanelProps) {
  return (
    <section className="panel debug-panel">
      <div className="panel-header">
        <h2>Debug — raw requests &amp; responses</h2>
        <button type="button" onClick={onClear} disabled={entries.length === 0}>
          Clear
        </button>
      </div>
      {entries.length === 0 ? (
        <p className="muted">No requests yet. Interactions will appear here.</p>
      ) : (
        <ol className="debug-list">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className={`debug-entry ${entry.ok ? 'ok' : 'fail'}`}
            >
              <div className="debug-entry-head">
                <span className="debug-method">{entry.method}</span>
                <span className="debug-url">{entry.url}</span>
                <span className="debug-status">
                  {entry.status !== undefined
                    ? `→ ${entry.status}`
                    : entry.error
                      ? '→ network error'
                      : ''}
                </span>
                <span className="debug-time">{entry.at}</span>
              </div>
              {entry.requestHeaders && (
                <details>
                  <summary>Request headers</summary>
                  <pre>{format(entry.requestHeaders)}</pre>
                </details>
              )}
              {entry.requestBody !== undefined && (
                <details>
                  <summary>Request body</summary>
                  <pre>{format(entry.requestBody)}</pre>
                </details>
              )}
              {entry.error ? (
                <details open>
                  <summary>Error</summary>
                  <pre>{entry.error}</pre>
                </details>
              ) : (
                <details open={!entry.ok}>
                  <summary>Response body</summary>
                  <pre>{format(entry.responseBody)}</pre>
                </details>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
