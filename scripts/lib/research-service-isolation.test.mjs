import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { test } from 'node:test';

const root = new URL('../../', import.meta.url);

async function text(path) {
  return readFile(new URL(path, root), 'utf8');
}

test('research API is packaged as a separate monorepo application', async () => {
  const rootPackage = JSON.parse(await text('package.json'));
  const servicePackage = JSON.parse(await text('apps/research-api/package.json'));
  const corePackage = JSON.parse(await text('packages/research-core/package.json'));

  assert.deepEqual(rootPackage.workspaces, ['apps/*', 'packages/*']);
  assert.equal(servicePackage.name, '@proply/research-api');
  assert.equal(servicePackage.dependencies['@proply/research-core'], '*');
  assert.equal(corePackage.name, '@proply/research-core');
  assert.equal(corePackage.private, true);
  assert.deepEqual(Object.keys(servicePackage.dependencies).sort(), [
    '@neondatabase/serverless',
    '@proply/research-core',
    'next',
    'react',
    'react-dom',
  ]);
});

test('isolated route has only its dedicated credentials and no Proply application imports', async () => {
  const route = await text('apps/research-api/app/api/research/market-summary/route.ts');
  const applicationFiles = await Promise.all([
    text('apps/research-api/app/api/research/market-summary/route.ts'),
    text('apps/research-api/app/page.tsx'),
    text('apps/research-api/next.config.ts'),
  ]);

  assert.match(route, /process\.env\.DATABASE_READ_URL/);
  assert.match(route, /process\.env\.RESEARCH_SERVICE_TOKEN/);
  assert.match(route, /process\.env\.RESEARCH_API_ENABLED\s*===\s*'true'/);
  assert.match(route, /@proply\/research-core/);
  assert.doesNotMatch(route, /process\.env\.DATABASE_URL\b|POSTGRES_URL|UNPOOLED|DATABASE_WRITE/i);
  assert.doesNotMatch(
    applicationFiles.join('\n'),
    /from\s+['"][^'"]*(?:dashboard|listings|rightmove|scrape|puppeteer)[^'"]*['"]/i,
  );
  await assert.rejects(access(new URL('src/app/api/research/market-summary/route.ts', root)));
});

test('deployment note fixes the isolated Vercel root and disabled-first configuration', async () => {
  const deployment = await text('docs/research-service-deployment.md');

  for (const required of [
    'apps/research-api',
    'separate Vercel project',
    'DATABASE_READ_URL',
    'RESEARCH_SERVICE_TOKEN',
    'RESEARCH_API_ENABLED=false',
    'Include source files outside of the Root Directory',
    'WAF',
    'spend',
    'production alias',
  ]) {
    assert.match(deployment, new RegExp(required, 'i'));
  }
});

test('research API documentation separates published source from runtime deployment', async () => {
  const documentation = await text('docs/research-api.md');

  assert.match(
    documentation,
    /introduced by public commit\s+`670d9f040e734a0c13875385d98f429e476cf432`/,
  );
  assert.match(documentation, /has not been configured or\s+deployed/);
  assert.doesNotMatch(documentation, /remains local and uncommitted/);
});

test('tracked environment examples declare the server-only service credential without a value', async () => {
  for (const path of ['.env.example', 'apps/research-api/.env.example']) {
    const example = await text(path);
    assert.match(example, /^RESEARCH_SERVICE_TOKEN=$/m);
    assert.doesNotMatch(example, /^RESEARCH_SERVICE_TOKEN=.+$/m);
    assert.doesNotMatch(example, /NEXT_PUBLIC_RESEARCH_SERVICE_TOKEN/);
    assert.match(example, /^RESEARCH_API_ENABLED=false$/m);
  }
});
