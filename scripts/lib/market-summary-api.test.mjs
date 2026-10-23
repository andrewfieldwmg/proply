import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  MARKET_SUMMARY_SQL,
  createMarketSummaryHandler,
  parseMarketSummaryParams,
} from '../../packages/research-core/src/market-summary.ts';

const successRow = {
  transaction_count: '2',
  average_sold_price: '500000',
  median_sold_price: '500000',
  data_refreshed_at: '2026-10-20T06:46:00.000Z',
};

function params(value) {
  return new URLSearchParams(value);
}

function dependencies(overrides = {}) {
  return {
    authorizeRequest: () => true,
    getDatabaseUrl: () => 'postgresql://reader@example.invalid/proply',
    querySummary: async () => [successRow],
    currentYear: () => 2026,
    createTraceId: () => 'trace-test-123',
    timeoutMs: 50,
    maxUrlLength: 512,
    ...overrides,
  };
}

test('missing and invalid service credentials fail identically before protected dependencies', async () => {
  const calls = { rate: 0, database: 0, concurrency: 0, query: 0 };
  const handler = createMarketSummaryHandler(dependencies({
    authorizeRequest: (request) => request.headers.get('authorization') === 'Bearer valid-test-token',
    checkRateLimit: () => {
      calls.rate += 1;
      return { allowed: true };
    },
    getDatabaseUrl: () => {
      calls.database += 1;
      return 'postgresql://reader@example.invalid/proply';
    },
    acquireConcurrency: () => {
      calls.concurrency += 1;
      return () => {};
    },
    querySummary: async () => {
      calls.query += 1;
      return [successRow];
    },
  }));
  const url = 'https://example.test/api/research/market-summary?area=E10&start_year=2020&end_year=2021';

  const missing = await handler(new Request(url));
  const invalid = await handler(new Request(url, {
    headers: { authorization: 'Bearer invalid-test-token' },
  }));
  const authFailure = await createMarketSummaryHandler(dependencies({
    authorizeRequest: () => { throw new Error('credential verifier detail'); },
  }))(new Request(url));

  assert.equal(missing.status, 401);
  assert.equal(invalid.status, 401);
  assert.equal(authFailure.status, 401);
  assert.deepEqual(await missing.json(), await invalid.json());
  assert.deepEqual(await authFailure.json(), {
    ok: false,
    error: {
      code: 'unauthorised',
      message: 'Authentication is required.',
      trace_id: 'trace-test-123',
    },
  });
  assert.equal(missing.headers.get('cache-control'), 'no-store');
  assert.equal(missing.headers.get('www-authenticate'), 'Bearer');
  assert.deepEqual(calls, { rate: 0, database: 0, concurrency: 0, query: 0 });
});

test('disabled route returns 404 without evaluating authentication', async () => {
  let authCalls = 0;
  const handler = createMarketSummaryHandler(dependencies({
    isEnabled: () => false,
    authorizeRequest: () => {
      authCalls += 1;
      return true;
    },
  }));

  const response = await handler(new Request(
    'https://example.test/api/research/market-summary?area=E10&start_year=2020&end_year=2021',
  ));

  assert.equal(response.status, 404);
  assert.equal(authCalls, 0);
});

test('policy accepts allowlisted inputs and exact year boundaries', () => {
  assert.deepEqual(
    parseMarketSummaryParams(
      params({ area: 'ALL', start_year: '1995', end_year: '2004', property_type: 'T' }),
      2026,
    ),
    { area: 'ALL', startYear: 1995, endYear: 2004, propertyType: 'T' },
  );
  assert.deepEqual(
    parseMarketSummaryParams(params({ area: 'E17', start_year: '2026', end_year: '2026' }), 2026),
    { area: 'E17', startYear: 2026, endYear: 2026, propertyType: 'ALL' },
  );
});

test('policy rejects unknown, duplicate, injection-shaped and excessive inputs', () => {
  const rejected = [
    'area=E10&start_year=2020&end_year=2021&sql=select+1',
    'area=E10&area=E11&start_year=2020&end_year=2021',
    'area=..%2F..%2Fprivate&start_year=2020&end_year=2021',
    'area=E10%27+OR+1%3D1+--&start_year=2020&end_year=2021',
    'area=E10&start_year=2020%3BDROP+TABLE+x&end_year=2021',
    'area=E10&start_year=1994&end_year=1995',
    'area=E10&start_year=2026&end_year=2027',
    'area=E10&start_year=2021&end_year=2020',
    'area=E10&start_year=1995&end_year=2005',
  ];

  for (const query of rejected) {
    assert.throws(() => parseMarketSummaryParams(params(query), 2026), { name: 'PolicyError' });
  }
});

test('success executes one bounded query and always returns rights and currency metadata', async () => {
  const calls = [];
  const handler = createMarketSummaryHandler(dependencies({
    querySummary: async (databaseUrl, request, signal) => {
      calls.push({ databaseUrl, request, signal });
      return [successRow];
    },
  }));

  const response = await handler(new Request(
    'https://example.test/api/research/market-summary?area=E10&start_year=2020&end_year=2021&property_type=T',
  ));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-trace-id'), 'trace-test-123');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].request, { area: 'E10', startYear: 2020, endYear: 2021, propertyType: 'T' });
  assert.equal(body.ok, true);
  assert.equal(body.data.transaction_count, 2);
  assert.equal(body.data.average_sold_price_gbp, 500000);
  assert.equal(body.data.median_sold_price_gbp, 500000);
  assert.equal(body.data.data_refreshed_at, '2026-10-20T06:46:00.000Z');
  assert.match(body.data.attribution.statement, /HM Land Registry data/);
  assert.match(body.data.attribution.licence_url, /nationalarchives\.gov\.uk/);
  assert.ok(body.data.limitations.length > 0);
  assert.equal(JSON.stringify(body).includes('postgresql://'), false);
});

test('handler fails closed without DATABASE_READ_URL and never queries', async () => {
  let called = false;
  const handler = createMarketSummaryHandler(dependencies({
    getDatabaseUrl: () => undefined,
    querySummary: async () => {
      called = true;
      return [successRow];
    },
  }));

  const response = await handler(new Request(
    'https://example.test/api/research/market-summary?area=E10&start_year=2020&end_year=2021',
  ));
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.error.code, 'dependency_unavailable');
  assert.equal(body.error.trace_id, 'trace-test-123');
  assert.equal(called, false);
});

test('disabled feature returns a traced 404 without querying', async () => {
  let called = false;
  const handler = createMarketSummaryHandler(dependencies({
    isEnabled: () => false,
    querySummary: async () => {
      called = true;
      return [successRow];
    },
  }));

  const response = await handler(new Request(
    'https://example.test/api/research/market-summary?area=E10&start_year=2020&end_year=2021',
  ));

  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'route_disabled');
  assert.equal(called, false);
});

test('rate and concurrency denials do not reach the database', async () => {
  let called = false;
  const baseRequest = new Request(
    'https://example.test/api/research/market-summary?area=E10&start_year=2020&end_year=2021',
  );
  const rateLimited = createMarketSummaryHandler(dependencies({
    checkRateLimit: () => ({ allowed: false, retryAfterSeconds: 10 }),
    querySummary: async () => {
      called = true;
      return [successRow];
    },
  }));
  const rateResponse = await rateLimited(baseRequest);
  assert.equal(rateResponse.status, 429);
  assert.equal(rateResponse.headers.get('retry-after'), '10');
  assert.equal((await rateResponse.json()).error.code, 'rate_limited');

  const concurrencyLimited = createMarketSummaryHandler(dependencies({
    acquireConcurrency: () => null,
    querySummary: async () => {
      called = true;
      return [successRow];
    },
  }));
  const concurrencyResponse = await concurrencyLimited(baseRequest);
  assert.equal(concurrencyResponse.status, 503);
  assert.equal((await concurrencyResponse.json()).error.code, 'capacity_exceeded');
  assert.equal(called, false);
});

test('successful responses use the configured safe cache policy and release capacity', async () => {
  let releases = 0;
  const handler = createMarketSummaryHandler(dependencies({
    acquireConcurrency: () => () => { releases += 1; },
    successCacheControl: 'public, max-age=0, must-revalidate',
    successCdnCacheControl: 'public, s-maxage=300, stale-while-revalidate=60',
  }));
  const response = await handler(new Request(
    'https://example.test/api/research/market-summary?area=E10&start_year=2020&end_year=2021',
  ));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'public, max-age=0, must-revalidate');
  assert.equal(response.headers.get('vercel-cdn-cache-control'), 'public, s-maxage=300, stale-while-revalidate=60');
  assert.equal(releases, 1);
});

test('handler bounds URL size', async () => {
  const handler = createMarketSummaryHandler(dependencies({ maxUrlLength: 80 }));
  const response = await handler(new Request(
    `https://example.test/api/research/market-summary?area=E10&start_year=2020&end_year=2021&padding=${'x'.repeat(81)}`,
  ));

  assert.equal(response.status, 413);
  assert.equal((await response.json()).error.code, 'request_too_large');
});

test('database timeout is bounded and safely redacted', async () => {
  let releases = 0;
  const handler = createMarketSummaryHandler(dependencies({
    timeoutMs: 5,
    acquireConcurrency: () => () => { releases += 1; },
    querySummary: async () => new Promise(() => {}),
  }));
  const response = await handler(new Request(
    'https://example.test/api/research/market-summary?area=E10&start_year=2020&end_year=2021',
  ));
  const body = await response.json();

  assert.equal(response.status, 504);
  assert.deepEqual(body.error, {
    code: 'dependency_timeout',
    message: 'The research data service did not respond in time.',
    trace_id: 'trace-test-123',
  });
  assert.equal(releases, 1);
});

test('database failures and malformed rows do not expose internal errors', async () => {
  for (const querySummary of [
    async () => { throw new Error('password=secret SELECT private_table'); },
    async () => [{ ...successRow, transaction_count: 'not-a-number' }],
  ]) {
    let releases = 0;
    const handler = createMarketSummaryHandler(dependencies({
      acquireConcurrency: () => () => { releases += 1; },
      querySummary,
    }));
    const response = await handler(new Request(
      'https://example.test/api/research/market-summary?area=E10&start_year=2020&end_year=2021',
    ));
    const text = await response.text();

    assert.equal(response.status, 503);
    assert.equal(text.includes('password=secret'), false);
    assert.equal(text.includes('private_table'), false);
    assert.equal(text.includes('SELECT'), false);
    assert.equal(JSON.parse(text).error.code, 'dependency_unavailable');
    assert.equal(releases, 1);
  }
});

test('query is fixed, parameterized and limited to the reduced view', () => {
  assert.match(MARKET_SUMMARY_SQL, /research\.market_summary_source/);
  assert.match(MARKET_SUMMARY_SQL, /\$1::text/);
  assert.match(MARKET_SUMMARY_SQL, /\$4::text/);
  assert.doesNotMatch(MARKET_SUMMARY_SQL, /land_registry_transactions|property_comparisons|rightmove|s3/i);
  assert.equal((MARKET_SUMMARY_SQL.match(/\bSELECT\b/gi) ?? []).length, 1);
});

test('isolated Next route reads only dedicated server credentials and passes an abort signal to Neon', async () => {
  const route = await readFile(
    new URL('../../apps/research-api/app/api/research/market-summary/route.ts', import.meta.url),
    'utf8',
  );

  assert.match(route, /process\.env\.DATABASE_READ_URL/);
  assert.match(route, /process\.env\.RESEARCH_SERVICE_TOKEN/);
  assert.match(route, /request\.headers\.get\(['"]authorization['"]\)/);
  assert.doesNotMatch(route, /process\.env\.DATABASE_URL\b/);
  assert.doesNotMatch(route, /POSTGRES_URL|UNPOOLED|DATABASE_WRITE/i);
  assert.doesNotMatch(route, /NEXT_PUBLIC_|searchParams\.get\(['"](?:token|key|authorization)['"]\)/i);
  assert.match(route, /fetchOptions:\s*\{\s*signal\s*\}/);
  assert.match(route, /RESEARCH_API_ENABLED\s*===\s*'true'/);
  assert.match(route, /maxDuration\s*=\s*5/);
});
