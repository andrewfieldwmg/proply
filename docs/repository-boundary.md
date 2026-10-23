# Public/private repository boundary

## Public

- Product UI and analytical read queries.
- Fixed research contract, reduced read model and deterministic controls.
- Provider-neutral acquisition contracts.
- Synthetic fixtures and behavioral tests.
- Data-source, provenance, quality, security and operating documentation.
- Continuous checks for accidental private implementation or secret publication.

## Private

- Production acquisition adapters and selectors.
- Browser automation, stealth behavior and provider request headers.
- Direct third-party endpoint construction.
- Crawl limits, retry cadence and anti-blocking tactics.
- Raw provider payloads and licensed source extracts not cleared for redistribution.
- Scheduler, updater, notification and database-write implementation.
- Production credentials, deployment hooks, logs and authenticated screenshots.

The private tier may implement the public interfaces, but the public build never imports the private workspace. This keeps the portfolio runnable while making the production integration boundary explicit.

## Enforcement

`npm run verify:public-boundary` scans every tracked or pending public file and fails on:

- known private paths;
- raw provider fixture names;
- stealth dependencies and direct history-provider endpoints;
- browser-origin or referrer reproduction;
- write/generic database variables and deployment hooks;
- credential-bearing connection strings, common API-key shapes and private keys;
- private-workspace dependencies; and
- database roles outside the two approved reduced-read roles.

The research-specific verifier and tests remain separate because they validate database grants and the fixed aggregate query rather than repository contents.
