# Controlled research preview runbook

This runbook applies only to a Vercel preview deployment of the bounded
`GET /api/research/market-summary` capability. It does not authorise a change.
Every database DDL operation, credential action, Vercel environment mutation,
WAF publication, spend-control change, commit, push and deployment requires
separate explicit approval. Never change the production alias during this gate.

## Controls present in source

- `RESEARCH_API_ENABLED` must equal the exact string `true`; absence or any
  other value returns a traced 404 before database access.
- `DATABASE_READ_URL` is the only accepted database variable. There is no
  fallback to generic Neon or updater credentials.
- `RESEARCH_SERVICE_TOKEN` is the only accepted request credential. Missing,
  malformed and invalid bearer values fail identically before rate limiting,
  database configuration, concurrency or query execution.
- The handler allows five requests per ten-second burst and thirty per minute
  for a bounded Vercel forwarding-header key. It retains at most 1,000 keys.
- Four aggregate queries may be active in one function instance. The database
  query aborts after two seconds and the Vercel function ceiling is five seconds.
- Successful deterministic responses may be cached by Vercel for five minutes,
  with one minute of stale-while-revalidate. Browser responses revalidate.
  Errors, disabled responses and denials are always `no-store`.

The rate and concurrency controls in application memory are **per-instance**.
They bound one Fluid Compute process but do not provide a deployment-wide limit.
A provider-level Vercel WAF rule is therefore a release blocker, not an optional
replacement.

## Pre-deployment approval packet

Before any external write, record approval for this exact set:

1. Apply `001_reduced_read_model.sql` and `002_preview_reader.sql` to the
   selected Neon target using an approved administrative session.
2. Issue a fresh password interactively for `proply_research_api`, then enable
   login only after its effective grants and denied operations pass. Never put
   the password in a command, transcript, source file or evidence artifact.
3. Issue a fresh service credential through an approved secret-handling path,
   give it only to the approved caller, and add preview-only
   `RESEARCH_SERVICE_TOKEN` and `DATABASE_READ_URL`. Initially set preview-only
   `RESEARCH_API_ENABLED=false` in Vercel. Do not retain the value in evidence.
4. Commit and push the reviewed source or deploy the exact reviewed revision to
   a Vercel preview URL. Do not promote it or change the production alias.
5. Publish a WAF rate rule scoped to the market-summary path and Preview
   environment, counted by IP. Start with five requests per ten seconds.
6. Confirm the account's spend protection before enabling the route. On plans
   with Spend Management, configure a reviewed amount and automatic pause.
   Where that feature is unavailable, document and verify the provider's actual
   hard usage boundary; an assumed free-tier limit is not evidence.

The initial deployment remains disabled. Verify its 404 response, absence of
database calls, source revision and preview-only environment scope before a
separately approved change sets `RESEARCH_API_ENABLED=true` and creates a new
preview deployment.

## Remote verification

Run only against the commit-specific preview URL:

- Missing and invalid bearer credentials return the same no-store 401 and do
  not reach rate limiting or the database.
- A valid authenticated aggregate request returns 200 with approved fields, attribution,
  limitations, data currency, cache policy and a trace ID.
- Unknown fields, injection-shaped input and oversized input return safe 400 or
  413 responses without query or credential detail.
- A controlled burst reaches a bounded 429 response and the WAF observation
  confirms that the provider rule, not only the per-instance limiter, fired.
- Concurrent delayed requests cannot exceed the application and database
  ceilings. Do not manufacture a delay against production data; use a reviewed
  preview-safe method or retain the local deterministic concurrency proof.
- The login can select only the reduced view. Base-table reads, writes and
  schema creation remain denied. Never send a write probe to a production table.
- The public page, health route and existing deterministic dashboard remain
  unchanged. Inspect public errors and build output for secrets.

## Disable and teardown

For immediate preview disablement, delete or block the preview deployment. The
environment feature flag is disabled by default but changing it affects only a
new deployment. Then, under separate explicit approval:

1. Set `RESEARCH_API_ENABLED=false` for preview and deploy that state if the
   preview URL must remain available.
2. Remove preview-only `RESEARCH_SERVICE_TOKEN`, `DATABASE_READ_URL` and the
   preview WAF rule; revoke or rotate the caller's corresponding credential.
3. Run `ALTER ROLE proply_research_api NOLOGIN` through an approved secure
   database session and verify login failure. Revoke or rotate its credential.
4. Remove the preview deployment and confirm that its URL no longer serves the
   capability.
5. Remove the role or view only after confirming that nothing else depends on
   them; deletion is destructive and requires its own approval.

Retain deployment identifiers, exact source revision, non-secret configuration
shape, timestamps, smoke results and teardown results. Do not retain secrets,
raw property rows, IP addresses or encrypted environment values.
