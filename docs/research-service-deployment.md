# Isolated research service deployment

The approved Phase 1 architecture packages the bounded research API as a
separate Vercel project while leaving the existing `proply` project and its
production alias unchanged. The service is the `apps/research-api` workspace;
the deterministic policy and request/result implementation live in the shared
`packages/research-core` workspace.

This document is configuration guidance, not deployment evidence or approval.

## Vercel project shape

- Import the same Git repository as a new, separately named project.
- Set **Root Directory** to `apps/research-api`.
- Keep **Include source files outside of the Root Directory in the Build Step**
  enabled so the explicitly declared `@proply/research-core` workspace is
  available. The function must not import the dashboard, listings or updater.
- Do not attach, transfer or modify the existing Proply production alias.
- Begin with a commit-specific Preview deployment. Do not create a production
  deployment or custom domain during Phase 1 preview proof.

## Environment boundary

The new project may receive only these application variables:

- `DATABASE_READ_URL`: the dedicated `proply_research_api` reduced-view login.
- `RESEARCH_SERVICE_TOKEN`: a separately generated service credential supplied
  only to the approved calling workload and this isolated server runtime.
- `RESEARCH_API_ENABLED=false`: the required initial state.

Do not connect the existing Neon integration or copy `DATABASE_URL`,
`DATABASE_URL_UNPOOLED`, updater credentials, AWS values or deployment hooks.
After the disabled 404 and effective database grants are verified, changing the
flag to `true` and creating a new Preview deployment requires separate approval.

## Provider controls

Before enabling the route, publish a Preview-scoped WAF rule for the exact
market-summary path, counted by provider-supplied client IP. Verify the actual
account's spend controls and automatic enforcement; a notification-only spend
threshold is insufficient. Keep deployment protection and log retention at the
smallest level compatible with the reviewed service-to-service preview.

## Approval and proof

Creating the project, changing environment variables, applying database SQL,
issuing a credential, changing WAF or spend settings, committing, pushing and
deploying are external actions. Each remains separately approved. Remote proof
must retain the source revision, project/deployment identifiers, non-secret
configuration shape, disabled and enabled smoke results, provider throttle
evidence and teardown outcome.

Use `docs/research-preview-runbook.md` for the full disabled-first verification
and teardown sequence.
