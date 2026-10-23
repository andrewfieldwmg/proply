import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('..', import.meta.url);
const rootPath = fileURLToPath(root);
const tracked = execFileSync('git', [
  '-C', rootPath,
  'ls-files',
  '--cached',
  '--others',
  '--exclude-standard',
  '-z',
], { encoding: 'utf8' }).split('\0').filter(Boolean);

const privatePaths = new Set([
  'src/worker/rightmove.mjs',
  'src/worker/rightmove.test.mjs',
  'src/worker/property-log.mjs',
  'src/worker/property-log.test.mjs',
  'scripts/scrape-markets.mjs',
  'scripts/inspect-rightmove.mjs',
  'scripts/inspect-sold-detail.mjs',
  'scripts/inspect-active-url.mjs',
  'scripts/sanity-check-sold-ids.mjs',
  'scripts/audit-live-listings.mjs',
  'scripts/audit-propertylog-funnel.mjs',
  'scripts/backfill-floor-area.mjs',
  'scripts/backfill-floor-area-ocr.mjs',
  'scripts/update-daily.mjs',
  'scripts/run-daily-update.ps1',
  'scripts/install-daily-task.ps1',
]);

const privatePathFindings = tracked.filter((path) => privatePaths.has(path.replaceAll('\\', '/')));
assert.deepEqual(privatePathFindings, [], `private paths found: ${privatePathFindings.join(', ')}`);

const rawFixtureFindings = tracked.filter((path) => {
  const normalized = path.toLowerCase().replaceAll('\\', '/');
  return normalized.includes('/fixtures/') &&
    !normalized.includes('/acquisition/fixtures/synthetic-') &&
    /(rightmove|property[-_]?log|provider[-_]?response|raw[-_]?html|raw[-_]?json)/.test(normalized);
});
assert.deepEqual(rawFixtureFindings, [], `raw provider fixtures found: ${rawFixtureFindings.join(', ')}`);

const textExtensions = new Set([
  '.cjs', '.css', '.env', '.example', '.html', '.js', '.json', '.jsx', '.md', '.mjs',
  '.ps1', '.sql', '.ts', '.tsx', '.txt', '.yaml', '.yml',
]);
const contentRules = [
  ['stealth browser dependency', new RegExp(['puppeteer-extra', 'plugin-stealth'].join('-'), 'i')],
  ['direct history-provider endpoint', new RegExp(['api', 'propertylog', 'net'].join('\\.'), 'i')],
  ['database write environment variable', new RegExp(`(?:process\\.env\\.|^|\\n)\\s*${['DATABASE', 'WRITE', 'URL'].join('_')}\\s*(?:=|\\b)`, 'i')],
  ['generic Postgres environment variable', new RegExp(`(?:process\\.env\\.|^|\\n)\\s*${['POSTGRES', 'URL'].join('_')}\\s*(?:=|\\b)`, 'i')],
  ['Postgres password environment variable', new RegExp(`(?:process\\.env\\.|^|\\n)\\s*${['PG', 'PASSWORD'].join('')}\\s*(?:=|\\b)`, 'i')],
  ['deployment hook environment variable', new RegExp(`(?:process\\.env\\.|^|\\n)\\s*${['VERCEL', 'DEPLOY', 'HOOK', 'URL'].join('_')}\\s*(?:=|\\b)`, 'i')],
  ['browser origin/referer reproduction', /(?:['"](?:origin|referer)['"]\s*:|headers\.(?:set|append)\(\s*['"](?:origin|referer)['"])/i],
  ['private-workspace dependency', new RegExp(`(?:file|link):\\.\\.[\\\\/]|${['proply', 'internal'].join('-')}|${['rm', 'report', 'dashboard'].join('-')}[\\\\/]`, 'i')],
  ['AWS access key', /AKIA[0-9A-Z]{16}/],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['Anthropic API key', /sk-ant-[A-Za-z0-9_-]{20,}/],
  ['OpenAI project key', /sk-proj-[A-Za-z0-9_-]{20,}/],
  ['credential-bearing connection string', /(?:postgres(?:ql)?|mongodb(?:\+srv)?):\/\/[^\s/:]+:[^\s/@]+@/i],
];

const contentFindings = [];
for (const path of tracked) {
  const suffix = path.toLowerCase().slice(path.lastIndexOf('.'));
  if (!textExtensions.has(suffix)) continue;
  const content = readFileSync(new URL(path.replaceAll('\\', '/'), root), 'utf8');
  for (const [label, pattern] of contentRules) {
    if (pattern.test(content)) contentFindings.push(`${path}: ${label}`);
  }
}
assert.deepEqual(contentFindings, [], `forbidden public content found:\n${contentFindings.join('\n')}`);

const approvedRoles = new Set(['proply_research_reader', 'proply_research_api']);
const roleFindings = [];
for (const path of tracked.filter((item) => item.toLowerCase().endsWith('.sql'))) {
  const content = readFileSync(new URL(path.replaceAll('\\', '/'), root), 'utf8');
  for (const match of content.matchAll(/(?:CREATE|ALTER)\s+ROLE\s+([a-z][a-z0-9_]*)/gi)) {
    if (!approvedRoles.has(match[1].toLowerCase())) roleFindings.push(`${path}: ${match[1]}`);
  }
}
assert.deepEqual(roleFindings, [], `unapproved database roles found: ${roleFindings.join(', ')}`);

console.log(JSON.stringify({
  status: 'passed',
  filesScanned: tracked.length,
  approvedDatabaseRoles: [...approvedRoles],
  privatePathFindings: 0,
  rawFixtureFindings: 0,
  contentFindings: 0,
}));
