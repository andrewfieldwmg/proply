import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const adminDatabaseUrl = process.env.GATE2_ADMIN_DATABASE_URL;

if (!adminDatabaseUrl) {
  throw new Error('GATE2_ADMIN_DATABASE_URL is required');
}

const parsedUrl = new URL(adminDatabaseUrl);
const allowedHosts = new Set(['127.0.0.1', 'localhost', '::1']);
if (!allowedHosts.has(parsedUrl.hostname)) {
  throw new Error('Gate 2 verification refuses non-loopback databases');
}
if (parsedUrl.pathname !== '/proply_gate2_isolated') {
  throw new Error('Gate 2 verification requires database proply_gate2_isolated');
}

const admin = new Client({ connectionString: adminDatabaseUrl });
await admin.connect();

const denied = [];
const expectDenied = async (client, label, sql) => {
  try {
    await client.query(sql);
  } catch (error) {
    assert.ok(
      ['25006', '42501', '55000'].includes(error.code),
      `${label} failed with unexpected PostgreSQL code ${error.code}`,
    );
    denied.push(label);
    return;
  }
  assert.fail(`${label} unexpectedly succeeded`);
};

try {
  const preflight = await admin.query(`
    SELECT count(*)::int AS user_relations
    FROM pg_catalog.pg_class value
    JOIN pg_catalog.pg_namespace namespace ON namespace.oid = value.relnamespace
    WHERE namespace.nspname NOT IN ('pg_catalog', 'information_schema')
      AND namespace.nspname !~ '^pg_toast'
      AND value.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
  `);
  assert.equal(preflight.rows[0].user_relations, 0, 'database must be empty');

  const existingRole = await admin.query(`
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'proply_research_reader'
  `);
  assert.equal(existingRole.rowCount, 0, 'research role must not pre-exist in disposable cluster');

  await admin.query(`
    CREATE TABLE public.land_registry_transactions (
      transaction_id uuid PRIMARY KEY,
      price bigint NOT NULL,
      transfer_date date NOT NULL,
      postcode text,
      property_type char(1),
      tenure char(1),
      category_type char(1),
      market_price_outlier boolean NOT NULL DEFAULT false,
      imported_at timestamptz NOT NULL
    )
  `);

  await admin.query(`
    INSERT INTO public.land_registry_transactions (
      transaction_id, price, transfer_date, postcode, property_type,
      tenure, category_type, market_price_outlier, imported_at
    ) VALUES
      ('00000000-0000-0000-0000-000000000001', 400000, '2020-01-10', 'E10 1AA', 'T', 'F', 'A', false, '2026-10-20T06:00:00Z'),
      ('00000000-0000-0000-0000-000000000002', 600000, '2020-06-10', 'E10 2BB', 'T', 'F', 'A', false, '2026-10-20T06:01:00Z'),
      ('00000000-0000-0000-0000-000000000003', 300000, '2021-03-10', 'E11 3CC', 'F', 'F', 'A', false, '2026-10-20T06:02:00Z'),
      ('00000000-0000-0000-0000-000000000004', 900000, '2021-03-10', 'E12 4DD', 'D', 'F', 'A', false, '2026-10-20T06:03:00Z'),
      ('00000000-0000-0000-0000-000000000005', 450000, '2021-03-10', 'E17 5EE', 'T', 'L', 'A', false, '2026-10-20T06:04:00Z'),
      ('00000000-0000-0000-0000-000000000006', 475000, '2021-03-10', 'E17 6FF', 'T', 'F', 'B', false, '2026-10-20T06:05:00Z'),
      ('00000000-0000-0000-0000-000000000007', 9999999, '2021-03-10', 'E17 7GG', 'D', 'F', 'A', true, '2026-10-20T06:06:00Z'),
      ('00000000-0000-0000-0000-000000000008', 250000, '2021-03-10', 'E17 8HH', 'O', 'F', 'A', false, '2026-10-20T06:07:00Z')
  `);

  const provisioningSql = await readFile(
    path.join(projectRoot, 'db', 'research', '001_reduced_read_model.sql'),
    'utf8',
  );
  await admin.query(provisioningSql);
  await admin.query(provisioningSql);

  const roleResult = await admin.query(`
    SELECT rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolreplication,
           rolbypassrls, rolinherit, rolconnlimit, rolconfig
    FROM pg_catalog.pg_roles
    WHERE rolname = 'proply_research_reader'
  `);
  assert.equal(roleResult.rowCount, 1);
  const role = roleResult.rows[0];
  assert.equal(role.rolcanlogin, false);
  assert.equal(role.rolsuper, false);
  assert.equal(role.rolcreatedb, false);
  assert.equal(role.rolcreaterole, false);
  assert.equal(role.rolreplication, false);
  assert.equal(role.rolbypassrls, false);
  assert.equal(role.rolinherit, false);
  assert.equal(role.rolconnlimit, 10);
  const roleConfiguration = new Set(role.rolconfig ?? []);
  for (const setting of [
    'default_transaction_read_only=on',
    'statement_timeout=3000ms',
    'lock_timeout=500ms',
    'idle_in_transaction_session_timeout=5000ms',
  ]) {
    assert.ok(roleConfiguration.has(setting), `missing role setting ${setting}`);
  }

  const privileges = await admin.query(`
    SELECT
      has_database_privilege('proply_research_reader', current_database(), 'CONNECT') AS can_connect,
      has_schema_privilege('proply_research_reader', 'research', 'USAGE') AS research_usage,
      has_schema_privilege('proply_research_reader', 'research', 'CREATE') AS research_create,
      has_schema_privilege('proply_research_reader', 'public', 'CREATE') AS public_create,
      has_table_privilege('proply_research_reader', 'research.market_summary_source', 'SELECT') AS view_select,
      has_table_privilege('proply_research_reader', 'research.market_summary_source', 'INSERT') AS view_insert,
      has_table_privilege('proply_research_reader', 'research.market_summary_source', 'UPDATE') AS view_update,
      has_table_privilege('proply_research_reader', 'research.market_summary_source', 'DELETE') AS view_delete,
      has_table_privilege('proply_research_reader', 'research.market_summary_source', 'TRUNCATE') AS view_truncate,
      has_table_privilege('proply_research_reader', 'research.market_summary_source', 'REFERENCES') AS view_references,
      has_table_privilege('proply_research_reader', 'research.market_summary_source', 'TRIGGER') AS view_trigger,
      has_table_privilege('proply_research_reader', 'public.land_registry_transactions', 'SELECT') AS base_select,
      has_table_privilege('proply_research_reader', 'public.land_registry_transactions', 'INSERT') AS base_insert,
      has_table_privilege('proply_research_reader', 'public.land_registry_transactions', 'UPDATE') AS base_update,
      has_table_privilege('proply_research_reader', 'public.land_registry_transactions', 'DELETE') AS base_delete
  `);
  assert.deepEqual(privileges.rows[0], {
    can_connect: true,
    research_usage: true,
    research_create: false,
    public_create: false,
    view_select: true,
    view_insert: false,
    view_update: false,
    view_delete: false,
    view_truncate: false,
    view_references: false,
    view_trigger: false,
    base_select: false,
    base_insert: false,
    base_update: false,
    base_delete: false,
  });

  const viewSecurity = await admin.query(`
    SELECT option_value
    FROM pg_catalog.pg_class value
    JOIN pg_catalog.pg_namespace namespace ON namespace.oid = value.relnamespace
    CROSS JOIN LATERAL unnest(value.reloptions) option_value
    WHERE namespace.nspname = 'research'
      AND value.relname = 'market_summary_source'
  `);
  assert.ok(viewSecurity.rows.some((row) => row.option_value === 'security_barrier=true'));

  await admin.query('ALTER ROLE proply_research_reader LOGIN');
} finally {
  await admin.end();
}

const readerUrl = new URL(adminDatabaseUrl);
readerUrl.username = 'proply_research_reader';
readerUrl.password = '';
const reader = new Client({ connectionString: readerUrl.toString() });
await reader.connect();

try {
  const defaults = await reader.query('SHOW default_transaction_read_only');
  assert.equal(defaults.rows[0].default_transaction_read_only, 'on');

  const columns = await reader.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'research' AND table_name = 'market_summary_source'
    ORDER BY ordinal_position
  `);
  assert.deepEqual(
    columns.rows.map((row) => row.column_name),
    ['area', 'sale_year', 'property_type', 'sold_price', 'data_refreshed_at'],
  );

  const summary = await reader.query(`
    SELECT count(*)::int AS transaction_count,
           avg(sold_price)::numeric(12, 2) AS average_sold_price,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY sold_price)::numeric(12, 2)
             AS median_sold_price,
           max(data_refreshed_at) AS data_refreshed_at
    FROM research.market_summary_source
    WHERE area = 'E10' AND sale_year BETWEEN 2020 AND 2020 AND property_type = 'T'
  `);
  assert.equal(summary.rows[0].transaction_count, 2);
  assert.equal(summary.rows[0].average_sold_price, '500000.00');
  assert.equal(summary.rows[0].median_sold_price, '500000.00');
  assert.equal(new Date(summary.rows[0].data_refreshed_at).toISOString(), '2026-10-20T06:02:00.000Z');

  const retainedRows = await reader.query('SELECT count(*)::int AS count FROM research.market_summary_source');
  assert.equal(retainedRows.rows[0].count, 3);

  await reader.query('SET default_transaction_read_only = off');
  await expectDenied(reader, 'base table select', 'SELECT count(*) FROM public.land_registry_transactions');
  await expectDenied(reader, 'view insert', `
    INSERT INTO research.market_summary_source
      (area, sale_year, property_type, sold_price, data_refreshed_at)
    VALUES ('E10', 2020, 'T', 1, now())
  `);
  await expectDenied(reader, 'view update', `
    UPDATE research.market_summary_source SET sold_price = 1
  `);
  await expectDenied(reader, 'view delete', 'DELETE FROM research.market_summary_source');
  await expectDenied(reader, 'research schema create', 'CREATE TABLE research.denied (id integer)');
  await expectDenied(reader, 'public schema create', 'CREATE TABLE public.denied (id integer)');
} finally {
  await reader.end();
}

console.log(JSON.stringify({
  database: 'proply_gate2_isolated',
  exposed_view: 'research.market_summary_source',
  retained_fixture_rows: 3,
  denied_operations: denied,
  result: 'passed',
}));
