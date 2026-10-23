export type PropertyType = 'D' | 'S' | 'T' | 'F';

export type SourceReference = {
  provider: string;
  reference: string;
  observedAt: string;
};

export type SoldSearch = {
  address: string;
  postcode: string;
  completedAt: string;
  soldPrice: number;
  propertyType?: PropertyType;
  limit?: number;
};

export type PriceEvent = {
  observedAt: string;
  askingPrice: number;
  provenance: SourceReference;
};

export type SoldCandidate = {
  reference: SourceReference;
  address: string;
  postcode: string;
  completedAt: string;
  soldPrice: number;
  propertyType: PropertyType;
  priceEvents: PriceEvent[];
};

export type PropertyDetails = {
  reference: SourceReference;
  bedrooms: number | null;
  floorAreaSqm: number | null;
  attributesObservedAt: string;
};

export interface SoldListingProvider {
  findCandidates(query: SoldSearch): Promise<SoldCandidate[]>;
  getPropertyDetails(reference: string): Promise<PropertyDetails | null>;
}

export interface ListingHistoryProvider {
  getPriceHistory(reference: string, completedAt: string): Promise<PriceEvent[]>;
}

export type Comparison = {
  originalAskingPrice: number | null;
  differencePercent: number | null;
  status: 'verified' | 'quarantined' | 'no_history';
  provenance: SourceReference | null;
};

type SyntheticFixture = {
  candidates: SoldCandidate[];
  details: PropertyDetails[];
};

const normalizeIdentity = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '');

function validIsoDate(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function copyEvent(event: PriceEvent): PriceEvent {
  if (!validIsoDate(event.observedAt) || !Number.isFinite(event.askingPrice) || event.askingPrice <= 0) {
    throw new TypeError('Synthetic price events must contain a positive price and ISO timestamp');
  }
  return {
    observedAt: event.observedAt,
    askingPrice: event.askingPrice,
    provenance: { ...event.provenance },
  };
}

export class SyntheticPropertyProvider implements SoldListingProvider, ListingHistoryProvider {
  readonly #fixture: SyntheticFixture;

  constructor(fixture: SyntheticFixture) {
    this.#fixture = structuredClone(fixture);
  }

  async findCandidates(query: SoldSearch): Promise<SoldCandidate[]> {
    const limit = Math.min(Math.max(Math.trunc(query.limit ?? 10), 1), 25);
    const address = normalizeIdentity(query.address);
    const postcode = normalizeIdentity(query.postcode);

    return this.#fixture.candidates
      .filter((candidate) =>
        normalizeIdentity(candidate.address) === address &&
        normalizeIdentity(candidate.postcode) === postcode &&
        candidate.completedAt === query.completedAt &&
        candidate.soldPrice === query.soldPrice &&
        (!query.propertyType || candidate.propertyType === query.propertyType))
      .slice(0, limit)
      .map((candidate) => structuredClone(candidate));
  }

  async getPropertyDetails(reference: string): Promise<PropertyDetails | null> {
    const details = this.#fixture.details.find((item) => item.reference.reference === reference);
    return details ? structuredClone(details) : null;
  }

  async getPriceHistory(reference: string, completedAt: string): Promise<PriceEvent[]> {
    const cutoff = Date.parse(completedAt);
    if (!Number.isFinite(cutoff)) throw new TypeError('completedAt must be an ISO date');
    const candidate = this.#fixture.candidates.find((item) => item.reference.reference === reference);
    if (!candidate) return [];

    return candidate.priceEvents
      .map(copyEvent)
      .filter((event) => Date.parse(event.observedAt) <= cutoff)
      .sort((left, right) => Date.parse(left.observedAt) - Date.parse(right.observedAt));
  }
}

export function compareWithOriginalAsk(
  soldPrice: number,
  history: PriceEvent[],
  maximumAbsoluteMargin = 50,
): Comparison {
  if (!Number.isFinite(soldPrice) || soldPrice <= 0) throw new TypeError('soldPrice must be positive');
  const original = history[0];
  if (!original) {
    return { originalAskingPrice: null, differencePercent: null, status: 'no_history', provenance: null };
  }

  const differencePercent = ((soldPrice - original.askingPrice) / original.askingPrice) * 100;
  return {
    originalAskingPrice: original.askingPrice,
    differencePercent,
    status: Math.abs(differencePercent) <= maximumAbsoluteMargin ? 'verified' : 'quarantined',
    provenance: { ...original.provenance },
  };
}
