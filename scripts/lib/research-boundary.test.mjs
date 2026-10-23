import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('research boundary publishes only the approved aggregate source fields', async () => {
  const matrix = JSON.parse(await readFile(
    path.join(root, 'config', 'research-boundary.json'),
    'utf8',
  ));

  assert.equal(matrix.status, 'approved_for_local_gate_2_only');
  assert.deepEqual(matrix.allowed_areas, ['ALL', 'E10', 'E11', 'E17']);
  assert.deepEqual(matrix.allowed_property_types, ['ALL', 'D', 'S', 'T', 'F']);
  assert.deepEqual(matrix.read_model_fields, [
    'area',
    'sale_year',
    'property_type',
    'sold_price',
    'data_refreshed_at',
  ]);
  for (const field of [
    'address', 'postcode', 'transaction_id', 'source_url', 'listing_price',
    'rightmove_property_id', 'latitude', 'longitude',
  ]) {
    assert.ok(matrix.excluded_fields.includes(field), `${field} must remain excluded`);
  }
  assert.match(matrix.attribution.statement, /HM Land Registry data/);
  assert.match(matrix.attribution.licence_url, /open-government-licence\/version\/3/);
});

test('research SQL grants one reduced view and denies write-capable role attributes', async () => {
  const sql = await readFile(
    path.join(root, 'db', 'research', '001_reduced_read_model.sql'),
    'utf8',
  );

  assert.match(sql, /CREATE OR REPLACE VIEW research\.market_summary_source/i);
  assert.match(sql, /security_barrier\s*=\s*true/i);
  assert.match(sql, /CREATE ROLE proply_research_reader/i);
  assert.match(sql, /NOLOGIN/i);
  assert.match(sql, /NOCREATEDB/i);
  assert.match(sql, /NOCREATEROLE/i);
  assert.match(sql, /rolsuper[\s\S]*rolreplication[\s\S]*rolbypassrls[\s\S]*RAISE EXCEPTION/i);
  assert.doesNotMatch(sql, /^\s*(NOSUPERUSER|NOREPLICATION|NOBYPASSRLS)\s*$/im);
  assert.match(sql, /GRANT SELECT ON research\.market_summary_source TO proply_research_reader/i);
  assert.doesNotMatch(sql, /GRANT\s+(INSERT|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER)/i);
  assert.doesNotMatch(sql, /rightmove|property_comparisons|legacy_price_comparisons/i);
});
