# Proply

Proply is a transaction-first property research product for E10, E11 and E17. It starts with completed HM Land Registry sales, links each transaction to the best available historical listing evidence, and makes gaps visible instead of silently dropping unmatched records.

Live product: [proply-af.vercel.app](https://proply-af.vercel.app/)

This repository is the clean public portfolio edition. Production acquisition adapters integrate with third-party property services and are intentionally excluded. Provider-neutral contracts, normalization, synthetic fixtures, identity and quality controls, analytical queries, the isolated research API, and the dashboard are included. Neither the project nor its author is affiliated with or endorsed by those third parties.

## Why transaction-first

A listing-first dashboard overstates the quality of the join because only discovered listings appear. Proply instead keeps the registered sale as the authoritative row and left-joins optional evidence. A missing listing, uncertain identity, implausible asking-price comparison, or late observation remains an explicit state.

The analytical path is:

```text
HM Land Registry completed sale
        |
        v
normalized address + postcode + date + price identity tuple
        |
        v
optional sold-listing identity and dated asking-price observations
        |
        v
temporal cut-off -> provenance check -> anomaly quarantine
        |
        v
read-only Neon model -> Next.js dashboard / bounded research API
```

## What a reviewer can inspect

- The responsive Next.js dashboard, maps, filters, trends and data-quality views.
- Read-only dashboard and listing queries. Runtime code accepts only `DATABASE_READ_URL`; there is no generic or write-credential fallback.
- A five-field security-barrier research view and hardened, read-only role definitions.
- A separate research application with fixed query shape, input allowlists, request-size, rate, concurrency and timeout controls.
- Provider-neutral acquisition interfaces and a fixture-backed implementation under `src/acquisition/`.
- Deterministic tests for identity matching, chronology, provenance, price comparison and anomaly quarantine.
- A public-boundary scanner that rejects private adapter paths, stealth tooling, direct provider endpoints, browser-header reproduction, write credentials, secrets and raw provider fixtures.

## Deliberate boundary

The complete operational system remains private because it contains browser automation, provider-specific selectors and request construction, retry tactics, scheduled refresh scripts and database-write paths. The public application does not import that repository, package or workspace and builds independently.

Previously published Git objects cannot be recalled from third-party caches or old clones. The clean history stops normal continued publication; it does not claim retroactive secrecy.

See [Architecture](docs/architecture.md), [Repository boundary](docs/repository-boundary.md), and [Research boundary](docs/research-boundary.md).

## Run locally

Requirements: Node.js 22 or newer. Node 24 is used in CI.

```bash
npm ci
npm run verify:public-boundary
npm test
npm run check
npm run check:research-api
npm run build
npm run build:research-api
```

The UI builds and renders its disconnected state without a database. To exercise data-backed pages, provide a separately issued read-only connection through `DATABASE_READ_URL`. Do not connect an updater identity or a generic database integration.

## Data and rights

- Completed-sale authority: HM Land Registry Price Paid Data, used under the Open Government Licence v3.0.
- Mapping includes OpenStreetMap tiles and the application's displayed attribution.
- Third-party listing evidence is derived and provenance-labelled. Production acquisition code and raw provider responses are not redistributed here.
- Property attributes can come from approved public or licensed sources; each observation carries its source and observation time.

Data can be delayed, incomplete or incorrectly linked. Proply is research software, not a valuation, lending or investment recommendation.
