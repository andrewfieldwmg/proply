import 'server-only';
import { neon } from '@neondatabase/serverless';

export type MarketArea = 'ALL' | 'E10' | 'E11' | 'E17';
export type SoldSort = 'address' | 'soldPrice' | 'pricePerSqm' | 'floorArea' | 'gardenArea' | 'soldDate' | 'bedrooms' | 'listingPrice' | 'margin';
export type SortDirection = 'asc' | 'desc';

export type PropertyLogFunnel = {
  rightmoveLinked: number;
  trustedPropertyIds: number;
  attempted: number;
  matched: number;
  noUsableHistory: number;
  failed: number;
};

export type PropertyLogReview = {
  candidateId: string;
  rightmovePropertyId: string;
  address: string;
  soldDate: string;
  soldPrice: number;
  soldOverviewUrl: string;
  fetchedAt: string;
};

export type RightmoveIdentityReview = {
  candidateId: string;
  rightmovePropertyId: string | null;
  address: string;
  soldDate: string;
  soldPrice: number;
  soldOverviewUrl: string;
  reason: string;
};

export type DashboardSummary = {
  totalSales: number;
  matchedSales: number;
  averageSoldPrice: number | null;
  changeOneYear: number | null;
  changeTwoYears: number | null;
  changeFiveYears: number | null;
  medianSoldPrice: number | null;
  medianDifferencePercent: number | null;
  latestSaleDate: string | null;
};

export type AreaMetric = {
  area: string;
  sales: number;
  matchedSales: number;
  medianSoldPrice: number | null;
  medianDifferencePercent: number | null;
};

export type SoldTransaction = {
  id: string;
  address: string;
  postcode: string | null;
  area: string;
  propertyType: string;
  bedrooms: number | null;
  bedroomsEstimated: boolean;
  bedroomEstimateLow: number | null;
  bedroomEstimateHigh: number | null;
  bedroomConfidence: number | null;
  listingPrice: number | null;
  soldPrice: number;
  soldDate: string;
  differencePercent: number | null;
  comparisonStatus: 'matched' | 'needs_review' | 'no_valid_history' | 'identity_issue' | 'no_listing' | 'no_rightmove';
  soldOverviewUrl: string | null;
  rightmovePropertyId: string | null;
  thumbnailUrl: string | null;
  landRegistryUrl: string | null;
  categoryType: string;
  sourceReview: 'classification_conflict' | 'price_outlier' | 'awaiting_rightmove' | null;
  floorAreaSqm: number | null;
  floorAreaSource: string | null;
  pricePerSqm: number | null;
  gardenAreaSqm: number | null;
  gardenAreaStatus: string | null;
  gardenAreaSource: string | null;
  gardenContextMedianSqm: number | null;
  gardenContextP25Sqm: number | null;
  gardenContextP75Sqm: number | null;
  gardenContextCount: number | null;
};

export type TrendPoint = {
  area: string;
  month: string;
  sales: number;
  terracedSales: number;
  matchedSales: number;
  medianSoldPrice: number | null;
  terracedMedianSoldPrice: number | null;
  medianDifferencePercent: number | null;
  averageTenureYears: number | null;
  medianDaysToSstc: number | null;
  sstcListings: number;
};

export type PostcodeTenureMetric = {
  area: string;
  repeatSales: number;
  averageTenureYears: number | null;
};

export type RepeatSale = {
  id: string;
  address: string;
  postcode: string | null;
  propertyType: string;
  currentSoldDate: string;
  currentSoldPrice: number;
  previousSoldDate: string;
  previousSoldPrice: number;
  tenureYears: number;
  priceChangePercent: number | null;
  soldOverviewUrl: string | null;
};

export type SoldMapPoint = {
  id: string;
  address: string;
  postcode: string | null;
  latitude: number;
  longitude: number;
  soldPrice: number;
  listingPrice: number | null;
  differencePercent: number | null;
  soldDate: string;
  bedrooms: number | null;
  bedroomsEstimated: boolean;
  bedroomEstimateLow: number | null;
  bedroomEstimateHigh: number | null;
  soldOverviewUrl: string | null;
  thumbnailUrl: string | null;
  floorAreaSqm: number | null;
  floorAreaSource: string | null;
  pricePerSqm: number | null;
  gardenAreaSqm: number | null;
  gardenAreaStatus: string | null;
  gardenAreaSource: string | null;
  gardenContextMedianSqm: number | null;
  gardenContextP25Sqm: number | null;
  gardenContextP75Sqm: number | null;
  gardenContextCount: number | null;
};

export type DashboardData = {
  connected: boolean;
  lastUpdated: string | null;
  summary: DashboardSummary;
  areas: AreaMetric[];
  transactions: SoldTransaction[];
  transactionCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
  postcodeQuery: string;
  addressQuery: string;
  trends: TrendPoint[];
  postcodeTenure: PostcodeTenureMetric[];
  repeatSales: RepeatSale[];
  mapPoints: SoldMapPoint[];
  sort: SoldSort;
  direction: SortDirection;
  selectedStartYear: number;
  selectedEndYear: number;
  trendStartYear: number;
  trendEndYear: number;
  propertyLogFunnel: PropertyLogFunnel;
  propertyLogReview: PropertyLogReview[];
  identityReview: RightmoveIdentityReview[];
};

const pageSize = 50;
const emptyData: DashboardData = {
  connected: false,
  lastUpdated: null,
  summary: {
    totalSales: 0,
    matchedSales: 0,
    averageSoldPrice: null,
    changeOneYear: null,
    changeTwoYears: null,
    changeFiveYears: null,
    medianSoldPrice: null,
    medianDifferencePercent: null,
    latestSaleDate: null,
  },
  areas: [],
  transactions: [],
  transactionCount: 0,
  page: 1,
  pageSize,
  pageCount: 0,
  postcodeQuery: '',
  addressQuery: '',
  trends: [],
  postcodeTenure: [],
  repeatSales: [],
  mapPoints: [],
  sort: 'soldDate',
  direction: 'desc',
  selectedStartYear: new Date().getUTCFullYear(),
  selectedEndYear: new Date().getUTCFullYear(),
  trendStartYear: new Date().getUTCFullYear() - 3,
  trendEndYear: new Date().getUTCFullYear(),
  propertyLogFunnel: {
    rightmoveLinked: 0,
    trustedPropertyIds: 0,
    attempted: 0,
    matched: 0,
    noUsableHistory: 0,
    failed: 0,
  },
  propertyLogReview: [],
  identityReview: [],
};

function number(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function percentageChange(current: unknown, previous: unknown): number | null {
  const currentNumber = number(current);
  const previousNumber = number(previous);
  if (currentNumber == null || previousNumber == null || previousNumber === 0) return null;
  return ((currentNumber - previousNumber) / previousNumber) * 100;
}

function imageUrl(value: unknown): string | null {
  if (!value) return null;
  const url = String(value);
  if (url.startsWith('//')) return `https:${url}`;
  return /^https?:\/\//i.test(url) ? url : null;
}

function normalizedPostcode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
}

function normalizedAddress(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80);
}

function completeTrendSeries(
  rows: Record<string, unknown>[],
  sstcRows: Record<string, unknown>[],
  startYear: number,
  endYear: number,
  selectedArea: MarketArea,
): TrendPoint[] {
  const byMonth = new Map(rows.map((row) => [
    `${String(row.area)}:${new Date(String(row.month)).toISOString().slice(0, 7)}`,
    row,
  ]));
  const sstcByMonth = new Map(sstcRows.map((row) => [
    `${String(row.area)}:${new Date(String(row.month)).toISOString().slice(0, 7)}`,
    row,
  ]));
  const now = new Date();
  const start = new Date(Date.UTC(startYear, 0, 1));
  const end = endYear === now.getUTCFullYear()
    ? new Date(Date.UTC(endYear, now.getUTCMonth(), 1))
    : new Date(Date.UTC(endYear, 11, 1));
  const areas = selectedArea === 'ALL' ? ['E10', 'E11', 'E17'] : [selectedArea];
  const output: TrendPoint[] = [];
  for (const area of areas) {
    const cursor = new Date(start);
    while (cursor <= end) {
      const key = cursor.toISOString().slice(0, 7);
      const row = byMonth.get(`${area}:${key}`);
      const sstcRow = sstcByMonth.get(`${area}:${key}`);
      output.push({
        area,
        month: `${key}-01`,
        sales: number(row?.sales) ?? 0,
        terracedSales: number(row?.terraced_sales) ?? 0,
        matchedSales: number(row?.matched_sales) ?? 0,
        medianSoldPrice: number(row?.median_sold_price),
        terracedMedianSoldPrice: number(row?.terraced_median_sold_price),
        medianDifferencePercent: number(row?.median_difference_percent),
        averageTenureYears: number(row?.average_tenure_years),
        medianDaysToSstc: number(sstcRow?.median_days_to_sstc),
        sstcListings: number(sstcRow?.sstc_listings) ?? 0,
      });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }
  return output;
}

const registryScope = `
  split_part(upper(lr.postcode), ' ', 1) IN ('E10', 'E11', 'E17')
  AND lr.tenure = 'F'
  AND lr.category_type = 'A'
  AND lr.property_type IN ('D', 'S', 'T', 'F')
  AND ($1 = 'ALL' OR split_part(upper(lr.postcode), ' ', 1) = $1)
  AND ($2 = '' OR replace(upper(lr.postcode), ' ', '') LIKE $2 || '%')
  AND ($3 = '' OR regexp_replace(
    lower(concat_ws(' ', lr.saon, lr.paon, lr.street, lr.locality, lr.town_city)),
    '[^a-z0-9]', '', 'g'
  ) LIKE '%' || $3 || '%')
`;

const comparisonJoin = `
  LEFT JOIN LATERAL (
    SELECT pc.*
    FROM property_comparisons pc
    WHERE pc.land_registry_transaction_id = lr.transaction_id
    ORDER BY pc.listing_price_verified DESC,
             (pc.sold_listing_url IS NOT NULL) DESC,
             pc.id DESC
    LIMIT 1
  ) pc ON true
`;

const gardenContextJoin = `
  LEFT JOIN LATERAL (
    SELECT context.*
    FROM garden_street_context context
    WHERE context.normalized_street = regexp_replace(lower(lr.street), '[^a-z0-9]', '', 'g')
      AND NOT EXISTS (
        SELECT 1 FROM garden_street_context duplicate
        WHERE duplicate.normalized_street = context.normalized_street
          AND duplicate.id <> context.id
      )
    LIMIT 1
  ) garden_context ON true
`;

const notPriceOutlier = 'lr.market_price_outlier = false';
const maxCrediblePricePerSqm = 10_000;
const soldFloorAreaExpression = `COALESCE(
  candidate.floor_area_sqm,
  pc.floor_area_sqm,
  CASE WHEN enrichment.floor_area_status = 'verified' THEN enrichment.floor_area_sqm END
)`;
const selectedRangeScope = `
  lr.transfer_date >= make_date($4::int, 1, 1)
  AND lr.transfer_date < make_date($5::int + 1, 1, 1)
`;

export async function getDashboardData(
  area: MarketArea = 'ALL',
  postcode = '',
  address = '',
  requestedPage = 1,
  includeTrends = false,
  requestedSort: SoldSort = 'soldDate',
  requestedDirection: SortDirection = 'desc',
  includeMap = false,
  selectedStartYear = new Date().getUTCFullYear(),
  selectedEndYear = new Date().getUTCFullYear(),
  includeLog = false,
  trendStartYear = new Date().getUTCFullYear() - 3,
  trendEndYear = new Date().getUTCFullYear(),
): Promise<DashboardData> {
  const databaseUrl = process.env.DATABASE_READ_URL;
  if (!databaseUrl) return emptyData;

  const postcodeQuery = normalizedPostcode(postcode);
  const addressQuery = address.trim().slice(0, 80);
  const addressMatchQuery = normalizedAddress(addressQuery);
  const page = Math.max(1, Math.floor(requestedPage) || 1);
  const sortExpressions: Record<SoldSort, string> = {
    address: "regexp_replace(lower(concat_ws(' ', lr.saon, lr.paon, lr.street)), '[^a-z0-9]', '', 'g')",
    soldPrice: 'lr.price',
    pricePerSqm: `CASE
      WHEN lr.price / NULLIF(${soldFloorAreaExpression}, 0) <= ${maxCrediblePricePerSqm}
        THEN lr.price / NULLIF(${soldFloorAreaExpression}, 0)
      ELSE NULL
    END`,
    floorArea: soldFloorAreaExpression,
    gardenArea: "CASE WHEN enrichment.garden_area_status = 'verified' THEN enrichment.garden_area_sqm END",
    soldDate: 'lr.transfer_date',
    bedrooms: 'COALESCE(candidate.bedrooms, pc.bedrooms, enrichment.bedroom_estimate_likely)',
    listingPrice: 'pc.listing_price',
    margin: 'pc.price_difference_percent',
  };
  const sort = Object.hasOwn(sortExpressions, requestedSort) ? requestedSort : 'soldDate';
  const direction: SortDirection = requestedDirection === 'asc' ? 'asc' : 'desc';
  const orderBy = `${sortExpressions[sort]} ${direction.toUpperCase()} NULLS LAST,
                   lr.transfer_date DESC, lr.transaction_id DESC`;
  const sql = neon(databaseUrl);
  const params = [area, postcodeQuery, addressMatchQuery, selectedStartYear, selectedEndYear];
  const trendParams = [area, postcodeQuery, addressMatchQuery, trendStartYear, trendEndYear];
  const [summaryRows, areaRows, transactionRows, trendRows, sstcTrendRows, tenureRows, repeatRows, funnelRows, reviewRows, identityRows, mapRows] = await Promise.all([
    sql.query(`
      SELECT count(*) FILTER (WHERE ${selectedRangeScope}) AS transaction_count,
             count(*) FILTER (WHERE ${notPriceOutlier} AND ${selectedRangeScope}) AS total_sales,
             count(*) FILTER (WHERE pc.listing_price_verified = true AND ${notPriceOutlier}
               AND ${selectedRangeScope}) AS matched_sales,
             avg(lr.price) FILTER (WHERE ${notPriceOutlier} AND ${selectedRangeScope}) AS average_sold_price,
             avg(lr.price) FILTER (WHERE ${notPriceOutlier}
               AND lr.transfer_date >= period.current_start
               AND lr.transfer_date < period.current_end) AS recent_average,
             avg(lr.price) FILTER (WHERE ${notPriceOutlier}
               AND lr.transfer_date >= period.current_start - interval '1 year'
               AND lr.transfer_date < period.current_end - interval '1 year') AS one_year_average,
             avg(lr.price) FILTER (WHERE ${notPriceOutlier}
               AND lr.transfer_date >= period.current_start - interval '2 years'
               AND lr.transfer_date < period.current_end - interval '2 years') AS two_year_average,
             avg(lr.price) FILTER (WHERE ${notPriceOutlier}
               AND lr.transfer_date >= period.current_start - interval '5 years'
               AND lr.transfer_date < period.current_end - interval '5 years') AS five_year_average,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY lr.price)
               FILTER (WHERE ${notPriceOutlier} AND ${selectedRangeScope}) AS median_sold_price,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY pc.price_difference_percent)
               FILTER (WHERE pc.listing_price_verified = true AND ${notPriceOutlier}
                 AND ${selectedRangeScope}) AS median_difference_percent,
             max(lr.transfer_date) FILTER (WHERE ${notPriceOutlier} AND ${selectedRangeScope}) AS latest_sale_date,
             greatest(
               max(lr.imported_at),
               COALESCE((
                 SELECT max(run.completed_at)
                 FROM ingestion_runs run
                 WHERE run.kind = 'market_scrape' AND run.status = 'completed'
               ), max(lr.imported_at))
             ) AS last_updated
      FROM land_registry_transactions lr
      ${comparisonJoin}
      CROSS JOIN LATERAL (
        SELECT make_date($4::int, 1, 1)::timestamp AS current_start,
               LEAST(make_date($5::int + 1, 1, 1), current_date + 1)::timestamp AS current_end
      ) period
      WHERE ${registryScope}
    `, params),
    includeLog ? sql.query(`
      SELECT split_part(upper(lr.postcode), ' ', 1) AS area,
             count(*) AS sales,
             count(*) FILTER (WHERE pc.listing_price_verified = true) AS matched_sales,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY lr.price) AS median_sold_price,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY pc.price_difference_percent)
               FILTER (WHERE pc.listing_price_verified = true) AS median_difference_percent
      FROM land_registry_transactions lr
      ${comparisonJoin}
      WHERE ${registryScope}
        AND ${selectedRangeScope}
        AND ${notPriceOutlier}
      GROUP BY 1
      ORDER BY 1
    `, params) : Promise.resolve([]),
    sql.query(`
      SELECT lr.transaction_id, lr.price, lr.transfer_date, lr.postcode, lr.property_type,
             lr.category_type, lr.tenure,
             lr.market_price_outlier, lr.market_peer_median, lr.address_classification_conflict,
             lr.saon, lr.paon, lr.street, lr.locality, lr.town_city, lr.linked_data_uri,
             pc.id AS comparison_id, pc.listing_price, pc.price_difference_percent,
             COALESCE(
               candidate.floor_area_sqm,
               pc.floor_area_sqm,
               CASE WHEN enrichment.floor_area_status = 'verified' THEN enrichment.floor_area_sqm END
             ) AS floor_area_sqm,
             CASE
               WHEN candidate.floor_area_sqm IS NOT NULL THEN candidate.floor_area_source
               WHEN pc.floor_area_sqm IS NOT NULL THEN pc.floor_area_source
               WHEN enrichment.floor_area_status = 'verified' THEN enrichment.floor_area_source
               ELSE NULL
             END AS floor_area_source,
             pc.listing_price_verified, pc.listing_price_source, pc.property_log,
             pc.sold_listing_url AS comparison_sold_url,
             pc.source_property_id AS comparison_property_id,
             candidate.sold_listing_url AS candidate_sold_url,
             candidate.rightmove_property_id AS candidate_property_id,
             candidate.identity_status AS candidate_identity_status,
             COALESCE(candidate.bedrooms, pc.bedrooms) AS bedrooms,
             enrichment.bedroom_status, enrichment.bedroom_estimate_low,
             enrichment.bedroom_estimate_high, enrichment.bedroom_estimate_likely,
             enrichment.bedroom_confidence,
             enrichment.garden_area_sqm, enrichment.garden_area_status, enrichment.garden_area_source,
             garden_context.median_area_sqm AS garden_context_median_sqm,
             garden_context.p25_area_sqm AS garden_context_p25_sqm,
             garden_context.p75_area_sqm AS garden_context_p75_sqm,
             garden_context.garden_count AS garden_context_count,
             COALESCE(
               NULLIF(candidate.raw_result #>> '{result,imageUrl}', ''),
               NULLIF(candidate.raw_result #>> '{detail,imageUrl}', ''),
               NULLIF(legacy.property_image_src, '')
             ) AS thumbnail_url
      FROM land_registry_transactions lr
      ${comparisonJoin}
      LEFT JOIN legacy_price_comparisons legacy ON legacy.id = pc.legacy_id
      LEFT JOIN LATERAL (
        SELECT c.*
        FROM rightmove_sold_candidates c
        WHERE c.land_registry_transaction_id = lr.transaction_id
           OR (
             c.postcode = lr.postcode
             AND c.sold_date = lr.transfer_date
             AND c.sold_price = lr.price
             AND regexp_replace(lower(c.address), '[^a-z0-9]', '', 'g') LIKE
               '%' || regexp_replace(lower(concat_ws(' ', lr.saon, lr.paon, lr.street)), '[^a-z0-9]', '', 'g') || '%'
           )
        ORDER BY (c.land_registry_transaction_id = lr.transaction_id) DESC,
                 (c.identity_status IN ('confirmed', 'probable')) DESC, c.id DESC
        LIMIT 1
      ) candidate ON true
      LEFT JOIN property_attribute_enrichments enrichment
        ON enrichment.transaction_id = lr.transaction_id
       AND lr.transfer_date >= current_date - interval '10 years'
      ${gardenContextJoin}
      WHERE ${registryScope}
        AND ${selectedRangeScope}
      ORDER BY ${orderBy}
      LIMIT $6 OFFSET $7
    `, [...params, pageSize, (page - 1) * pageSize]),
    includeTrends ? sql.query(`
      WITH history AS (
        SELECT source.*,
               lag(source.transfer_date) OVER (
                 PARTITION BY upper(source.postcode),
                   regexp_replace(lower(concat_ws(' ', source.saon, source.paon, source.street)), '[^a-z0-9]', '', 'g')
                 ORDER BY source.transfer_date, source.transaction_id
               ) AS previous_sale_date
        FROM land_registry_transactions source
        WHERE split_part(upper(source.postcode), ' ', 1) IN ('E10', 'E11', 'E17')
      )
      SELECT split_part(upper(lr.postcode), ' ', 1) AS area,
             date_trunc('month', lr.transfer_date)::date AS month,
             count(*) AS sales,
             count(*) FILTER (WHERE lr.property_type = 'T') AS terraced_sales,
             count(*) FILTER (WHERE pc.listing_price_verified = true) AS matched_sales,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY lr.price) AS median_sold_price,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY lr.price)
               FILTER (WHERE lr.property_type = 'T') AS terraced_median_sold_price,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY pc.price_difference_percent)
               FILTER (WHERE pc.listing_price_verified = true) AS median_difference_percent,
             avg((lr.transfer_date - lr.previous_sale_date)::numeric / 365.2425)
               FILTER (WHERE lr.previous_sale_date <= lr.transfer_date - interval '90 days') AS average_tenure_years
      FROM history lr
      ${comparisonJoin}
      WHERE ${registryScope}
        AND lr.transfer_date >= make_date($4::int, 1, 1)
        AND lr.transfer_date < make_date($5::int + 1, 1, 1)
        AND ${notPriceOutlier}
      GROUP BY 1, 2
      ORDER BY 1, 2
    `, trendParams) : Promise.resolve([]),
    includeTrends ? sql.query(`
      WITH listing_dates AS (
        SELECT t.postcode_outcode AS area,
               l.rightmove_property_id,
               COALESCE(listed_event.listed_on, first_active.first_active_on) AS listed_on,
               first_sstc.sstc_on
        FROM active_listings l
        JOIN market_targets t ON t.id = l.target_id
        LEFT JOIN LATERAL (
          SELECT min(event.event_date) AS listed_on
          FROM listing_price_events event
          WHERE event.source = 'rightmove-active'
            AND event.source_property_id = l.rightmove_property_id
            AND event.event_type = 'listed'
        ) listed_event ON true
        LEFT JOIN LATERAL (
          SELECT min(snapshot.observed_on) AS first_active_on
          FROM active_listing_snapshots snapshot
          WHERE snapshot.rightmove_property_id = l.rightmove_property_id
            AND snapshot.status = 'active'
        ) first_active ON true
        LEFT JOIN LATERAL (
          SELECT min(snapshot.observed_on) AS sstc_on
          FROM active_listing_snapshots snapshot
          WHERE snapshot.rightmove_property_id = l.rightmove_property_id
            AND snapshot.status = 'sstc'
        ) first_sstc ON true
        WHERE t.enabled = true
          AND t.scrape_active_listings = true
          AND t.property_type = 'TERRACED'
          AND t.postcode_outcode IN ('E10', 'E11', 'E17')
          AND l.tenure = 'F'
          AND l.bedrooms >= 3
          AND ($1 = 'ALL' OR t.postcode_outcode = $1)
          AND ($2 = '' OR replace(upper(COALESCE(l.postcode, t.postcode_outcode)), ' ', '') LIKE $2 || '%')
          AND ($3 = '' OR regexp_replace(lower(COALESCE(l.address, '')), '[^a-z0-9]', '', 'g') LIKE '%' || $3 || '%')
      )
      SELECT area,
             date_trunc('month', sstc_on)::date AS month,
             count(*)::int AS sstc_listings,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY (sstc_on - listed_on)) AS median_days_to_sstc
      FROM listing_dates
      WHERE sstc_on IS NOT NULL
        AND listed_on IS NOT NULL
        AND sstc_on >= listed_on
        AND sstc_on - listed_on <= 730
        AND sstc_on >= make_date($4::int, 1, 1)
        AND sstc_on < make_date($5::int + 1, 1, 1)
      GROUP BY 1, 2
      ORDER BY 1, 2
    `, trendParams) : Promise.resolve([]),
    includeTrends ? sql.query(`
      WITH history AS (
        SELECT source.*,
               lag(source.transfer_date) OVER (
                 PARTITION BY upper(source.postcode),
                   regexp_replace(lower(concat_ws(' ', source.saon, source.paon, source.street)), '[^a-z0-9]', '', 'g')
                 ORDER BY source.transfer_date, source.transaction_id
               ) AS previous_sale_date
        FROM land_registry_transactions source
        WHERE split_part(upper(source.postcode), ' ', 1) IN ('E10', 'E11', 'E17')
      )
      SELECT split_part(upper(lr.postcode), ' ', 1) AS area,
             count(*)::int AS repeat_sales,
             avg((lr.transfer_date - lr.previous_sale_date)::numeric / 365.2425) AS average_tenure_years
      FROM history lr
      WHERE ${registryScope}
        AND ${selectedRangeScope}
        AND ${notPriceOutlier}
        AND lr.previous_sale_date <= lr.transfer_date - interval '90 days'
      GROUP BY 1
      ORDER BY 1
    `, params) : Promise.resolve([]),
    includeTrends ? sql.query(`
      WITH history AS (
        SELECT source.*,
               lag(source.transfer_date) OVER (
                 PARTITION BY upper(source.postcode),
                   regexp_replace(lower(concat_ws(' ', source.saon, source.paon, source.street)), '[^a-z0-9]', '', 'g')
                 ORDER BY source.transfer_date, source.transaction_id
               ) AS previous_sale_date,
               lag(source.price) OVER (
                 PARTITION BY upper(source.postcode),
                   regexp_replace(lower(concat_ws(' ', source.saon, source.paon, source.street)), '[^a-z0-9]', '', 'g')
                 ORDER BY source.transfer_date, source.transaction_id
               ) AS previous_sold_price
        FROM land_registry_transactions source
        WHERE split_part(upper(source.postcode), ' ', 1) IN ('E10', 'E11', 'E17')
      )
      SELECT lr.transaction_id, lr.transfer_date, lr.price, lr.previous_sale_date,
             lr.previous_sold_price, lr.postcode, lr.property_type,
             lr.saon, lr.paon, lr.street, lr.locality, lr.town_city,
             (lr.transfer_date - lr.previous_sale_date)::numeric / 365.2425 AS tenure_years,
             CASE WHEN lr.previous_sold_price > 0
               THEN ((lr.price::numeric / lr.previous_sold_price) - 1) * 100 END AS price_change_percent,
             candidate.sold_listing_url
      FROM history lr
      LEFT JOIN LATERAL (
        SELECT value.sold_listing_url
        FROM rightmove_sold_candidates value
        WHERE value.land_registry_transaction_id = lr.transaction_id
           OR (
             value.postcode = lr.postcode AND value.sold_date = lr.transfer_date
             AND value.sold_price = lr.price
             AND regexp_replace(lower(value.address), '[^a-z0-9]', '', 'g') LIKE
               '%' || regexp_replace(lower(concat_ws(' ', lr.saon, lr.paon, lr.street)), '[^a-z0-9]', '', 'g') || '%'
           )
        ORDER BY (value.land_registry_transaction_id = lr.transaction_id) DESC,
                 (value.identity_status IN ('confirmed', 'probable')) DESC, value.id DESC
        LIMIT 1
      ) candidate ON true
      WHERE ${registryScope}
        AND ${selectedRangeScope}
        AND ${notPriceOutlier}
        AND lr.previous_sale_date <= lr.transfer_date - interval '90 days'
      ORDER BY lr.transfer_date DESC, lr.transaction_id DESC
      LIMIT 50
    `, params) : Promise.resolve([]),
    includeLog ? sql.query(`
      SELECT
        count(*) FILTER (WHERE candidate.id IS NOT NULL) AS rightmove_linked,
        count(*) FILTER (WHERE candidate.id IS NOT NULL
          AND candidate.rightmove_property_id IS NOT NULL
          AND candidate.identity_status IN ('confirmed', 'probable')) AS trusted_property_ids,
        count(*) FILTER (WHERE candidate.identity_status IN ('confirmed', 'probable')
          AND latest.status IS NOT NULL) AS attempted,
        count(*) FILTER (WHERE candidate.identity_status IN ('confirmed', 'probable')
          AND latest.status = 'success') AS matched,
        count(*) FILTER (WHERE candidate.identity_status IN ('confirmed', 'probable')
          AND latest.status = 'not_found') AS no_usable_history,
        count(*) FILTER (WHERE candidate.identity_status IN ('confirmed', 'probable')
          AND latest.status = 'failed') AS failed
      FROM land_registry_transactions lr
      LEFT JOIN LATERAL (
        SELECT c.*
        FROM rightmove_sold_candidates c
        WHERE c.land_registry_transaction_id = lr.transaction_id
        ORDER BY (c.identity_status IN ('confirmed', 'probable')) DESC,
                 (c.rightmove_property_id IS NOT NULL) DESC, c.id DESC
        LIMIT 1
      ) candidate ON true
      LEFT JOIN LATERAL (
        SELECT snapshot.status
        FROM property_log_snapshots snapshot
        WHERE snapshot.candidate_id = candidate.id
        ORDER BY snapshot.fetched_at DESC, snapshot.id DESC
        LIMIT 1
      ) latest ON true
      WHERE ${registryScope}
        AND ${selectedRangeScope}
    `, params) : Promise.resolve([]),
    includeLog ? sql.query(`
      SELECT candidate.id AS candidate_id, candidate.rightmove_property_id,
             candidate.address, candidate.sold_date, candidate.sold_price,
             candidate.sold_listing_url, latest.fetched_at
      FROM land_registry_transactions lr
      JOIN LATERAL (
        SELECT c.*
        FROM rightmove_sold_candidates c
        WHERE c.land_registry_transaction_id = lr.transaction_id
          AND c.rightmove_property_id IS NOT NULL
          AND c.identity_status IN ('confirmed', 'probable')
        ORDER BY c.id DESC
        LIMIT 1
      ) candidate ON true
      JOIN LATERAL (
        SELECT snapshot.status, snapshot.fetched_at
        FROM property_log_snapshots snapshot
        WHERE snapshot.candidate_id = candidate.id
        ORDER BY snapshot.fetched_at DESC, snapshot.id DESC
        LIMIT 1
      ) latest ON true
      WHERE ${registryScope}
        AND ${selectedRangeScope}
        AND latest.status = 'not_found'
      ORDER BY candidate.sold_date DESC, candidate.id DESC
      LIMIT 100
    `, params) : Promise.resolve([]),
    includeLog ? sql.query(`
      SELECT candidate.id AS candidate_id, candidate.rightmove_property_id,
             candidate.address, candidate.sold_date, candidate.sold_price,
             candidate.sold_listing_url, candidate.identity_rejection_reason
      FROM land_registry_transactions lr
      JOIN LATERAL (
        SELECT c.*
        FROM rightmove_sold_candidates c
        WHERE c.land_registry_transaction_id = lr.transaction_id
        ORDER BY (c.identity_status IN ('confirmed', 'probable')) DESC,
                 (c.rightmove_property_id IS NOT NULL) DESC, c.id DESC
        LIMIT 1
      ) candidate ON true
      WHERE ${registryScope}
        AND ${selectedRangeScope}
        AND candidate.identity_status NOT IN ('confirmed', 'probable')
      ORDER BY candidate.sold_date DESC, candidate.id DESC
      LIMIT 250
    `, params) : Promise.resolve([]),
    includeMap ? sql.query(`
      SELECT lr.transaction_id, lr.postcode, lr.saon, lr.paon, lr.street, lr.locality,
             lr.town_city, lr.price, lr.transfer_date,
             pc.latitude, pc.longitude,
             CASE WHEN pc.listing_price_verified = true THEN pc.listing_price END AS listing_price,
             CASE WHEN pc.listing_price_verified = true THEN pc.price_difference_percent END AS price_difference_percent,
             pc.bedrooms, pc.sold_listing_url,
             COALESCE(pc.floor_area_sqm,
               CASE WHEN enrichment.floor_area_status = 'verified' THEN enrichment.floor_area_sqm END
             ) AS floor_area_sqm,
             CASE
               WHEN pc.floor_area_sqm IS NOT NULL THEN pc.floor_area_source
               WHEN enrichment.floor_area_status = 'verified' THEN enrichment.floor_area_source
               ELSE NULL
             END AS floor_area_source,
             enrichment.bedroom_status, enrichment.bedroom_estimate_low,
             enrichment.bedroom_estimate_high, enrichment.bedroom_estimate_likely,
             enrichment.garden_area_sqm, enrichment.garden_area_status, enrichment.garden_area_source,
             garden_context.median_area_sqm AS garden_context_median_sqm,
             garden_context.p25_area_sqm AS garden_context_p25_sqm,
             garden_context.p75_area_sqm AS garden_context_p75_sqm,
             garden_context.garden_count AS garden_context_count,
             NULLIF(legacy.property_image_src, '') AS thumbnail_url
      FROM land_registry_transactions lr
      JOIN LATERAL (
        SELECT comparison.*
        FROM property_comparisons comparison
        WHERE comparison.land_registry_transaction_id = lr.transaction_id
          AND comparison.latitude IS NOT NULL
          AND comparison.longitude IS NOT NULL
        ORDER BY comparison.listing_price_verified DESC, comparison.id DESC
        LIMIT 1
      ) pc ON true
      LEFT JOIN property_attribute_enrichments enrichment
        ON enrichment.transaction_id = lr.transaction_id
       AND lr.transfer_date >= current_date - interval '10 years'
      ${gardenContextJoin}
      LEFT JOIN legacy_price_comparisons legacy ON legacy.id = pc.legacy_id
      WHERE ${registryScope}
        AND ${selectedRangeScope}
        AND ${notPriceOutlier}
      ORDER BY lr.transfer_date DESC, lr.transaction_id DESC
      LIMIT 1500
    `, params) : Promise.resolve([]),
  ]);

  const summary = summaryRows[0];
  const totalSales = number(summary.total_sales) ?? 0;
  const transactionCount = number(summary.transaction_count) ?? 0;
  const typeLabels: Record<string, string> = {
    D: 'Detached', S: 'Semi-detached', T: 'Terraced', F: 'Flat / maisonette', O: 'Other',
  };

  return {
    connected: true,
    lastUpdated: summary.last_updated == null ? null : String(summary.last_updated),
    summary: {
      totalSales,
      matchedSales: number(summary.matched_sales) ?? 0,
      averageSoldPrice: number(summary.average_sold_price),
      changeOneYear: percentageChange(summary.recent_average, summary.one_year_average),
      changeTwoYears: percentageChange(summary.recent_average, summary.two_year_average),
      changeFiveYears: percentageChange(summary.recent_average, summary.five_year_average),
      medianSoldPrice: number(summary.median_sold_price),
      medianDifferencePercent: number(summary.median_difference_percent),
      latestSaleDate: summary.latest_sale_date == null ? null : String(summary.latest_sale_date),
    },
    areas: areaRows.map((row) => ({
      area: String(row.area),
      sales: number(row.sales) ?? 0,
      matchedSales: number(row.matched_sales) ?? 0,
      medianSoldPrice: number(row.median_sold_price),
      medianDifferencePercent: number(row.median_difference_percent),
    })),
    transactions: transactionRows.map((row) => {
      const verified = row.listing_price_verified === true;
      const hasComparison = row.comparison_id != null;
      const hasRightmove = row.candidate_sold_url != null || row.comparison_sold_url != null;
      const price = number(row.price) ?? 0;
      const floorAreaSqm = number(row.floor_area_sqm);
      const sourceReview: SoldTransaction['sourceReview'] = row.address_classification_conflict === true
        ? 'classification_conflict'
        : row.market_price_outlier === true
          ? 'price_outlier'
          : !hasRightmove && new Date(String(row.transfer_date)) >= new Date(Date.now() - 120 * 24 * 60 * 60 * 1000)
            ? 'awaiting_rightmove'
            : null;
      const comparisonStatus = verified
        ? 'matched'
        : row.listing_price_source === 'propertylog-outlier-review'
          ? 'needs_review'
          : hasComparison && row.property_log != null
            ? 'no_valid_history'
            : row.candidate_identity_status === 'rejected'
              ? 'identity_issue'
            : hasRightmove ? 'no_listing' : 'no_rightmove';
      const address = [
        [row.saon, row.paon].filter(Boolean).join(' '),
        row.street,
        row.locality,
        row.town_city,
      ].filter(Boolean).join(', ');
      return {
        id: String(row.transaction_id),
        address,
        postcode: row.postcode == null ? null : String(row.postcode),
        area: String(row.postcode || '').split(' ')[0] || 'Unknown',
        propertyType: typeLabels[String(row.property_type)] || 'Unknown',
        bedrooms: number(row.bedrooms) ?? (row.bedroom_status === 'estimated_range' ? number(row.bedroom_estimate_likely) : null),
        bedroomsEstimated: row.bedrooms == null && row.bedroom_status === 'estimated_range',
        bedroomEstimateLow: number(row.bedroom_estimate_low),
        bedroomEstimateHigh: number(row.bedroom_estimate_high),
        bedroomConfidence: number(row.bedroom_confidence),
        listingPrice: verified ? number(row.listing_price) : null,
        soldPrice: price,
        soldDate: String(row.transfer_date),
        differencePercent: verified ? number(row.price_difference_percent) : null,
        comparisonStatus,
        soldOverviewUrl: row.candidate_sold_url == null
          ? row.comparison_sold_url == null ? null : String(row.comparison_sold_url)
          : String(row.candidate_sold_url),
        rightmovePropertyId: ['confirmed', 'probable'].includes(String(row.candidate_identity_status))
          && row.candidate_property_id != null
          ? String(row.candidate_property_id)
          : row.comparison_property_id == null ? null : String(row.comparison_property_id),
        thumbnailUrl: imageUrl(row.thumbnail_url),
        landRegistryUrl: row.linked_data_uri == null ? null : String(row.linked_data_uri).replace(/^http:/, 'https:'),
        categoryType: String(row.category_type || 'A'),
        sourceReview,
        floorAreaSqm,
        floorAreaSource: row.floor_area_source == null ? null : String(row.floor_area_source),
        pricePerSqm: floorAreaSqm == null || floorAreaSqm <= 0 || price / floorAreaSqm > maxCrediblePricePerSqm
          ? null : price / floorAreaSqm,
        gardenAreaSqm: number(row.garden_area_sqm),
        gardenAreaStatus: row.garden_area_status == null ? null : String(row.garden_area_status),
        gardenAreaSource: row.garden_area_source == null ? null : String(row.garden_area_source),
        gardenContextMedianSqm: number(row.garden_context_median_sqm),
        gardenContextP25Sqm: number(row.garden_context_p25_sqm),
        gardenContextP75Sqm: number(row.garden_context_p75_sqm),
        gardenContextCount: number(row.garden_context_count),
      } satisfies SoldTransaction;
    }),
    transactionCount,
    page,
    pageSize,
    pageCount: Math.ceil(transactionCount / pageSize),
    postcodeQuery,
    addressQuery,
    trends: completeTrendSeries(trendRows, sstcTrendRows, trendStartYear, trendEndYear, area),
    postcodeTenure: tenureRows.map((row) => ({
      area: String(row.area),
      repeatSales: number(row.repeat_sales) ?? 0,
      averageTenureYears: number(row.average_tenure_years),
    })),
    repeatSales: repeatRows.map((row) => ({
      id: String(row.transaction_id),
      address: [
        [row.saon, row.paon].filter(Boolean).join(' '),
        row.street,
        row.locality,
        row.town_city,
      ].filter(Boolean).join(', '),
      postcode: row.postcode == null ? null : String(row.postcode),
      propertyType: typeLabels[String(row.property_type)] || 'Unknown',
      currentSoldDate: String(row.transfer_date),
      currentSoldPrice: number(row.price) ?? 0,
      previousSoldDate: String(row.previous_sale_date),
      previousSoldPrice: number(row.previous_sold_price) ?? 0,
      tenureYears: number(row.tenure_years) ?? 0,
      priceChangePercent: number(row.price_change_percent),
      soldOverviewUrl: row.sold_listing_url == null ? null : String(row.sold_listing_url),
    })),
    mapPoints: mapRows.map((row) => {
      const soldPrice = number(row.price) ?? 0;
      const floorAreaSqm = number(row.floor_area_sqm);
      return {
        id: String(row.transaction_id),
        address: [
          [row.saon, row.paon].filter(Boolean).join(' '),
          row.street,
          row.locality,
          row.town_city,
        ].filter(Boolean).join(', '),
        postcode: row.postcode == null ? null : String(row.postcode),
        latitude: number(row.latitude) ?? 0,
        longitude: number(row.longitude) ?? 0,
        soldPrice,
        listingPrice: number(row.listing_price),
        differencePercent: number(row.price_difference_percent),
        soldDate: String(row.transfer_date),
        bedrooms: number(row.bedrooms) ?? (row.bedroom_status === 'estimated_range' ? number(row.bedroom_estimate_likely) : null),
        bedroomsEstimated: row.bedrooms == null && row.bedroom_status === 'estimated_range',
        bedroomEstimateLow: number(row.bedroom_estimate_low),
        bedroomEstimateHigh: number(row.bedroom_estimate_high),
        soldOverviewUrl: row.sold_listing_url == null ? null : String(row.sold_listing_url),
        thumbnailUrl: imageUrl(row.thumbnail_url),
        floorAreaSqm,
        floorAreaSource: row.floor_area_source == null ? null : String(row.floor_area_source),
        pricePerSqm: floorAreaSqm == null || floorAreaSqm <= 0 || soldPrice / floorAreaSqm > maxCrediblePricePerSqm
          ? null : soldPrice / floorAreaSqm,
        gardenAreaSqm: number(row.garden_area_sqm),
        gardenAreaStatus: row.garden_area_status == null ? null : String(row.garden_area_status),
        gardenAreaSource: row.garden_area_source == null ? null : String(row.garden_area_source),
        gardenContextMedianSqm: number(row.garden_context_median_sqm),
        gardenContextP25Sqm: number(row.garden_context_p25_sqm),
        gardenContextP75Sqm: number(row.garden_context_p75_sqm),
        gardenContextCount: number(row.garden_context_count),
      } satisfies SoldMapPoint;
    }),
    sort,
    direction,
    selectedStartYear,
    selectedEndYear,
    trendStartYear,
    trendEndYear,
    propertyLogFunnel: {
      rightmoveLinked: number(funnelRows[0]?.rightmove_linked) ?? 0,
      trustedPropertyIds: number(funnelRows[0]?.trusted_property_ids) ?? 0,
      attempted: number(funnelRows[0]?.attempted) ?? 0,
      matched: number(funnelRows[0]?.matched) ?? 0,
      noUsableHistory: number(funnelRows[0]?.no_usable_history) ?? 0,
      failed: number(funnelRows[0]?.failed) ?? 0,
    },
    propertyLogReview: reviewRows.map((row) => ({
      candidateId: String(row.candidate_id),
      rightmovePropertyId: String(row.rightmove_property_id),
      address: String(row.address),
      soldDate: String(row.sold_date),
      soldPrice: number(row.sold_price) ?? 0,
      soldOverviewUrl: String(row.sold_listing_url),
      fetchedAt: String(row.fetched_at),
    })),
    identityReview: identityRows.map((row) => ({
      candidateId: String(row.candidate_id),
      rightmovePropertyId: row.rightmove_property_id == null ? null : String(row.rightmove_property_id),
      address: String(row.address),
      soldDate: String(row.sold_date),
      soldPrice: number(row.sold_price) ?? 0,
      soldOverviewUrl: String(row.sold_listing_url),
      reason: String(row.identity_rejection_reason || 'identity_not_verified'),
    })),
  };
}
