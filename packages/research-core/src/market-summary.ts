export type MarketArea = 'ALL' | 'E10' | 'E11' | 'E17';
export type PropertyType = 'ALL' | 'D' | 'S' | 'T' | 'F';

export type MarketSummaryRequest = {
  area: MarketArea;
  startYear: number;
  endYear: number;
  propertyType: PropertyType;
};

type MarketSummaryRow = Record<string, unknown>;

export type QuerySummary = (
  databaseUrl: string,
  request: MarketSummaryRequest,
  signal: AbortSignal,
) => Promise<MarketSummaryRow[]>;

export type MarketSummaryHandlerDependencies = {
  getDatabaseUrl: () => string | undefined;
  querySummary: QuerySummary;
  isEnabled?: () => boolean;
  checkRateLimit?: (request: Request) =>
    | { allowed: true }
    | { allowed: false; retryAfterSeconds: number };
  acquireConcurrency?: () => (() => void) | null;
  currentYear?: () => number;
  createTraceId?: () => string;
  timeoutMs?: number;
  maxUrlLength?: number;
  successCacheControl?: string;
  successCdnCacheControl?: string;
};

const MINIMUM_YEAR = 1995;
const MAXIMUM_YEARS = 10;
const ALLOWED_FIELDS = new Set(['area', 'start_year', 'end_year', 'property_type']);
const ALLOWED_AREAS = new Set<MarketArea>(['ALL', 'E10', 'E11', 'E17']);
const ALLOWED_PROPERTY_TYPES = new Set<PropertyType>(['ALL', 'D', 'S', 'T', 'F']);

const ATTRIBUTION = {
  statement: 'Contains HM Land Registry data © Crown copyright and database right 2021.',
  licence_name: 'Open Government Licence v3.0',
  licence_url: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
} as const;

const LIMITATIONS = [
  'Price Paid Data records completed residential transactions and is not a live valuation or asking-price feed.',
  'Figures cover the selected E10, E11 and E17 scope and may change when source data is corrected or refreshed.',
  'Aggregates exclude address-level fields and do not describe an individual property.',
] as const;

export const MARKET_SUMMARY_SQL = `
  SELECT
    count(*)::text AS transaction_count,
    CASE WHEN count(*) = 0 THEN NULL ELSE round(avg(sold_price))::text END AS average_sold_price,
    CASE WHEN count(*) = 0 THEN NULL ELSE round(percentile_cont(0.5) WITHIN GROUP (ORDER BY sold_price))::text END AS median_sold_price,
    max(data_refreshed_at) AS data_refreshed_at
  FROM research.market_summary_source
  WHERE ($1::text = 'ALL' OR area = $1::text)
    AND sale_year BETWEEN $2::integer AND $3::integer
    AND ($4::text = 'ALL' OR property_type = $4::text)
`;

export class PolicyError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.name = 'PolicyError';
    this.reason = reason;
  }
}

class DependencyTimeoutError extends Error {
  constructor() {
    super('dependency_timeout');
    this.name = 'DependencyTimeoutError';
  }
}

function parseYear(value: string | null, currentYear: number): number {
  if (value == null || !/^[0-9]{4}$/.test(value)) throw new PolicyError('invalid_year');
  const year = Number(value);
  if (year < MINIMUM_YEAR || year > currentYear) throw new PolicyError('year_out_of_range');
  return year;
}

export function parseMarketSummaryParams(
  params: URLSearchParams,
  currentYear: number,
): MarketSummaryRequest {
  for (const key of new Set(params.keys())) {
    if (!ALLOWED_FIELDS.has(key)) throw new PolicyError('unknown_field');
    if (params.getAll(key).length !== 1) throw new PolicyError('duplicate_field');
  }

  for (const required of ['area', 'start_year', 'end_year']) {
    if (!params.has(required)) throw new PolicyError('missing_field');
  }

  const area = params.get('area');
  const propertyType = params.get('property_type') ?? 'ALL';
  if (!ALLOWED_AREAS.has(area as MarketArea)) throw new PolicyError('invalid_area');
  if (!ALLOWED_PROPERTY_TYPES.has(propertyType as PropertyType)) {
    throw new PolicyError('invalid_property_type');
  }

  const startYear = parseYear(params.get('start_year'), currentYear);
  const endYear = parseYear(params.get('end_year'), currentYear);
  if (startYear > endYear) throw new PolicyError('invalid_year_range');
  if (endYear - startYear + 1 > MAXIMUM_YEARS) throw new PolicyError('year_range_too_wide');

  return {
    area: area as MarketArea,
    startYear,
    endYear,
    propertyType: propertyType as PropertyType,
  };
}

function parseInteger(value: unknown, field: string): number {
  if (typeof value !== 'string' && typeof value !== 'number') throw new Error(`invalid_${field}`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`invalid_${field}`);
  return parsed;
}

function parseNullableInteger(value: unknown, field: string): number | null {
  return value == null ? null : parseInteger(value, field);
}

function parseTimestamp(value: unknown): string | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error('invalid_data_refreshed_at');
  return date.toISOString();
}

function parseRow(rows: MarketSummaryRow[]) {
  if (!Array.isArray(rows) || rows.length !== 1 || rows[0] == null || typeof rows[0] !== 'object') {
    throw new Error('invalid_result_shape');
  }
  const row = rows[0];
  const transactionCount = parseInteger(row.transaction_count, 'transaction_count');
  const averageSoldPrice = parseNullableInteger(row.average_sold_price, 'average_sold_price');
  const medianSoldPrice = parseNullableInteger(row.median_sold_price, 'median_sold_price');
  if (transactionCount > 0 && (averageSoldPrice == null || medianSoldPrice == null)) {
    throw new Error('invalid_aggregate_values');
  }
  return {
    transaction_count: transactionCount,
    average_sold_price_gbp: averageSoldPrice,
    median_sold_price_gbp: medianSoldPrice,
    data_refreshed_at: parseTimestamp(row.data_refreshed_at),
  };
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  traceId: string,
  extraHeaders: Record<string, string> = {},
): Response {
  return Response.json(
    { ok: false, error: { code, message, trace_id: traceId } },
    {
      status,
      headers: { 'cache-control': 'no-store', 'x-trace-id': traceId, ...extraHeaders },
    },
  );
}

export function createMarketSummaryHandler(dependencies: MarketSummaryHandlerDependencies) {
  const currentYear = dependencies.currentYear ?? (() => new Date().getUTCFullYear());
  const createTraceId = dependencies.createTraceId ?? (() => crypto.randomUUID());
  const timeoutMs = dependencies.timeoutMs ?? 2_000;
  const maxUrlLength = dependencies.maxUrlLength ?? 512;
  const isEnabled = dependencies.isEnabled ?? (() => true);
  const successCacheControl = dependencies.successCacheControl ?? 'no-store';
  if (timeoutMs < 1 || maxUrlLength < 1) throw new Error('invalid_handler_limits');

  return async function handleMarketSummary(request: Request): Promise<Response> {
    const traceId = createTraceId();
    if (!isEnabled()) {
      return errorResponse(404, 'route_disabled', 'The research route is not available.', traceId);
    }

    let url: URL;
    try {
      url = new URL(request.url);
    } catch {
      return errorResponse(400, 'invalid_request', 'The request is invalid.', traceId);
    }

    if (url.search.length > maxUrlLength) {
      return errorResponse(413, 'request_too_large', 'The request is too large.', traceId);
    }

    const rateLimit = dependencies.checkRateLimit?.(request) ?? { allowed: true };
    if (!rateLimit.allowed) {
      return errorResponse(
        429,
        'rate_limited',
        'Too many requests. Try again later.',
        traceId,
        { 'retry-after': String(rateLimit.retryAfterSeconds) },
      );
    }

    let marketRequest: MarketSummaryRequest;
    try {
      marketRequest = parseMarketSummaryParams(url.searchParams, currentYear());
    } catch {
      return errorResponse(400, 'invalid_request', 'The request parameters are invalid.', traceId);
    }

    const databaseUrl = dependencies.getDatabaseUrl();
    if (!databaseUrl || databaseUrl.trim() === '') {
      return errorResponse(503, 'dependency_unavailable', 'The research data service is unavailable.', traceId);
    }

    const releaseConcurrency = dependencies.acquireConcurrency
      ? dependencies.acquireConcurrency()
      : () => {};
    if (releaseConcurrency == null) {
      return errorResponse(503, 'capacity_exceeded', 'The research service is busy. Try again later.', traceId);
    }

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new DependencyTimeoutError());
        }, timeoutMs);
      });
      const rows = await Promise.race([
        dependencies.querySummary(databaseUrl, marketRequest, controller.signal),
        timeout,
      ]);
      const aggregate = parseRow(rows);
      const successHeaders: Record<string, string> = {
        'cache-control': successCacheControl,
        'x-trace-id': traceId,
      };
      if (dependencies.successCdnCacheControl) {
        successHeaders['vercel-cdn-cache-control'] = dependencies.successCdnCacheControl;
      }
      return Response.json(
        {
          ok: true,
          trace_id: traceId,
          data: {
            capability: 'market_summary',
            area: marketRequest.area,
            period: { start_year: marketRequest.startYear, end_year: marketRequest.endYear },
            property_type: marketRequest.propertyType,
            ...aggregate,
            attribution: ATTRIBUTION,
            limitations: LIMITATIONS,
          },
        },
        { headers: successHeaders },
      );
    } catch (error) {
      if (error instanceof DependencyTimeoutError) {
        return errorResponse(504, 'dependency_timeout', 'The research data service did not respond in time.', traceId);
      }
      return errorResponse(503, 'dependency_unavailable', 'The research data service is unavailable.', traceId);
    } finally {
      if (timer) clearTimeout(timer);
      releaseConcurrency();
    }
  };
}
