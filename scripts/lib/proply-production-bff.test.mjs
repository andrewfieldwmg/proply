import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CONTROL_PLANE_MAX_RESPONSE_BYTES,
  createControlPlaneResearch,
  loadControlPlaneConfig,
  verifyBrowserRequest,
} from '../../apps/ask-proply-web/src/lib/control-plane.ts';

const validEnvironment = {
  ASK_PROPLY_CONTROL_PLANE_URL: 'https://control.example.test/v1/research',
  ASK_PROPLY_PUBLIC_ORIGIN: 'https://ask.example.test',
  AWS_REGION: 'eu-west-2',
  AWS_ROLE_ARN: 'arn:aws:iam::123456789012:role/ask-proply-preview',
};

function browserRequest(overrides = {}) {
  return new Request('https://ask.example.test/api/research', {
    method: 'POST',
    headers: {
      origin: 'https://ask.example.test',
      'sec-fetch-site': 'same-origin',
      'content-type': 'application/json',
      ...overrides,
    },
    body: JSON.stringify({ question: 'How did E10 prices change?' }),
  });
}

const grounded = {
  answer: 'A bounded test answer.',
  citations: ['proply:market-summary:E10:T:2020-2025'],
  evidence: [{
    citation_id: 'proply:market-summary:E10:T:2020-2025',
    area: 'E10',
    property_type: 'T',
    period: { start_year: 2020, end_year: 2025 },
    transaction_count: 12,
    average_sold_price_gbp: 500000,
    median_sold_price_gbp: 490000,
    source: {
      name: 'Proply',
      refreshed_at: '2026-10-24T07:42:00.000Z',
      attribution: {
        statement: 'Contains HM Land Registry data.',
        licence_name: 'Open Government Licence v3.0',
        licence_url: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
      },
    },
    limitations: ['Aggregate data only.'],
  }],
  trace_id: 'server-only',
  usage: { model_calls: 2, tool_calls: 1 },
  abstained: false,
  data_mode: 'proply_https',
};

test('production configuration fixes the exact HTTPS route, region and role shape', () => {
  const config = loadControlPlaneConfig(validEnvironment);
  assert.equal(config.url, validEnvironment.ASK_PROPLY_CONTROL_PLANE_URL);
  assert.equal(config.region, 'eu-west-2');
  assert.equal(config.roleArn, validEnvironment.AWS_ROLE_ARN);

  for (const environment of [
    { ...validEnvironment, ASK_PROPLY_CONTROL_PLANE_URL: 'http://control.example.test/v1/research' },
    { ...validEnvironment, ASK_PROPLY_CONTROL_PLANE_URL: 'https://control.example.test/v1/research?tool=all' },
    { ...validEnvironment, ASK_PROPLY_CONTROL_PLANE_URL: 'https://control.example.test/admin' },
    { ...validEnvironment, AWS_REGION: 'us-east-1' },
    { ...validEnvironment, AWS_ROLE_ARN: 'not-a-role' },
  ]) assert.throws(() => loadControlPlaneConfig(environment), /invalid_control_plane_configuration/);
});

test('browser boundary requires the exact configured origin and same-origin fetch metadata', () => {
  assert.equal(verifyBrowserRequest(browserRequest(), validEnvironment), true);
  assert.equal(verifyBrowserRequest(browserRequest({ origin: 'https://evil.example' }), validEnvironment), false);
  assert.equal(verifyBrowserRequest(browserRequest({ 'sec-fetch-site': 'cross-site' }), validEnvironment), false);
  assert.equal(verifyBrowserRequest(browserRequest({ origin: '' }), validEnvironment), false);
});

test('control-plane research signs one bounded request with zero retries and minimises the response', async () => {
  let signed = 0;
  let transported = 0;
  const research = createControlPlaneResearch({
    config: loadControlPlaneConfig(validEnvironment),
    sign: async ({ url, body }) => {
      signed += 1;
      assert.equal(url, validEnvironment.ASK_PROPLY_CONTROL_PLANE_URL);
      assert.deepEqual(JSON.parse(body), { question: 'How did E10 prices change?' });
      return { authorization: 'test-signature', 'x-amz-date': '20261024T000000Z' };
    },
    transport: async (_url, init) => {
      transported += 1;
      assert.equal(init.redirect, 'error');
      assert.equal(init.headers.authorization, 'test-signature');
      return new Response(JSON.stringify(grounded), { status: 200 });
    },
  });

  const result = await research('How did E10 prices change?');
  assert.equal(signed, 1);
  assert.equal(transported, 1);
  assert.equal(result.ok, true);
  assert.equal(result.data_mode, 'proply_https');
  assert.equal('trace_id' in result, false);
  assert.equal('usage' in result, false);
});

test('upstream denials, redirects, invalid evidence and oversized bodies fail closed', async () => {
  const config = loadControlPlaneConfig(validEnvironment);
  const sign = async () => ({ authorization: 'test-signature' });
  const responses = [
    new Response('{}', { status: 403 }),
    new Response(JSON.stringify({ ...grounded, evidence: [] }), { status: 200 }),
    new Response('x'.repeat(CONTROL_PLANE_MAX_RESPONSE_BYTES + 1), { status: 200 }),
  ];

  for (const response of responses) {
    const research = createControlPlaneResearch({ config, sign, transport: async () => response });
    await assert.rejects(() => research('question'), /control_plane_unavailable/);
  }
});
