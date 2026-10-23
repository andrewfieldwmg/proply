import assert from 'node:assert/strict';
import test from 'node:test';
import {
  incrementalPageReachedWatermark,
  nextAttemptDate,
  retryDelayDays,
} from './enrichment-queue.mjs';

test('stops incremental discovery only after a wholly known non-empty page', () => {
  assert.equal(incrementalPageReachedWatermark(25, 25), true);
  assert.equal(incrementalPageReachedWatermark(25, 24), false);
  assert.equal(incrementalPageReachedWatermark(0, 0), false);
});

test('uses bounded exponential retry delays', () => {
  assert.equal(retryDelayDays(1), 1);
  assert.equal(retryDelayDays(2), 2);
  assert.equal(retryDelayDays(7), 30);
  assert.equal(nextAttemptDate(2, new Date('2026-09-13T00:00:00Z')).toISOString(),
    '2026-09-15T00:00:00.000Z');
});
