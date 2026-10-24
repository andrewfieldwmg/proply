import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import {
  AskProplyPolicyError,
  createAskProplyHandler,
  parseAskProplyBody,
  syntheticResearch,
} from '../../apps/ask-proply-web/src/lib/ask-proply.ts';

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

