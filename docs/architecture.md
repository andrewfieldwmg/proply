# Architecture

## Runtime separation

The public web tier is read-only. The independently operated private acquisition tier owns collection, normalization and database writes. The boundary is the persisted data model, never an import from a private package.

```text
Private operations                         Public portfolio/runtime

provider-specific adapters                 Next.js dashboard
browser/session handling       writes      read-only SQL
scheduled normalization       ------->     bounded research API
provenance capture                         policy/rate/concurrency controls
database migrations                        synthetic provider contract tests
```

The live scheduler stays on the complete private checkout. It is not a serverless route and cannot be invoked from the public application.

## Trust boundaries

1. Source responses are untrusted and normalized privately.
2. Identity requires an address/postcode/date/price tuple plus a provider reference where available.
3. Asking-price observations after completion are excluded from the comparison.
4. Each retained attribute and price event carries provenance and an observation timestamp.
5. Implausible margins are quarantined instead of displayed as verified.
6. Public runtime code has a single database configuration name: `DATABASE_READ_URL`.
7. The aggregate research API queries one security-barrier view with fixed SQL and bounded inputs.

## Reduced research surface

The isolated research API returns aggregate counts and sold-price statistics for allowlisted outcodes, years and property types. It does not return an address, unit postcode, source URL, provider identifier, raw row, arbitrary SQL result or arbitrary storage object. The route is disabled by default and fails closed when its dedicated reader is absent.

## Operational evidence boundary

This repository demonstrates the application, analytical read path, policy controls and provider-neutral contracts. It does not prove that the public Git repository is the source of the current Vercel deployment, nor that a production credential is least-privilege. Those are runtime claims requiring separate provider evidence.
