import assert from 'node:assert/strict';
import test from 'node:test';
import { activePageCount, listingNeedsDetail, listingPriceEvent } from './listing-state.mjs';

test('classifies listing price observations', () => {
  assert.equal(listingPriceEvent(null, 700000), 'listed');
  assert.equal(listingPriceEvent(700000, 675000), 'reduced');
  assert.equal(listingPriceEvent(700000, 725000), 'increased');
  assert.equal(listingPriceEvent(700000, 700000), 'observed');
});

test('refreshes details only when new, unverified, changed, or stale', () => {
  const now = new Date('2026-09-13T12:00:00Z');
  const listing = { propertyType: 'Terraced', bedrooms: 3 };
  const current = {
    property_type: 'Terraced',
    bedrooms: 3,
    tenure_verified: true,
    last_detail_checked_at: '2026-09-01T12:00:00Z',
  };
  assert.equal(listingNeedsDetail(null, listing, now), true);
  assert.equal(listingNeedsDetail(current, listing, now), false);
  assert.equal(listingNeedsDetail({ ...current, tenure_verified: false }, listing, now), true);
  assert.equal(listingNeedsDetail({ ...current, bedrooms: 2 }, listing, now), true);
  assert.equal(
    listingNeedsDetail({ ...current, last_detail_checked_at: '2026-07-01T12:00:00Z' }, listing, now),
    true,
  );
});

test('computes complete result-page coverage with safety caps', () => {
  assert.equal(activePageCount(150), 7);
  assert.equal(activePageCount(500), 20);
  assert.equal(activePageCount(150, 24, 20, 3), 3);
});
