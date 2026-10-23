import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { compareWithOriginalAsk, SyntheticPropertyProvider } from './providers.ts';

const fixture = JSON.parse(await readFile(
  new URL('./fixtures/synthetic-property-records.json', import.meta.url),
  'utf8',
));

test('matches candidates only on the complete provider-neutral identity tuple', async () => {
  const provider = new SyntheticPropertyProvider(fixture);
  const matches = await provider.findCandidates({
    address: '12 example avenue',
    postcode: 'E10-0AA',
    completedAt: '2026-02-20',
    soldPrice: 495000,
    propertyType: 'T',
  });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].reference.reference, 'SYN-SOLD-001');

  const wrongPrice = await provider.findCandidates({
    address: '12 Example Avenue',
    postcode: 'E10 0AA',
    completedAt: '2026-02-20',
    soldPrice: 495001,
  });
  assert.deepEqual(wrongPrice, []);
});

test('sorts history chronologically and enforces the sale-date cut-off', async () => {
  const provider = new SyntheticPropertyProvider(fixture);
  const history = await provider.getPriceHistory('SYN-SOLD-001', '2026-02-20');
  assert.deepEqual(history.map((event) => event.provenance.reference), [
    'SYN-EVENT-001',
    'SYN-EVENT-002',
  ]);
});

test('retains provenance when a comparison is verified', async () => {
  const provider = new SyntheticPropertyProvider(fixture);
  const history = await provider.getPriceHistory('SYN-SOLD-001', '2026-02-20');
  const comparison = compareWithOriginalAsk(495000, history);
  assert.equal(comparison.status, 'verified');
  assert.equal(comparison.originalAskingPrice, 450000);
  assert.equal(comparison.differencePercent, 10);
  assert.equal(comparison.provenance?.reference, 'SYN-EVENT-001');
});

test('quarantines an implausible margin instead of presenting it as verified', async () => {
  const provider = new SyntheticPropertyProvider(fixture);
  const history = await provider.getPriceHistory('SYN-SOLD-ANOMALY', '2026-05-01');
  const comparison = compareWithOriginalAsk(800000, history);
  assert.equal(comparison.status, 'quarantined');
  assert.ok((comparison.differencePercent ?? 0) > 100);
});
