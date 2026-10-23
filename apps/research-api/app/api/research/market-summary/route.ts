import { neon } from '@neondatabase/serverless';
import {
  MARKET_SUMMARY_SQL,
  createMarketSummaryHandler,
  type MarketSummaryRequest,
} from '@proply/research-core/market-summary';
import {
  createConcurrencyGate,
  createRateLimiter,
  getClientKey,
} from '@proply/research-core/public-controls';
import { verifyServiceBearer } from '@proply/research-core/service-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 5;

const rateLimiter = createRateLimiter({
  burst: { limit: 5, windowMs: 10_000 },
  sustained: { limit: 30, windowMs: 60_000 },
  maxKeys: 1_000,
});
const concurrencyGate = createConcurrencyGate(4);

async function querySummary(
  databaseUrl: string,
  request: MarketSummaryRequest,
  signal: AbortSignal,
) {
  const sql = neon(databaseUrl);
  return sql.query(
    MARKET_SUMMARY_SQL,
    [request.area, request.startYear, request.endYear, request.propertyType],
    { fetchOptions: { signal } },
  );
}

const handleMarketSummary = createMarketSummaryHandler({
  isEnabled: () => process.env.RESEARCH_API_ENABLED === 'true',
  authorizeRequest: (request) => verifyServiceBearer(
    request.headers.get('authorization'),
    process.env.RESEARCH_SERVICE_TOKEN,
  ),
  getDatabaseUrl: () => process.env.DATABASE_READ_URL,
  checkRateLimit: (request) => rateLimiter.check(getClientKey(request)),
  acquireConcurrency: () => concurrencyGate.acquire(),
  querySummary,
  timeoutMs: 2_000,
  maxUrlLength: 512,
  successCacheControl: 'public, max-age=0, must-revalidate',
  successCdnCacheControl: 'public, s-maxage=300, stale-while-revalidate=60',
});

export async function GET(request: Request) {
  return handleMarketSummary(request);
}
