import assert from 'node:assert/strict';
import { test } from 'node:test';

import { verifyServiceBearer } from '../../packages/research-core/src/service-auth.ts';

const TOKEN = 'test-service-token-0123456789abcdef';

test('service bearer authentication accepts only one exact well-formed credential', () => {
  assert.equal(verifyServiceBearer(`Bearer ${TOKEN}`, TOKEN), true);

  for (const authorization of [
    null,
    '',
    TOKEN,
    `Basic ${TOKEN}`,
    `bearer ${TOKEN}`,
    `Bearer  ${TOKEN}`,
    `Bearer ${TOKEN} `,
    `Bearer ${TOKEN}, Bearer ${TOKEN}`,
    'Bearer wrong-service-token-0123456789abcdef',
  ]) {
    assert.equal(verifyServiceBearer(authorization, TOKEN), false);
  }
});

test('service bearer authentication fails closed for absent or unsafe configuration', () => {
  for (const configuredToken of [
    undefined,
    '',
    'short-token',
    'contains whitespace 0123456789abcdef',
    'contains\nnewline0123456789abcdef',
  ]) {
    assert.equal(verifyServiceBearer(`Bearer ${TOKEN}`, configuredToken), false);
  }
});
