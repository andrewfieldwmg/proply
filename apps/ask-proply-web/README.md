# Ask Proply web

This directory is the dedicated Vercel project root for the public Ask Proply experience. It contains the browser UI and a same-origin backend-for-frontend (BFF). The BFF is the only component in this project permitted to call the governed AWS research API.

## Production boundary

The browser sends a bounded `{ "question": string }` request to `/api/research`. The BFF:

- rejects requests that do not carry the exact configured origin and browser same-origin metadata;
- accepts the live path only when `ASK_PROPLY_LIVE_ENABLED` is exactly `true`;
- obtains short-lived AWS credentials from the Vercel workload identity token and an exact, least-privilege AWS role;
- signs one `POST /v1/research` request with AWS Signature Version 4;
- performs zero provider retries, rejects redirects and enforces a 29-second timeout;
- rejects an upstream response larger than 32 KiB;
- validates and reduces the upstream response before returning it to the browser; and
- logs only a generated request identifier, response status, duration and whether the live path was enabled.

It contains no database client, model-provider SDK, static AWS access key, Proply service credential or producer credential. The AWS control plane continues to own policy, model and tool-call limits, evidence validation, alarms and spend controls.

Local development uses synthetic evidence only when the live flag is absent and `NODE_ENV=development`. Production is fail-closed: a missing or false live flag returns an unavailable response and never silently falls back to synthetic data.

## Required release configuration

Create a dedicated Vercel project with this directory as its root and configure the names in `.env.example`. Do not store `VERCEL_OIDC_TOKEN`; Vercel supplies and rotates that workload identity token. The AWS role trust policy must bind the Vercel issuer, audience and exact project/environment subject, and its permissions must allow only invocation of the reviewed research route.

Set the Vercel function region to London (`lhr1`) in the project configuration. Region placement is deliberately not embedded in route source because the pinned Next.js version has deprecated route-level `preferredRegion`.

Before assigning a public production domain:

1. keep the first deployment protected and `ASK_PROPLY_LIVE_ENABLED=false`;
2. verify the source revision, dependency audit, security headers and disabled response;
3. review the exact Vercel workload-identity subject and AWS role policy;
4. enable the live flag in a protected Preview and run one budget-bound research case;
5. verify trace counts, model/tool ceilings, Proply citation, alarms and absence of secret material in logs; and
6. promote that exact deployment only after the human release gate.

Vercel deployment protection, platform rate limiting or WAF rules, analytics retention and the final public-domain policy are cloud configuration and are deliberately not asserted by this source tree.

## Verification

From the Proply repository root:

```powershell
node --test scripts/lib/dedicated-ask-proply-site.test.mjs scripts/lib/proply-production-bff.test.mjs
npm --workspace @proply/ask-proply-web run check
npm --workspace @proply/ask-proply-web run build
npm audit --omit=dev
```
