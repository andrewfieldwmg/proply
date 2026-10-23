import Link from 'next/link';
import {
  getDashboardData,
  type DashboardData,
  type MarketArea,
  type SoldSort,
  type SoldTransaction,
  type SortDirection,
  type TrendPoint,
} from '@/lib/dashboard';
import {
  getListingsData,
  type ListingSort,
  type ListingsData,
} from '@/lib/listings';
import SoldMap from './sold-map';
import ThemeToggle from './theme-toggle';

export const dynamic = 'force-dynamic';

const money = new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', maximumFractionDigits: 0,
});
const integer = new Intl.NumberFormat('en-GB');
const areas: MarketArea[] = ['ALL', 'E10', 'E11', 'E17'];
type DashboardView = 'details' | 'listings' | 'map' | 'summary' | 'log';

function percent(value: number | null) {
  if (value == null) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function ratePercent(value: number | null) {
  return value == null ? '—' : `${value.toFixed(1)}%`;
}

function compactMoney(value: number | null) {
  if (value == null) return '—';
  if (value >= 1_000_000) return `£${(value / 1_000_000).toFixed(value % 1_000_000 ? 1 : 0)}m`;
  return `£${Math.round(value / 1_000)}k`;
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London',
  });
}

function compactDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Europe/London',
  });
}

function updated(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
  });
}

function compactAddress(value: string) {
  const parts = value.split(',').map((part) => part.trim()).filter(Boolean);
  const keep = /^(flat|apartment)\b/i.test(parts[0] || '') ? 3 : 2;
  const original = parts.slice(0, keep).join(' ');
  const address = original
    .replace(/\bROAD\b/gi, 'Rd')
    .replace(/\bSTREET\b/gi, 'St')
    .replace(/\bAVENUE\b/gi, 'Ave')
    .replace(/\bGARDENS\b/gi, 'Gdns')
    .replace(/\bCRESCENT\b/gi, 'Cres')
    .replace(/\bPLACE\b/gi, 'Pl');
  return original === original.toUpperCase()
    ? address.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
    : address;
}

function readableReason(value: string) {
  return value.split(',').map((reason) => reason.replaceAll('_', ' ')).join(', ');
}

function floorAreaLabel(source: string | null) {
  if (source === 'epc_exact_match') return 'EPC';
  if (source?.startsWith('rightmove')) return 'Rightmove';
  if (source === 'floorplan-ocr') return 'floorplan';
  return null;
}

function queryUrl(
  area: MarketArea,
  postcode: string,
  address: string,
  page = 1,
  view: DashboardView = 'details',
  sort?: string,
  direction?: SortDirection,
  includeSstc = false,
  year?: number | null,
  fromYear?: number,
  toYear?: number,
) {
  const params = new URLSearchParams({ area });
  if (postcode) params.set('postcode', postcode);
  if (address) params.set('address', address);
  if (page > 1) params.set('page', String(page));
  if (view !== 'details') params.set('view', view);
  if (view !== 'summary' && sort) params.set('sort', sort);
  if (view !== 'summary' && direction) params.set('direction', direction);
  if (view === 'listings' && includeSstc) params.set('includeSstc', 'true');
  if (view !== 'listings' && fromYear != null) params.set('fromYear', String(fromYear));
  if (view !== 'listings' && toYear != null) params.set('toYear', String(toYear));
  if (view !== 'listings' && fromYear == null && toYear == null && year != null) params.set('year', String(year));
  return `/?${params.toString()}`;
}

function AreaFilters({
  area, postcode, address, view, sort, direction, includeSstc, year, fromYear, toYear,
}: {
  area: MarketArea;
  postcode: string;
  address: string;
  view: DashboardView;
  sort?: string;
  direction?: SortDirection;
  includeSstc?: boolean;
  year?: number | null;
  fromYear?: number;
  toYear?: number;
}) {
  return (
    <nav className="area-filters" aria-label="Filter by postcode area">
      {areas.map((item) => (
        <Link
          className={item === area ? 'filter-active' : ''}
          href={queryUrl(item, postcode, address, 1, view, sort, direction, includeSstc, year, fromYear, toYear)}
          key={item}
        >
          {item === 'ALL' ? 'All three areas' : item}
        </Link>
      ))}
    </nav>
  );
}

function SortHeader({
  label, sortKey, currentSort, direction, area, postcode, address, view, includeSstc, year, fromYear, toYear,
}: {
  label: string;
  sortKey: string;
  currentSort: string;
  direction: SortDirection;
  area: MarketArea;
  postcode: string;
  address: string;
  view: DashboardView;
  includeSstc?: boolean;
  year?: number | null;
  fromYear?: number;
  toYear?: number;
}) {
  const active = currentSort === sortKey;
  const nextDirection: SortDirection = active && direction === 'desc' ? 'asc' : 'desc';
  return (
    <th aria-sort={active ? direction === 'asc' ? 'ascending' : 'descending' : undefined}>
      <Link className={active ? 'sort-active' : ''} href={queryUrl(area, postcode, address, 1, view, sortKey, nextDirection, includeSstc, year, fromYear, toYear)}>
        {label}<span aria-hidden="true">{active ? direction === 'asc' ? ' ↑' : ' ↓' : ' ↕'}</span>
      </Link>
    </th>
  );
}

const statusLabels: Record<SoldTransaction['comparisonStatus'], string> = {
  matched: 'Asking price found',
  needs_review: 'Needs review',
  no_valid_history: 'No valid pre-sale price',
  identity_issue: 'Rightmove ID not verified',
  no_listing: 'No listing price found',
  no_rightmove: 'No Rightmove sold page',
};

const sourceReviewLabels: Record<Exclude<SoldTransaction['sourceReview'], null>, string> = {
  classification_conflict: 'HMLR classification changed',
  price_outlier: 'HMLR price outlier',
  awaiting_rightmove: 'Awaiting Rightmove update',
};

function roundedAverage(value: number | null) {
  return value == null ? '—' : compactMoney(Math.round(value / 1_000) * 1_000);
}

function MarketPulse({ data }: { data: DashboardData }) {
  const period = data.selectedStartYear === data.selectedEndYear
    ? `${data.selectedStartYear} non-outlier sales`
    : `${data.selectedStartYear}–${data.selectedEndYear} non-outlier sales`;
  const comparisonPeriod = data.selectedStartYear === data.selectedEndYear
    ? `${data.selectedStartYear}${data.selectedEndYear === new Date().getUTCFullYear() ? ' year to date' : ''}`
    : `${data.selectedStartYear}–${data.selectedEndYear}`;
  return (
    <section className="market-pulse" aria-label="Filtered sold price snapshot">
      <div className="pulse-average"><span>Filtered average</span><strong>{roundedAverage(data.summary.averageSoldPrice)}</strong><small>{period}</small></div>
      <div><span>1-year change</span><strong className={data.summary.changeOneYear == null ? '' : data.summary.changeOneYear >= 0 ? 'positive' : 'negative'}>{percent(data.summary.changeOneYear)}</strong></div>
      <div><span>2-year change</span><strong className={data.summary.changeTwoYears == null ? '' : data.summary.changeTwoYears >= 0 ? 'positive' : 'negative'}>{percent(data.summary.changeTwoYears)}</strong></div>
      <div><span>5-year change</span><strong className={data.summary.changeFiveYears == null ? '' : data.summary.changeFiveYears >= 0 ? 'positive' : 'negative'}>{percent(data.summary.changeFiveYears)}</strong></div>
      <p>Change compares {comparisonPeriod} with the equivalent period 1, 2, or 5 years earlier.</p>
    </section>
  );
}

function SoldView({ data, area }: { data: DashboardData; area: MarketArea }) {
  const sortProps = {
    currentSort: data.sort,
    direction: data.direction,
    area,
    postcode: data.postcodeQuery,
    address: data.addressQuery,
    view: 'details' as const,
    fromYear: data.selectedStartYear,
    toYear: data.selectedEndYear,
  };
  return (
    <>
      <MarketPulse data={data} />
      <section className="panel table-panel sold-table">
      <div className="panel-heading table-heading">
        <div><p className="eyebrow">Standard freehold residential sales</p><h2>Sold transactions</h2></div>
        <span className="annotation">50 per page · {integer.format(data.transactionCount)} total · garden figures are property-level title measurements</span>
      </div>
      <div className="table-wrap"><table><thead><tr>
        <th>Photo</th>
        <SortHeader label="Property" sortKey="address" {...sortProps} />
        <SortHeader label="Sold" sortKey="soldPrice" {...sortProps} />
        <SortHeader label="£/m²" sortKey="pricePerSqm" {...sortProps} />
        <SortHeader label="Floor m²" sortKey="floorArea" {...sortProps} />
        <SortHeader label="Garden m²" sortKey="gardenArea" {...sortProps} />
        <SortHeader label="Date" sortKey="soldDate" {...sortProps} />
        <SortHeader label="Beds" sortKey="bedrooms" {...sortProps} />
        <SortHeader label="Ask" sortKey="listingPrice" {...sortProps} />
        <SortHeader label="Margin / status" sortKey="margin" {...sortProps} />
      </tr></thead>
        <tbody>{data.transactions.length === 0 ? <tr><td className="empty" colSpan={10}>No Land Registry transactions match this filter.</td></tr> : data.transactions.map((row) => (
          <tr className={row.thumbnailUrl && row.comparisonStatus === 'matched' ? 'fully-enriched' : ''} key={row.id}>
            <td className="photo-cell">{row.thumbnailUrl
              ? <img src={row.thumbnailUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
              : <div className="photo-placeholder" aria-label="No property thumbnail">No image</div>}
            </td>
            <td className="property-cell">
              {row.soldOverviewUrl
                ? <a className="property-link desktop-address" href={row.soldOverviewUrl} target="_blank" rel="noreferrer"><strong>{row.address}</strong></a>
                : <strong className="desktop-address">{row.address}</strong>}
              {row.soldOverviewUrl
                ? <a className="property-link mobile-address" href={row.soldOverviewUrl} target="_blank" rel="noreferrer"><strong>{compactAddress(row.address)}</strong></a>
                : <strong className="mobile-address">{compactAddress(row.address)}</strong>}
              <span className="property-meta">{row.postcode} · {row.propertyType}{row.categoryType === 'B' ? ' · additional transaction' : ''}<span className="rightmove-meta">{row.rightmovePropertyId ? ` · Rightmove ${row.rightmovePropertyId}` : ''}</span></span>
              {row.sourceReview && <span className={`source-review source-review-${row.sourceReview}`}>{sourceReviewLabels[row.sourceReview]}</span>}
              {row.soldOverviewUrl && <a className="source-link rightmove-source-link" href={row.soldOverviewUrl} target="_blank" rel="noreferrer">Rightmove sold page</a>}
              {row.landRegistryUrl && <a className="source-link" href={row.landRegistryUrl} target="_blank" rel="noreferrer">Land Registry record</a>}
            </td>
            <td className="sold-price"><strong className="desktop-money">{money.format(row.soldPrice)}</strong><strong className="mobile-money">{compactMoney(row.soldPrice)}</strong></td>
            <td className="sqm-cell"><span className="desktop-sqm">{row.pricePerSqm == null ? '—' : `${money.format(row.pricePerSqm)}/m²`}</span></td>
            <td className="floor-cell" title={row.floorAreaSqm == null ? undefined : `Floor area from ${floorAreaLabel(row.floorAreaSource) || row.floorAreaSource || 'verified source'}`}><strong className="mobile-floor">{row.floorAreaSqm == null ? '—' : Math.round(row.floorAreaSqm)}</strong><span className="desktop-floor">{row.floorAreaSqm == null ? '—' : `${Math.round(row.floorAreaSqm)} m²`}</span>{row.floorAreaSqm != null && <span className="cell-subtitle desktop-detail">{floorAreaLabel(row.floorAreaSource) || 'verified'}</span>}</td>
            <td className="garden-cell" title={row.gardenAreaSqm == null ? undefined : `Property garden measured by ${row.gardenAreaSource || 'verified title-boundary intersection'}.`}>{row.gardenAreaSqm == null ? '—' : `${Math.round(row.gardenAreaSqm)} m²`}<span className="cell-subtitle desktop-detail">{row.gardenAreaSqm == null ? '' : 'title measured'}</span></td>
            <td className="sold-date"><span className="desktop-date">{shortDate(row.soldDate)}</span><span className="mobile-date">{compactDate(row.soldDate)}</span></td>
            <td className="bed-cell" title={row.bedroomsEstimated ? `Estimated ${row.bedroomEstimateLow}–${row.bedroomEstimateHigh} bedrooms; ${Math.round((row.bedroomConfidence || 0) * 100)}% confidence` : undefined}>
              <strong className={row.bedroomsEstimated ? 'bed-estimate' : ''}>{row.bedrooms == null ? '—' : `${row.bedroomsEstimated ? '≈' : ''}${row.bedrooms}`}</strong>
              <span className="cell-subtitle desktop-detail">{row.bedroomsEstimated ? `est. ${row.bedroomEstimateLow}–${row.bedroomEstimateHigh}` : row.propertyType}</span>
            </td>
            <td className="ask-cell"><span className="desktop-money">{row.listingPrice == null ? '—' : money.format(row.listingPrice)}</span><span className="mobile-money">{compactMoney(row.listingPrice)}</span></td>
            <td className={row.differencePercent == null ? '' : row.differencePercent >= 0 ? 'positive' : 'negative'}>
              {row.differencePercent == null ? '—' : percent(row.differencePercent)}
              <span className={`comparison-status comparison-${row.comparisonStatus}`}>{statusLabels[row.comparisonStatus]}</span>
            </td>
          </tr>
        ))}</tbody></table></div>

      {data.pageCount > 1 && (
        <nav className="pagination" aria-label="Sold transaction pages">
          {data.page > 1
            ? <Link href={queryUrl(area, data.postcodeQuery, data.addressQuery, data.page - 1, 'details', data.sort, data.direction, false, undefined, data.selectedStartYear, data.selectedEndYear)}>← Previous</Link>
            : <span />}
          <span>Page {integer.format(data.page)} of {integer.format(data.pageCount)}</span>
          {data.page < data.pageCount
            ? <Link href={queryUrl(area, data.postcodeQuery, data.addressQuery, data.page + 1, 'details', data.sort, data.direction, false, undefined, data.selectedStartYear, data.selectedEndYear)}>Next →</Link>
            : <span />}
        </nav>
      )}
      </section>
    </>
  );
}

function MapView({ data }: { data: DashboardData }) {
  return (
    <>
      <MarketPulse data={data} />
      <section className="panel map-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">Price comparison map</p><h2>Filtered sold properties</h2></div>
          <span className="annotation">{integer.format(data.mapPoints.length)} geocoded matches plotted · latest 1,500</span>
        </div>
        {data.mapPoints.length
          ? <><SoldMap points={data.mapPoints} /><div className="map-legend"><span className="map-profit">Above ask</span><span className="map-even">Within ±1%</span><span className="map-loss">Below ask</span><span className="map-unknown">No margin</span></div></>
          : <div className="map-empty">No geocoded comparison records match this filter.</div>}
      </section>
    </>
  );
}

function ListingsView({ data, area }: { data: ListingsData; area: MarketArea }) {
  const sortProps = {
    currentSort: data.sort,
    direction: data.direction,
    area,
    postcode: data.postcodeQuery,
    address: data.addressQuery,
    view: 'listings' as const,
    includeSstc: data.includeSstc,
  };
  return (
    <section className="panel table-panel listings-table">
      <div className="panel-heading table-heading">
        <div><p className="eyebrow">Rightmove listings</p><h2>Current market</h2></div>
        <span className="annotation">
          3+ bed freehold terraces · {integer.format(data.summary.current)} current · {integer.format(data.summary.newSevenDays)} new · {integer.format(data.summary.reducedSevenDays)} reduced in 7 days
        </span>
      </div>
      <div className="table-wrap"><table><thead><tr>
        <th>Photo</th>
        <SortHeader label="Property" sortKey="address" {...sortProps} />
        <SortHeader label="Asking" sortKey="askingPrice" {...sortProps} />
        <SortHeader label="Listed" sortKey="listedDate" {...sortProps} />
        <SortHeader label="Reduced" sortKey="reducedDate" {...sortProps} />
        <SortHeader label="Beds" sortKey="bedrooms" {...sortProps} />
        <SortHeader label="Estate agent" sortKey="agent" {...sortProps} />
        <SortHeader label="Status" sortKey="status" {...sortProps} />
        <SortHeader label="Days to SSTC" sortKey="daysToSstc" {...sortProps} />
      </tr></thead>
        <tbody>{data.listings.length === 0 ? <tr><td className="empty" colSpan={9}>No active listings match this filter.</td></tr> : data.listings.map((row) => (
          <tr key={row.id}>
            <td className="photo-cell">{row.thumbnailUrl
              ? <img src={row.thumbnailUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
              : <div className="photo-placeholder" aria-label="No property thumbnail">No image</div>}
            </td>
            <td className="property-cell">
              <a className="property-link desktop-address" href={row.propertyUrl} target="_blank" rel="noreferrer"><strong>{row.address}</strong></a>
              <a className="property-link mobile-address" href={row.propertyUrl} target="_blank" rel="noreferrer"><strong>{compactAddress(row.address)}</strong></a>
              <span className="property-meta">{row.postcode || row.area}<span className="desktop-agent-meta">{row.agent ? ` · ${row.agent}` : ''}</span>{row.floorAreaSqm != null ? ` · ${Math.round(row.floorAreaSqm)} m²` : ''}</span>
              {row.status === 'sstc' && <span className="listing-inline-status">SOLD STC{row.daysToSstc == null ? '' : ` · ${integer.format(row.daysToSstc)} days`}</span>}
            </td>
            <td className="ask-cell"><strong className="desktop-money">{row.askingPrice == null ? '—' : money.format(row.askingPrice)}</strong><strong className="mobile-money">{compactMoney(row.askingPrice)}</strong>{row.priceChange != null && row.priceChange !== 0 && <span className={`cell-subtitle ${row.priceChange < 0 ? 'negative' : 'positive'}`}>{row.priceChange > 0 ? '+' : ''}{money.format(row.priceChange)}</span>}{row.pricePerSqm != null && <span className="cell-subtitle desktop-detail">{money.format(row.pricePerSqm)}/m²</span>}</td>
            <td><span className="desktop-date">{shortDate(row.listedDate)}</span><span className="mobile-date">{compactDate(row.listedDate)}</span><span className="cell-subtitle desktop-detail">Original listing</span></td>
            <td><span className="desktop-date">{row.reducedDate ? shortDate(row.reducedDate) : '—'}</span><span className="mobile-date">{row.reducedDate ? compactDate(row.reducedDate) : '—'}</span><span className="cell-subtitle desktop-detail">{row.reducedDate ? 'Latest reduction' : 'No reduction'}</span></td>
            <td className="bed-cell"><strong>{row.bedrooms ?? '—'}</strong><span className="cell-subtitle desktop-detail">{row.propertyType || 'Terraced'}</span></td>
            <td className="agent-cell" title={row.agent || undefined}>{row.agent || '—'}</td>
            <td><span className={`listing-status ${row.status === 'sstc' ? 'status-sstc' : ''}`}>{row.status === 'sstc' ? 'SOLD STC' : 'For sale'}</span></td>
            <td>{row.daysToSstc == null ? '—' : <><strong>{integer.format(row.daysToSstc)}</strong><span className="cell-subtitle">days</span></>}</td>
          </tr>
        ))}</tbody></table></div>

      {data.pageCount > 1 && (
        <nav className="pagination" aria-label="Current listing pages">
          {data.page > 1
            ? <Link href={queryUrl(area, data.postcodeQuery, data.addressQuery, data.page - 1, 'listings', data.sort, data.direction, data.includeSstc)}>← Previous</Link>
            : <span />}
          <span>Page {integer.format(data.page)} of {integer.format(data.pageCount)}</span>
          {data.page < data.pageCount
            ? <Link href={queryUrl(area, data.postcodeQuery, data.addressQuery, data.page + 1, 'listings', data.sort, data.direction, data.includeSstc)}>Next →</Link>
            : <span />}
        </nav>
      )}
    </section>
  );
}

type TrendMetric = 'sales' | 'medianSoldPrice' | 'terracedMedianSoldPrice' | 'medianDifferencePercent' | 'averageTenureYears' | 'medianDaysToSstc';
const trendColours: Record<string, string> = {
  E10: 'var(--series-e10)',
  E11: 'var(--series-e11)',
  E17: 'var(--series-e17)',
};

function rollingMedianTrend(values: Array<number | null>, windowSize = 3) {
  return values.map((value, index) => {
    if (value == null || index < windowSize - 1) return null;
    const window = values.slice(index - windowSize + 1, index + 1);
    if (window.some((sample) => sample == null)) return null;
    const sorted = [...window as number[]].sort((left, right) => left - right);
    return sorted[Math.floor(sorted.length / 2)];
  });
}

function quadraticTrend(values: Array<number | null>) {
  const samples = values.flatMap((value, index) => value == null ? [] : [{ index, value }]);
  if (samples.length < 3) return values.map(() => null);

  const centre = samples.reduce((sum, sample) => sum + sample.index, 0) / samples.length;
  const scale = Math.max(1, ...samples.map((sample) => Math.abs(sample.index - centre)));
  const normalised = samples.map((sample) => ({
    x: (sample.index - centre) / scale,
    y: sample.value,
  }));
  const sum = (power: number, y = false) => normalised.reduce(
    (total, sample) => total + (y ? sample.y : 1) * sample.x ** power,
    0,
  );
  const matrix = [
    [sum(0), sum(1), sum(2), sum(0, true)],
    [sum(1), sum(2), sum(3), sum(1, true)],
    [sum(2), sum(3), sum(4), sum(2, true)],
  ];

  for (let column = 0; column < 3; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < 3; row += 1) {
      if (Math.abs(matrix[row][column]) > Math.abs(matrix[pivot][column])) pivot = row;
    }
    [matrix[column], matrix[pivot]] = [matrix[pivot], matrix[column]];
    if (Math.abs(matrix[column][column]) < 1e-12) return values.map(() => null);
    const divisor = matrix[column][column];
    for (let entry = column; entry < 4; entry += 1) matrix[column][entry] /= divisor;
    for (let row = 0; row < 3; row += 1) {
      if (row === column) continue;
      const factor = matrix[row][column];
      for (let entry = column; entry < 4; entry += 1) matrix[row][entry] -= factor * matrix[column][entry];
    }
  }

  const [constant, linear, quadratic] = matrix.map((row) => row[3]);
  return values.map((_, index) => {
    const x = (index - centre) / scale;
    return constant + linear * x + quadratic * x ** 2;
  });
}

function TrendChart({ title, subtitle, points, metric, format }: {
  title: string;
  subtitle: string;
  points: TrendPoint[];
  metric: TrendMetric;
  format: (value: number) => string;
}) {
  const series = [...new Set(points.map((point) => point.area))].map((area) => ({
    area,
    points: points.filter((point) => point.area === area),
  }));
  const rawValues = series.flatMap((item) => item.points.map((point) => point[metric]));
  const available = rawValues.filter((value): value is number => value != null);
  if (!available.length) return <article className="panel trend-panel"><h3>{title}</h3><p>{subtitle}</p><div className="chart-empty">Not enough data for this filter.</div></article>;

  const width = 760;
  const height = 270;
  const left = 62;
  const right = 18;
  const top = 18;
  const bottom = 42;
  let minimum = Math.min(...available);
  let maximum = Math.max(...available);
  if (metric === 'sales') minimum = 0;
  if (metric === 'medianDifferencePercent') {
    minimum = Math.min(minimum, 0);
    maximum = Math.max(maximum, 0);
  }
  if (minimum === maximum) {
    minimum -= 1;
    maximum += 1;
  }
  const pointCount = Math.max(...series.map((item) => item.points.length));
  const x = (index: number) => left + (index / Math.max(1, pointCount - 1)) * (width - left - right);
  const y = (value: number) => top + ((maximum - value) / (maximum - minimum)) * (height - top - bottom);
  const path = (values: Array<number | null>) => {
    let output = '';
    let drawing = false;
    values.forEach((value, index) => {
      if (value == null) { drawing = false; return; }
      output += `${drawing ? ' L' : 'M'} ${x(index).toFixed(1)} ${y(value).toFixed(1)}`;
      drawing = true;
    });
    return output;
  };
  const tickValues = [maximum, (minimum + maximum) / 2, minimum];
  const dateIndexes = [...new Set([0, Math.floor((pointCount - 1) / 2), pointCount - 1])];
  const dates = series[0].points;

  return (
    <article className="panel trend-panel">
      <div className="chart-title"><div><h3>{title}</h3><p>{subtitle}</p></div><div className="chart-legend">{series.map((item) => <span key={item.area} style={{ '--series-colour': trendColours[item.area] } as React.CSSProperties}>{item.area}</span>)}</div></div>
      <div className="chart-wrap">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title}, monthly postcode comparison`}>
          {tickValues.map((value) => <g key={value}><line className="chart-gridline" x1={left} x2={width - right} y1={y(value)} y2={y(value)} /><text className="chart-axis-label" x={left - 8} y={y(value) + 4} textAnchor="end">{format(value)}</text></g>)}
          {series.map((item) => {
            const values = item.points.map((point) => point[metric]);
            const colour = trendColours[item.area] || 'var(--series-e10)';
            return <g key={item.area}>
              <path className="chart-line" d={path(values)} style={{ stroke: colour }} />
              {metric !== 'sales' && metric !== 'terracedMedianSoldPrice' && <path className="chart-trend-line" d={path(rollingMedianTrend(values))} style={{ stroke: colour }} />}
              {metric === 'terracedMedianSoldPrice' && <path className="chart-trend-line" d={path(quadraticTrend(values))} style={{ stroke: colour }} />}
              {metric === 'terracedMedianSoldPrice' && item.points.map((point, index) => point.terracedMedianSoldPrice == null ? null : (
                <circle className="chart-point" key={point.month} cx={x(index)} cy={y(point.terracedMedianSoldPrice)} r="4" style={{ fill: colour }}>
                  <title>{`${item.area} · ${new Date(point.month).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'Europe/London' })} · ${format(point.terracedMedianSoldPrice)} median · ${point.terracedSales} terraced ${point.terracedSales === 1 ? 'sale' : 'sales'}`}</title>
                </circle>
              ))}
            </g>;
          })}
          {dateIndexes.map((index) => <text className="chart-axis-label" key={index} x={x(index)} y={height - 10} textAnchor={index === 0 ? 'start' : index === pointCount - 1 ? 'end' : 'middle'}>{dates[index] ? new Date(dates[index].month).toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'Europe/London' }) : ''}</text>)}
        </svg>
      </div>
      {metric === 'terracedMedianSoldPrice'
        ? <p className="trend-key">Solid: monthly median · dashed: quadratic trend · hover points for sample size · latest reported months are provisional</p>
        : metric !== 'sales' && <p className="trend-key">Solid: monthly median · dashed: 3-month rolling median</p>}
    </article>
  );
}

function SummaryView({ data }: { data: DashboardData }) {
  const range = data.trendStartYear === data.trendEndYear
    ? String(data.trendStartYear)
    : `${data.trendStartYear}–${data.trendEndYear}`;
  return <>
    <section className="trend-grid" aria-label="Sold market trends by postcode">
      <TrendChart title="Terraced sold price" subtitle={`Monthly non-outlier freehold terraced median by postcode for ${range}`} points={data.trends} metric="terracedMedianSoldPrice" format={(value) => `£${Math.round(value / 1000)}k`} />
      <TrendChart title="Sales volume" subtitle={`Completed non-outlier transactions by postcode for ${range}`} points={data.trends} metric="sales" format={(value) => integer.format(Math.round(value))} />
      <TrendChart title="Sold versus original ask" subtitle={`Monthly median for verified PropertyLog matches by postcode for ${range}`} points={data.trends} metric="medianDifferencePercent" format={(value) => `${value.toFixed(1)}%`} />
      <TrendChart title="Days to Sold STC" subtitle={`Median days from initial listing to first observed Sold STC by postcode for ${range}`} points={data.trends} metric="medianDaysToSstc" format={(value) => `${Math.round(value)}d`} />
      <TrendChart title="Time between sales" subtitle={`Average completed tenure by postcode for repeat sales in ${range}`} points={data.trends} metric="averageTenureYears" format={(value) => `${value.toFixed(1)}y`} />
    </section>

    <section className="panel market-panel repeat-sales-panel">
      <div className="panel-heading"><div><p className="eyebrow">Repeat-sale evidence</p><h2>Repeatedly sold properties</h2></div><span className="annotation">Exact address and postcode · intervals under 90 days excluded</span></div>
      <div className="tenure-grid">
        {data.postcodeTenure.map((item) => <div key={item.area}><span>{item.area} average tenure</span><strong>{item.averageTenureYears == null ? '—' : `${item.averageTenureYears.toFixed(1)} years`}</strong><small>{integer.format(item.repeatSales)} repeat sales in this range</small></div>)}
      </div>
      <div className="table-wrap repeat-sales-table"><table><thead><tr><th>Property</th><th>Latest sale</th><th>Previous sale</th><th>Time held</th><th>Price change</th><th>Source</th></tr></thead><tbody>
        {data.repeatSales.length === 0
          ? <tr><td className="empty" colSpan={6}>No repeat sales match this filter and year range.</td></tr>
          : data.repeatSales.map((row) => <tr key={row.id}>
            <td className="property-cell"><strong>{compactAddress(row.address)}</strong><span>{row.postcode} · {row.propertyType}</span></td>
            <td><strong>{money.format(row.currentSoldPrice)}</strong><span className="cell-subtitle">{shortDate(row.currentSoldDate)}</span></td>
            <td>{money.format(row.previousSoldPrice)}<span className="cell-subtitle">{shortDate(row.previousSoldDate)}</span></td>
            <td>{row.tenureYears.toFixed(1)} years</td>
            <td className={row.priceChangePercent == null ? '' : row.priceChangePercent >= 0 ? 'positive' : 'negative'}>{percent(row.priceChangePercent)}</td>
            <td>{row.soldOverviewUrl ? <a className="source-link" href={row.soldOverviewUrl} target="_blank" rel="noreferrer">Rightmove sold page</a> : '—'}</td>
          </tr>)}
      </tbody></table></div>
    </section>
  </>;
}

function LogView({ data }: { data: DashboardData }) {
  const propertyLogRate = data.propertyLogFunnel.attempted
    ? (data.propertyLogFunnel.matched / data.propertyLogFunnel.attempted) * 100 : null;
  return (
    <>
      <section className="kpi-grid" aria-label="Sold market summary">
        <article className="kpi"><span>Land Registry transactions</span><strong>{integer.format(data.summary.totalSales)}</strong><small>Standard freehold residential sales; flagged price outliers excluded</small></article>
        <article className="kpi"><span>PropertyLog hit rate</span><strong>{ratePercent(propertyLogRate)}</strong><small>{integer.format(data.propertyLogFunnel.matched)} usable histories from {integer.format(data.propertyLogFunnel.attempted)} trusted-ID attempts</small></article>
        <article className="kpi"><span>Latest registered sale</span><strong className="kpi-date">{data.summary.latestSaleDate ? shortDate(data.summary.latestSaleDate) : '—'}</strong><small>HM Land Registry deed date</small></article>
        <article className="kpi kpi-accent"><span>Median vs original ask</span><strong>{percent(data.summary.medianDifferencePercent)}</strong><small>Verified matches only</small></article>
      </section>

      <section className="panel market-panel summary-coverage">
        <div className="panel-heading"><div><p className="eyebrow">Enrichment funnel</p><h2>Rightmove to PropertyLog</h2></div><span className="annotation">Current verified pipeline, not all-time archive coverage</span></div>
        <div className="funnel-grid">
          <div><span>Rightmove sales linked</span><strong>{integer.format(data.propertyLogFunnel.rightmoveLinked)}</strong></div>
          <div><span>Trusted property IDs</span><strong>{integer.format(data.propertyLogFunnel.trustedPropertyIds)}</strong></div>
          <div><span>Usable PropertyLog history</span><strong>{integer.format(data.propertyLogFunnel.matched)}</strong></div>
          <div><span>No usable pre-sale history</span><strong>{integer.format(data.propertyLogFunnel.noUsableHistory)}</strong></div>
          <div><span>Request failures</span><strong>{integer.format(data.propertyLogFunnel.failed)}</strong></div>
        </div>
      </section>

      {data.propertyLogReview.length > 0 && <section className="panel market-panel summary-coverage">
        <div className="panel-heading"><div><p className="eyebrow">PropertyLog review queue</p><h2>No usable pre-sale history returned</h2></div><span className="annotation">{integer.format(data.propertyLogReview.length)} cases in this filter</span></div>
        <div className="table-wrap"><table><thead><tr><th>Property</th><th>Sold date</th><th>Sold price</th><th>Rightmove ID</th><th>Outcome</th></tr></thead><tbody>
          {data.propertyLogReview.map((row) => <tr key={row.candidateId}>
            <td className="property-cell"><a className="property-link" href={row.soldOverviewUrl} target="_blank" rel="noreferrer"><strong>{row.address}</strong></a></td>
            <td>{shortDate(row.soldDate)}</td><td>{money.format(row.soldPrice)}</td><td>{row.rightmovePropertyId}</td><td><span className="comparison-status">No pre-sale price</span></td>
          </tr>)}
        </tbody></table></div>
      </section>}

      {data.identityReview.length > 0 && <section className="panel market-panel summary-coverage">
        <div className="panel-heading"><div><p className="eyebrow">Rightmove identity review queue</p><h2>Stopped before PropertyLog</h2></div><span className="annotation">{integer.format(data.identityReview.length)} linked transactions in this filter</span></div>
        <div className="table-wrap"><table><thead><tr><th>Property</th><th>Sold date</th><th>Sold price</th><th>Rightmove ID</th><th>Identity reason</th></tr></thead><tbody>
          {data.identityReview.map((row) => <tr key={row.candidateId}>
            <td className="property-cell"><a className="property-link" href={row.soldOverviewUrl} target="_blank" rel="noreferrer"><strong>{row.address}</strong></a></td>
            <td>{shortDate(row.soldDate)}</td><td>{money.format(row.soldPrice)}</td><td>{row.rightmovePropertyId || 'Not extracted'}</td><td><span className="comparison-status comparison-identity_issue">{readableReason(row.reason)}</span></td>
          </tr>)}
        </tbody></table></div>
      </section>}

      <section className="panel market-panel summary-coverage">
        <div className="panel-heading"><div><p className="eyebrow">Historical archive coverage</p><h2>Coverage across the cleaned, non-outlier summary population</h2></div></div>
        <div className="coverage-list">
          {data.areas.map((item) => {
            const coverage = item.sales ? (item.matchedSales / item.sales) * 100 : 0;
            return <div className="coverage-row" key={item.area}><strong>{item.area}</strong><span>{integer.format(item.sales)} sales</span><span>{integer.format(item.matchedSales)} asking prices</span><strong>{percent(coverage)}</strong></div>;
          })}
        </div>
      </section>
    </>
  );
}

function scalar(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Dashboard({ searchParams }: PageProps<'/'>) {
  const params = await searchParams;
  const requestedArea = String(scalar(params.area) || 'ALL').toUpperCase();
  const area = areas.includes(requestedArea as MarketArea) ? requestedArea as MarketArea : 'ALL';
  const postcode = String(scalar(params.postcode) || '');
  const address = String(scalar(params.address) || '');
  const page = Number(scalar(params.page) || '1');
  const direction: SortDirection = scalar(params.direction) === 'asc' ? 'asc' : 'desc';
  const rawView = scalar(params.view);
  const view: DashboardView = rawView === 'summary' || rawView === 'listings' || rawView === 'map' || rawView === 'log' ? rawView : 'details';
  const currentYear = new Date().getUTCFullYear();
  const yearOptions = Array.from({ length: currentYear - 1995 + 1 }, (_, index) => currentYear - index);
  const validRangeYear = (value: string | undefined, fallback: number) => {
    const parsed = Number(value || fallback);
    return Number.isInteger(parsed) && parsed >= 1995 && parsed <= currentYear ? parsed : fallback;
  };
  const requestedYear = scalar(params.year);
  const legacyYear = requestedYear === 'all'
    ? null
    : requestedYear == null ? undefined : validRangeYear(requestedYear, currentYear);
  const defaultStartYear = view === 'summary' ? Math.max(1995, currentYear - 3) : currentYear;
  const requestedFromYear = validRangeYear(scalar(params.fromYear), legacyYear === null ? 1995 : legacyYear ?? defaultStartYear);
  const requestedToYear = validRangeYear(scalar(params.toYear), legacyYear ?? currentYear);
  const selectedStartYear = Math.min(requestedFromYear, requestedToYear);
  const selectedEndYear = Math.max(requestedFromYear, requestedToYear);
  const soldSort = String(scalar(params.sort) || 'soldDate') as SoldSort;
  const listingSort = String(scalar(params.sort) || 'listedDate') as ListingSort;
  const includeSstc = scalar(params.includeSstc) === 'true';
  const soldData = view === 'listings'
    ? null
    : await getDashboardData(area, postcode, address, page, view === 'summary', soldSort, direction, view === 'map', selectedStartYear, selectedEndYear, view === 'log', selectedStartYear, selectedEndYear);
  const listingsData = view === 'listings'
    ? await getListingsData(area, postcode, address, page, listingSort, direction, includeSstc)
    : null;
  const activeData = listingsData || soldData!;
  const activeSort = listingsData?.sort || (view === 'details' ? soldData?.sort : undefined);
  const activeDirection = listingsData?.direction || (view === 'details' ? soldData?.direction : undefined);

  return (
    <main>
      <header className="masthead">
        <div><p className="eyebrow">E10 · E11 · E17 property intelligence</p><h1>Proply</h1><p className="lede">Standard freehold residential sales, enriched with Rightmove and the original asking price where a reliable match exists.</p></div>
        <div className="masthead-actions">
          <div className={`status ${activeData.connected ? 'status-live' : ''}`}><span />{activeData.connected ? updated(activeData.lastUpdated) ? `Last refresh ${updated(activeData.lastUpdated)}` : 'Neon connected' : 'Awaiting database import'}</div>
          <ThemeToggle />
        </div>
      </header>

      <nav className="view-tabs" aria-label="Dashboard views">
        <Link className={view === 'details' ? 'tab-active' : ''} href={queryUrl(area, activeData.postcodeQuery, activeData.addressQuery, 1, 'details', undefined, undefined, false, undefined, selectedStartYear, selectedEndYear)}>Sold properties</Link>
        <Link className={view === 'map' ? 'tab-active' : ''} href={queryUrl(area, activeData.postcodeQuery, activeData.addressQuery, 1, 'map', undefined, undefined, false, undefined, selectedStartYear, selectedEndYear)}>Map</Link>
        <Link className={view === 'listings' ? 'tab-active' : ''} href={queryUrl(area, activeData.postcodeQuery, activeData.addressQuery, 1, 'listings')}>Listings</Link>
        <Link className={view === 'summary' ? 'tab-active' : ''} href={queryUrl(area, activeData.postcodeQuery, activeData.addressQuery, 1, 'summary', undefined, undefined, false, undefined, selectedStartYear, selectedEndYear)}>Summary & trends</Link>
        <Link className={view === 'log' ? 'tab-active' : ''} href={queryUrl(area, activeData.postcodeQuery, activeData.addressQuery, 1, 'log', undefined, undefined, false, undefined, selectedStartYear, selectedEndYear)}>Log</Link>
      </nav>

      <div className="filter-bar">
        <AreaFilters area={area} postcode={activeData.postcodeQuery} address={activeData.addressQuery} view={view} sort={activeSort} direction={activeDirection} includeSstc={listingsData?.includeSstc} fromYear={selectedStartYear} toYear={selectedEndYear} />
        <form className="postcode-search" action="/" method="get">
          <input type="hidden" name="area" value={area} />
          <input type="hidden" name="view" value={view} />
          {activeSort && <input type="hidden" name="sort" value={activeSort} />}
          {activeDirection && <input type="hidden" name="direction" value={activeDirection} />}
          {view === 'listings' && <label className="sstc-toggle" htmlFor="includeSstc"><input id="includeSstc" name="includeSstc" type="checkbox" value="true" defaultChecked={includeSstc} /><span>Include Sold STC</span></label>}
          {view !== 'listings' && <label htmlFor="fromYear">From</label>}
          {view !== 'listings' && <select id="fromYear" name="fromYear" defaultValue={selectedStartYear}>{[...yearOptions].reverse().map((year) => <option value={year} key={year}>{year}</option>)}</select>}
          {view !== 'listings' && <label htmlFor="toYear">To</label>}
          {view !== 'listings' && <select id="toYear" name="toYear" defaultValue={selectedEndYear}>{yearOptions.map((year) => <option value={year} key={year}>{year === currentYear ? `${year} (YTD)` : year}</option>)}</select>}
          <label htmlFor="postcode">Postcode</label>
          <input id="postcode" name="postcode" defaultValue={activeData.postcodeQuery} placeholder="E17 7" />
          <label htmlFor="address">Address</label>
          <input className="address-input" id="address" name="address" defaultValue={address} placeholder="Waverley Road" />
          <button type="submit">Filter</button>
          {(activeData.postcodeQuery || activeData.addressQuery) && <Link href={queryUrl(area, '', '', 1, view, activeSort, activeDirection, listingsData?.includeSstc, undefined, selectedStartYear, selectedEndYear)}>Clear</Link>}
        </form>
      </div>

      {!activeData.connected && <section className="setup-panel"><p className="eyebrow">Migration ready</p><h2>Connect Neon to reveal the market.</h2><p>The dashboard deliberately contains no fabricated demo data.</p></section>}
      {view === 'summary' && soldData
        ? <SummaryView data={soldData} />
        : view === 'log' && soldData
          ? <LogView data={soldData} />
        : view === 'map' && soldData
          ? <MapView data={soldData} />
          : view === 'listings' && listingsData
            ? <ListingsView data={listingsData} area={area} />
            : soldData ? <SoldView data={soldData} area={area} /> : null}

      <footer>
        <span>Contains HM Land Registry data © Crown copyright and database right 2026. Licensed under the Open Government Licence v3.0.</span>
        <span> Contains OS data © Crown copyright and database rights 2026. <a href="https://osdatahub.os.uk/" target="_blank" rel="noreferrer">OS Data Hub</a> · <a href="https://osdatahub.os.uk/errorReporting" target="_blank" rel="noreferrer">Report an OS data issue</a>.</span>
      </footer>
    </main>
  );
}
