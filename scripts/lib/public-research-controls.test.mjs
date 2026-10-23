import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createConcurrencyGate,
  createRateLimiter,
  getClientKey,
} from '../../packages/research-core/src/public-controls.ts';

test('rate limiter enforces both burst and sustained windows', () => {
  let now = 1_000;
  const limiter = createRateLimiter({
    now: () => now,
    burst: { limit: 2, windowMs: 1_000 },
    sustained: { limit: 3, windowMs: 10_000 },
    maxKeys: 10,
  });

  assert.equal(limiter.check('client-a').allowed, true);
  assert.equal(limiter.check('client-a').allowed, true);
  const burstDenied = limiter.check('client-a');
  assert.equal(burstDenied.allowed, false);
  assert.equal(burstDenied.reason, 'burst_limit');
  assert.equal(burstDenied.retryAfterSeconds, 1);

  now = 2_001;
  assert.equal(limiter.check('client-a').allowed, true);
  const sustainedDenied = limiter.check('client-a');
  assert.equal(sustainedDenied.allowed, false);
  assert.equal(sustainedDenied.reason, 'sustained_limit');
  assert.equal(sustainedDenied.retryAfterSeconds, 9);

  now = 11_001;
  assert.equal(limiter.check('client-a').allowed, true);
});

test('rate limiter caps retained caller keys', () => {
  const limiter = createRateLimiter({
    now: () => 1_000,
    burst: { limit: 5, windowMs: 1_000 },
    sustained: { limit: 5, windowMs: 10_000 },
    maxKeys: 2,
  });

  limiter.check('client-a');
  limiter.check('client-b');
  limiter.check('client-c');

  assert.equal(limiter.retainedKeys(), 2);
});

test('concurrency gate fails closed and release is idempotent', () => {
  const gate = createConcurrencyGate(2);
  const releaseFirst = gate.acquire();
  const releaseSecond = gate.acquire();

  assert.equal(typeof releaseFirst, 'function');
  assert.equal(typeof releaseSecond, 'function');
  assert.equal(gate.acquire(), null);
  releaseFirst();
  releaseFirst();
  assert.equal(typeof gate.acquire(), 'function');
});

test('client key uses the Vercel forwarding header and bounds untrusted input', () => {
  const request = new Request('https://example.test', {
    headers: { 'x-vercel-forwarded-for': `${'1'.repeat(200)}, 192.0.2.1` },
  });

  assert.equal(getClientKey(request).length, 128);
  assert.equal(getClientKey(new Request('https://example.test')), 'unknown');
});
