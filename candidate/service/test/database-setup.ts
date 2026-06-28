import { DataSource } from 'typeorm';

export async function truncateTables(ds: DataSource, tables: string[]): Promise<void> {
  if (!tables.length) return;

  const sql = tables.map((table) => `"${table}"`).join(', ');

  await ds.query(`TRUNCATE TABLE ${sql} RESTART IDENTITY CASCADE`);
}

export async function verifySchema(ds: DataSource): Promise<void> {
  const constraints = await ds.query(`
    SELECT
        tc.constraint_type,
        kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name='orders'
  `);

  const hasPrimaryKey = constraints.some(
    (c: Record<string, unknown>) => c.constraint_type === 'PRIMARY KEY',
  );

  const hasIdempotencyConstraint = constraints.some(
    (c: Record<string, unknown>) =>
      c.constraint_type === 'UNIQUE' && c.column_name === 'idempotency_key',
  );

  if (!hasPrimaryKey) {
    throw new Error('Orders table is missing PRIMARY KEY.');
  }

  if (!hasIdempotencyConstraint) {
    throw new Error('Orders table is missing UNIQUE constraint on idempotency_key.');
  }
}
