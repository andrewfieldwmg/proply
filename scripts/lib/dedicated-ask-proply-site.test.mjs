import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import {
  adaptControlPlaneResult,
  AskProplyPolicyError,
  createAskProplyHandler,
  parseAskProplyBody,
  syntheticResearch,
} from '../../apps/ask-proply-web/src/lib/ask-proply.ts';
import { createControlPlaneResearch } from '../../apps/ask-proply-web/src/lib/control-plane.ts';

const repositoryRoot = process.cwd();
const appRoot = path.join(repositoryRoot, 'apps', 'ask-proply-web');

async function source(relativePath) {
  return readFile(path.join(appRoot, relativePath), 'utf8');
}

test('dedicated Ask Proply app is a self-contained Vercel project root', async () => {
  const packageJson = JSON.parse(await source('package.json'));
  assert.equal(packageJson.name, '@proply/ask-proply-web');
  assert.equal(packageJson.private, true);
  const dependencies = Object.keys(packageJson.dependencies).sort();
  assert.deepEqual(dependencies, [
    '@aws-crypto/sha256-js',
    '@smithy/protocol-http',
    '@smithy/signature-v4',
    '@vercel/oidc-aws-credentials-provider',
    'next',
    'react',
    'react-dom',
  ]);
  assert.doesNotMatch(dependencies.join(','), /neon|postgres|\bpg\b|anthropic|openai/i);

  const page = await source('src/app/page.tsx');
  assert.match(page, /Ask Proply/);
  assert.match(page, /<ResearchForm/);
  assert.match(page, /ASK_PROPLY_LIVE_ENABLED === 'true'/);
  assert.match(page, /Live governed research/);
  assert.match(page, /Synthetic UI preview/);
  assert.doesNotMatch(page, /href=["']\/ask/);

  const rootTypeScript = JSON.parse(await readFile(path.join(repositoryRoot, 'tsconfig.json'), 'utf8'));
  assert.ok(rootTypeScript.exclude.includes('apps/ask-proply-web'));
});

test('dedicated BFF uses the reviewed managed-identity boundary without static credentials', async () => {
  const route = await source('src/app/api/research/route.ts');
  assert.match(route, /liveResearchFromEnvironment/);
  assert.match(route, /verifyBrowserRequest/);
  assert.match(route, /ASK_PROPLY_LIVE_ENABLED === 'true'/);
  assert.match(route, /NODE_ENV === 'development'/);
  assert.doesNotMatch(route, /NODE_ENV === 'production'.*syntheticResearch/s);
  assert.doesNotMatch(route, /fetch\s*\(/);
  assert.doesNotMatch(route, /AWS_ACCESS_KEY|AWS_SECRET|DATABASE|ANTHROPIC|SERVICE_TOKEN|PROPLY_ORIGIN/);
});

test('dedicated project documents its fail-closed release boundary', async () => {
  const readme = await source('README.md');
  const exampleEnvironment = await source('.env.example');
  assert.match(readme, /Production is fail-closed/);
  assert.match(readme, /human release gate/);
  assert.match(readme, /Vercel workload identity token/);
  assert.match(exampleEnvironment, /ASK_PROPLY_LIVE_ENABLED=false/);
  assert.match(exampleEnvironment, /AWS_REGION=eu-west-2/);
  assert.doesNotMatch(exampleEnvironment, /VERCEL_OIDC_TOKEN=/);
});

test('dedicated app owns and executes its bounded browser contract', async () => {
  const raw = JSON.stringify({ question: 'How did E10 prices change?' });
  assert.deepEqual(parseAskProplyBody(raw), { question: 'How did E10 prices change?' });
  assert.throws(
    () => parseAskProplyBody('{"question":"hello","tool":"market_summary"}'),
    AskProplyPolicyError,
  );

  const response = await createAskProplyHandler({ research: syntheticResearch })(new Request(
    'https://ask.example.test/api/research',
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: raw },
  ));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.data_mode, 'synthetic_preview');
  assert.equal(body.evidence.length, 1);
  assert.equal('trace_id' in body, false);
  assert.equal('usage' in body, false);
});

test('control-plane rejection exposes only a stable content-free rule code', () => {
  const invalid = {
    answer: 'A bounded aggregate answer.',
    citations: ['proply:market-summary:E10:2020-2025:T'],
    evidence: [{
      citation_id: 'proply:market-summary:E10:2020-2025:T',
      area: 'E10',
      property_type: 'T',
      period: { start_year: 2020, end_year: 2025 },
      transaction_count: 1,
      average_sold_price_gbp: 1,
      median_sold_price_gbp: 1,
      source: {
        name: 'Proply',
        refreshed_at: '2026-10-25T00:00:00Z',
        attribution: {
          statement: 'Contains HM Land Registry data.',
          licence_name: 'Open Government Licence v3.0',
          licence_url: 'http://unsafe.example.test',
        },
      },
      limitations: ['Aggregate research only.'],
    }],
    trace_id: 'server-only',
    abstained: false,
    usage: { model_calls: 2, tool_calls: 1 },
    data_mode: 'proply_https',
  };

  assert.throws(
    () => adaptControlPlaneResult(invalid),
    (error) => error instanceof AskProplyPolicyError
      && error.message === 'invalid_control_plane_result'
      && error.diagnosticCode === 'evidence_attribution',
  );
});

test('live adapter logs only the rejection stage and rule before failing closed', async () => {
  const logged = [];
  const originalInfo = console.info;
  console.info = (message) => logged.push(String(message));
  try {
    const research = createControlPlaneResearch({
      config: {
        url: 'https://example.execute-api.eu-west-2.amazonaws.com/v1/research',
        region: 'eu-west-2',
        roleArn: 'arn:aws:iam::123456789012:role/ask-proply-preview',
      },
      sign: async () => ({}),
      transport: async () => new Response(JSON.stringify({
        answer: 'private answer must not be logged',
        citations: ['proply:market-summary:E10:2020-2025:T'],
        evidence: [],
        abstained: false,
        data_mode: 'proply_https',
      }), { status: 200 }),
    });
    await assert.rejects(research('private question must not be logged'), /control_plane_unavailable/);
  } finally {
    console.info = originalInfo;
  }

  assert.equal(logged.length, 1);
  assert.deepEqual(JSON.parse(logged[0]), {
    event: 'ask_proply_upstream_rejected',
    stage: 'response_contract',
    validation_code: 'evidence_shape',
    content_logged: false,
  });
  assert.doesNotMatch(logged[0], /private|proply:market-summary|E10/);
});

test('dedicated app source does not import code from outside its project root', async () => {
  const files = [
    'src/app/layout.tsx',
    'src/app/page.tsx',
    'src/app/research-form.tsx',
    'src/app/api/research/route.ts',
    'src/lib/ask-proply.ts',
    'src/lib/control-plane.ts',
  ];
  for (const file of files) {
    const contents = await source(file);
    assert.doesNotMatch(contents, /from\s+["'](?:\.\.\/){3,}/, file);
  }
});

