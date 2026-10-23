# Research read boundary

Status: approved for local Phase 1 Gate 2 implementation only. Public release,
production database changes and credential issuance require separate approval.

## Capability and data minimisation

`market_summary` will answer aggregate questions for `ALL`, `E10`, `E11` and
`E17` over a bounded year range and optional Land Registry property type. The
internal `research.market_summary_source` view retains only the fields needed
to calculate exact counts, averages and medians:

| Field | Source or derivation | Why retained | Public response |
|---|---|---|---|
| `area` | Outcode derived from the Price Paid Data postcode | Allowlisted geographic grouping | Yes |
| `sale_year` | Year derived from transfer date | Bounded period filtering | Returned only as requested start/end years |
| `property_type` | HM Land Registry property-type code | Optional allowlisted grouping | Yes |
| `sold_price` | HM Land Registry price | Aggregate count, average and median | Aggregates only |
| `data_refreshed_at` | Latest import time among included records | Data-currency disclosure | Yes |

The view excludes addresses, full postcodes, transaction identifiers, URLs,
coordinates, listing prices, Rightmove identifiers, scraper metadata and raw
source rows. It is an internal query source, not a public bulk-download or SQL
surface.

The initial population is limited to E10, E11 and E17; Category A, freehold
transactions; property types D, S, T and F; dates from 1995; and records not
classified as market-price outliers. These filters follow the current Proply
summary population and are a product definition, not a claim that excluded
transactions are invalid.

## Rights and attribution

The source is HM Land Registry Price Paid Data, published for commercial and
non-commercial reuse under the Open Government Licence v3.0. The official
dataset page requires this attribution:

> Contains HM Land Registry data © Crown copyright and database right 2021.
> This data is licensed under the Open Government Licence v3.0.

Sources:

- <https://www.gov.uk/government/statistical-data-sets/price-paid-data-downloads>
- <https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/>

HM Land Registry states that the OGL does not license third-party address
rights and describes specific permitted uses of that address data. Gate 2
therefore excludes all address fields: they are unnecessary for an aggregate
market-summary capability and excluding them materially reduces rights,
privacy and re-identification risk. A later decision to expose address-level
data would require a fresh rights and product review.

## Accuracy and permitted-use notes

Every public response must carry the attribution and state that Price Paid Data
covers transactions sold for value and lodged for registration, recent periods
can be incomplete because of registration lag, and HM Land Registry does not
guarantee that the data is error-free or fit for a particular purpose. Results
are descriptive aggregates, not valuations, financial advice or evidence of a
specific property's current value.

## Database security contract

The provisioning script creates `proply_research_reader` as a no-login role.
It grants only database `CONNECT`, `USAGE` on the `research` schema and `SELECT`
on `research.market_summary_source`. It removes direct privileges on current
public/research tables, sequences and functions, applies conservative session
defaults, and leaves credential creation outside source control.

The production operator must separately create or enable a dedicated login,
store its secret in the approved platform, and set only `DATABASE_READ_URL` for
the new route. The route must not fall back to `DATABASE_URL`, an unpooled URL,
or an updater credential. The existing dashboard fallbacks are unchanged in
Gate 2 and are not approved for the new capability.
