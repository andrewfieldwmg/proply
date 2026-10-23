import assert from 'node:assert/strict';
import test from 'node:test';
import { askingPriceVerification } from './comparison.mjs';

test('verifies ordinary margins and quarantines extreme PropertyLog comparisons', () => {
  assert.deepEqual(askingPriceVerification(700_000, 665_000), {
    verified: true,
    source: 'propertylog-earliest',
    marginPercent: -5,
  });
  const anomaly = askingPriceVerification(425_000, 191_714);
  assert.equal(anomaly.verified, false);
  assert.equal(anomaly.source, 'propertylog-outlier-review');
  assert.ok(anomaly.marginPercent < -50);
});
