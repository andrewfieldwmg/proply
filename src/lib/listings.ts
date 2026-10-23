import 'server-only';
import { neon } from '@neondatabase/serverless';
import type { MarketArea, SortDirection } from './dashboard';

export type ListingSort = 'address' | 'askingPrice' | 'bedrooms' | 'activityDate' | 'listedDate' | 'reducedDate' | 'agent' | 'status' | 'daysToSstc';

export type CurrentListing = {
  id: string;
  address: string;
  postcode: string | null;
  area: string;
  propertyType: string | null;
  bedrooms: number | null;
  askingPrice: number | null;
  originalPrice: number | null;
  priceChange: number | null;
  status: string;
  marketingEvent: string | null;
  agent: string | null;
  firstSeenAt: string;
  activityDate: string;
  listedDate: string;
  reducedDate: string | null;
  lastSeenAt: string;
  daysOnMarket: number;
  daysToSstc: number | null;
  propertyUrl: string;
  thumbnailUrl: string | null;
  floorAreaSqm: number | null;
  pricePerSqm: number | null;
};

export type ListingsData = {
  connected: boolean;
  lastUpdated: string | null;
  summary: {
    current: number;
    newSevenDays: number;
    reducedSevenDays: number;
    medianAskingPrice: number | null;
  };
  listings: CurrentListing[];
  page: number;
  pageSize: number;
  pageCount: number;
  postcodeQuery: string;
  addressQuery: string;
  sort: ListingSort;
  direction: SortDirection;
  includeSstc: boolean;
};

const pageSize = 50;
const emptyData: ListingsData = {
  connected: false,
  lastUpdated: null,
  summary: { current: 0, newSevenDays: 0, reducedSevenDays: 0, medianAskingPrice: null },
  listings: [],
  page: 1,
  pageSize,
  pageCount: 0,
  postcodeQuery: '',
  addressQuery: '',
  sort: 'listedDate',
  direction: 'desc',
  includeSstc: false,
};

function number(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function imageUrl(value: unknown): string | null {
  if (!value) return null;
  const url = String(value);
  const normalized = url.startsWith('//') ? `https:${url}` : url;
  return /^https?:\/\//i.test(normalized) && /\/property-photo\//i.test(normalized)
    ? normalized
    : null;
}

function normalizedPostcode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
}

function normalizedAddress(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80);
}

export async function getListingsData(
  area: MarketArea = 'ALL',
  postcode = '',
  address = '',
  requestedPage = 1,
  requestedSort: ListingSort = 'listedDate',
  requestedDirection: SortDirection = 'desc',
  includeSstc = false,
): Promise<ListingsData> {
  const databaseUrl = process.env.DATABASE_READ_URL;
  if (!databaseUrl) return emptyData;

  const postcodeQuery = normalizedPostcode(postcode);
  const addressQuery = address.trim().slice(0, 80);
  const addressMatchQuery = normalizedAddress(addressQuery);
  const page = Math.max(1, Math.floor(requestedPage) || 1);
  const sortExpressions: Record<ListingSort, string> = {
    address: "regexp_replace(lower(l.address), '[^a-z0-9]', '', 'g')",
    askingPrice: 'l.asking_price',
    bedrooms: 'l.bedrooms',
    activityDate: 'COALESCE(l.source_event_date, l.first_seen_at::date)',
    listedDate: 'COALESCE(listed_event.event_date, first_active.first_active_on, l.first_seen_at::date)',
    reducedDate: 'reduced_event.event_date',
    agent: "lower(COALESCE(l.agent, ''))",
    status: 'l.availability_status',
    daysToSstc: 'days_to_sstc',
  };
  const sort = Object.hasOwn(sortExpressions, requestedSort) ? requestedSort : 'activityDate';
  const requestedQueryDirection: SortDirection = requestedDirection === 'asc' ? 'asc' : 'desc';
  const queryDirection = requestedQueryDirection.toUpperCase();
  const sql = neon(databaseUrl);
  const params = [area, postcodeQuery, addressMatchQuery, includeSstc];
  const areaScope = `
    upper(t.postcode_outcode) IN ('E10', 'E11', 'E17')
    AND t.enabled = true
    AND t.scrape_active_listings = true
    AND t.property_type = 'TERRACED'
    AND (
      upper(COALESCE(l.property_type, '')) LIKE '%TERRACE%'
      OR upper(COALESCE(l.property_type, '')) = 'HOUSE'
    )
    AND l.tenure = 'F'
    AND l.bedrooms >= 3
    AND ($1 = 'ALL' OR upper(t.postcode_outcode) = $1)
    AND ($2 = '' OR replace(upper(COALESCE(l.postcode, t.postcode_outcode)), ' ', '') LIKE $2 || '%')
    AND ($3 = '' OR regexp_replace(lower(COALESCE(l.address, '')), '[^a-z0-9]', '', 'g') LIKE '%' || $3 || '%')
    AND (l.availability_status = 'active' OR ($4::boolean AND l.availability_status = 'sstc'))
  `;
  const [summaryRows, listingRows] = await Promise.all([
    sql.query(`
      SELECT count(*) AS current,
             count(*) FILTER (WHERE l.latest_marketing_event = 'listed'
               AND l.source_event_date >= current_date - 7) AS new_seven_days,
             count(*) FILTER (WHERE l.latest_marketing_event = 'reduced'
               AND l.source_event_date >= current_date - 7) AS reduced_seven_days,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY l.asking_price)
               FILTER (WHERE l.asking_price IS NOT NULL) AS median_asking_price,
             greatest(
               max(l.updated_at),
               COALESCE((
                 SELECT max(run.completed_at)
                 FROM ingestion_runs run
                 WHERE run.kind = 'market_scrape' AND run.status = 'completed'
               ), max(l.updated_at))
             ) AS last_updated
      FROM active_listings l
      JOIN market_targets t ON t.id = l.target_id
      WHERE ${areaScope}
    `, params),
    sql.query(`
      SELECT l.rightmove_property_id, l.address, l.postcode,
             t.postcode_outcode AS area, l.property_type, l.bedrooms,
             l.asking_price, first_event.price AS original_price,
             CASE WHEN first_event.price IS NULL OR l.asking_price IS NULL THEN NULL
                  ELSE l.asking_price - first_event.price END AS price_change,
             l.availability_status, l.latest_marketing_event, l.agent,
             l.first_seen_at, l.last_seen_at,
             COALESCE(l.source_event_date, l.first_seen_at::date) AS activity_date,
             COALESCE(listed_event.event_date, first_active.first_active_on,
               l.first_seen_at::date) AS listed_date,
             COALESCE(reduced_event.event_date,
               CASE WHEN l.latest_marketing_event = 'reduced' THEN l.source_event_date END
             ) AS reduced_date,
             greatest(0, floor(extract(epoch FROM (now() - l.first_seen_at)) / 86400)) AS days_on_market,
             CASE
               WHEN first_sstc.sstc_on IS NULL
                 OR COALESCE(listed_event.event_date, first_active.first_active_on) IS NULL
                 OR first_sstc.sstc_on < COALESCE(listed_event.event_date, first_active.first_active_on)
               THEN NULL
               ELSE first_sstc.sstc_on - COALESCE(listed_event.event_date, first_active.first_active_on)
             END AS days_to_sstc,
             l.property_url,
             l.floor_area_sqm,
             COALESCE(
               NULLIF(l.raw_result #>> '{result,imageUrl}', ''),
               NULLIF(l.raw_result #>> '{detail,imageUrl}', '')
             ) AS thumbnail_url
      FROM active_listings l
      JOIN market_targets t ON t.id = l.target_id
      LEFT JOIN LATERAL (
        SELECT e.price FROM listing_price_events e
        WHERE e.source = 'rightmove-active'
          AND e.source_property_id = l.rightmove_property_id
        ORDER BY e.event_date ASC NULLS LAST, e.observed_at ASC
        LIMIT 1
      ) first_event ON true
      LEFT JOIN LATERAL (
        SELECT min(e.event_date) AS event_date
        FROM listing_price_events e
        WHERE e.source = 'rightmove-active'
          AND e.source_property_id = l.rightmove_property_id
          AND e.event_type = 'listed'
      ) listed_event ON true
      LEFT JOIN LATERAL (
        SELECT max(e.event_date) AS event_date
        FROM listing_price_events e
        WHERE e.source_property_id = l.rightmove_property_id
          AND e.event_type = 'reduced'
      ) reduced_event ON true
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
      WHERE ${areaScope}
      ORDER BY ${sortExpressions[sort]} ${queryDirection} NULLS LAST,
               l.first_seen_at DESC, l.rightmove_property_id DESC
      LIMIT $5 OFFSET $6
    `, [...params, pageSize, (page - 1) * pageSize]),
  ]);
  const summary = summaryRows[0];
  const total = number(summary.current) ?? 0;

  return {
    connected: true,
    lastUpdated: summary.last_updated == null ? null : String(summary.last_updated),
    summary: {
      current: total,
      newSevenDays: number(summary.new_seven_days) ?? 0,
      reducedSevenDays: number(summary.reduced_seven_days) ?? 0,
      medianAskingPrice: number(summary.median_asking_price),
    },
    listings: listingRows.map((row) => {
      const askingPrice = number(row.asking_price);
      const floorAreaSqm = number(row.floor_area_sqm);
      return {
      id: String(row.rightmove_property_id),
      address: String(row.address || 'Address unavailable'),
      postcode: row.postcode == null ? null : String(row.postcode),
      area: String(row.area),
      propertyType: row.property_type == null ? null : String(row.property_type),
      bedrooms: number(row.bedrooms),
      askingPrice,
      originalPrice: number(row.original_price),
      priceChange: number(row.price_change),
      status: String(row.availability_status),
      marketingEvent: row.latest_marketing_event == null ? null : String(row.latest_marketing_event),
      agent: row.agent == null ? null : String(row.agent),
      firstSeenAt: String(row.first_seen_at),
      activityDate: String(row.activity_date),
      listedDate: String(row.listed_date),
      reducedDate: row.reduced_date == null ? null : String(row.reduced_date),
      lastSeenAt: String(row.last_seen_at),
      daysOnMarket: number(row.days_on_market) ?? 0,
      daysToSstc: number(row.days_to_sstc),
      propertyUrl: String(row.property_url),
      thumbnailUrl: imageUrl(row.thumbnail_url),
      floorAreaSqm,
      pricePerSqm: askingPrice == null || floorAreaSqm == null || floorAreaSqm <= 0
        ? null
        : askingPrice / floorAreaSqm,
    };
    }),
    page,
    pageSize,
    pageCount: Math.ceil(total / pageSize),
    postcodeQuery,
    addressQuery,
    sort,
    direction: requestedQueryDirection,
    includeSstc,
  };
}
