import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const root = new URL('../../', import.meta.url);

test('preview login provisioning is no-login by default and least privilege', async () => {
  const sql = await readFile(new URL('db/research/002_preview_reader.sql', root), 'utf8');

  assert.match(sql, /CREATE ROLE proply_research_api/);
  assert.match(sql, /ALTER ROLE proply_research_api\s+NOLOGIN[\s\S]*NOCREATEDB[\s\S]*NOCREATEROLE[\s\S]*NOINHERIT[\s\S]*CONNECTION LIMIT 4/i);
  assert.match(sql, /rolsuper[\s\S]*rolreplication[\s\S]*rolbypassrls[\s\S]*RAISE EXCEPTION/i);
  assert.doesNotMatch(sql, /^\s*(NOSUPERUSER|NOREPLICATION|NOBYPASSRLS)\s*$/im);
  assert.match(sql, /GRANT CONNECT ON DATABASE[\s\S]*proply_research_api/i);
  assert.match(sql, /GRANT USAGE ON SCHEMA research TO proply_research_api/i);
  assert.match(sql, /GRANT SELECT ON research\.market_summary_source TO proply_research_api/i);
  assert.match(sql, /REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM proply_research_api/i);
  assert.doesNotMatch(sql, /^\s*ALTER ROLE proply_research_api\s+LOGIN/im);
  assert.doesNotMatch(sql, /^\s*ALTER ROLE proply_research_api\s+PASSWORD/im);
});

test('preview runbook preserves external approval and teardown boundaries', async () => {
  const runbook = await readFile(new URL('docs/research-preview-runbook.md', root), 'utf8');

  for (const required of [
    'RESEARCH_API_ENABLED',
    'DATABASE_READ_URL',
    'preview',
    'WAF',
    'spend',
    'teardown',
    'production alias',
    'separate explicit approval',
    'per-instance',
  ]) {
    assert.match(runbook, new RegExp(required, 'i'));
  }
});
