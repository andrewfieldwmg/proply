# Research market-summary API

`GET /api/research/market-summary` is the only Phase 1 research capability. It
is a deterministic aggregate service, not an LLM or MCP endpoint.

Required query parameters are `area`, `start_year` and `end_year`; optional
`property_type` defaults to `ALL`. Areas are `ALL`, `E10`, `E11` or `E17`.
Property types are `ALL`, `D`, `S`, `T` or `F`. Years run from 1995 through the
current UTC year and a request may cover at most ten calendar years. Unknown or
duplicate parameters are rejected.

When enabled, the route first requires an exact bearer credential backed only by
the server-side `RESEARCH_SERVICE_TOKEN`. Missing, malformed and invalid values
receive the same no-store 401 response before rate limiting or any database
operation. The token must not be supplied in the query string or logged.

The route also requires `DATABASE_READ_URL` and has no credential fallback. It
runs one fixed parameterized query against `research.market_summary_source`,
imposes a two-second dependency timeout and returns only counts, rounded average
and median prices, data currency, attribution and limitations. Public errors
contain a stable code and trace ID but never the database exception, query,
connection string or credential. Address, postcode-unit, URL, identifier,
Rightmove, scraper, raw-row, arbitrary SQL, S3 and MCP access are outside the
contract.

The authentication source change remains local and uncommitted. Credential
creation, environment configuration, feature enablement and deployment require
separate approval.
