import { createAskProplyHandler, syntheticResearch } from '@/lib/ask-proply';
import { liveResearchFromEnvironment, verifyBrowserRequest } from '@/lib/control-plane';

export const dynamic = 'force-dynamic';
export const maxDuration = 40;
export const runtime = 'nodejs';

function selectedResearch() {
  if (process.env.ASK_PROPLY_LIVE_ENABLED === 'true') {
    try {
      return liveResearchFromEnvironment();
    } catch {
      return async () => { throw new Error('control_plane_unavailable'); };
    }
  }
  if (process.env.NODE_ENV === 'development' && process.env.ASK_PROPLY_LIVE_ENABLED == null) {
    return syntheticResearch;
  }
  return async () => { throw new Error('research_disabled'); };
}

function publicResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
      'x-content-type-options': 'nosniff',
    },
  });
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  let response: Response;

  if (!verifyBrowserRequest(request, process.env)) {
    response = publicResponse(403, {
      ok: false,
      status: 'outside_scope',
      data_mode: 'synthetic_preview',
      message: 'Use the Ask Proply page to submit a research question.',
    });
  } else {
    response = await createAskProplyHandler({ research: selectedResearch() })(request);
  }

  response.headers.set('x-ask-proply-request-id', requestId);
  console.info(JSON.stringify({
    event: 'ask_proply_request',
    request_id: requestId,
    status: response.status,
    duration_ms: Date.now() - startedAt,
    live_enabled: process.env.ASK_PROPLY_LIVE_ENABLED === 'true',
  }));
  return response;
}
