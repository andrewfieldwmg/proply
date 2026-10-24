export const ASK_PROPLY_MAX_BODY_BYTES = 2_048;
export const ASK_PROPLY_MAX_QUESTION_CHARS = 500;

export type AskProplyStatus =
  | 'grounded'
  | 'abstained'
  | 'outside_scope'
  | 'rate_limited'
  | 'unavailable';

export type AskProplyFailureStatus = Exclude<AskProplyStatus, 'grounded'>;
export type AskProplyDataMode = 'synthetic_preview' | 'proply_https';

export interface AskProplyRequest {
  question: string;
}

export interface AskProplyEvidence {
  citation_id: string;
  area: 'ALL' | 'E10' | 'E11' | 'E17';
  property_type: 'ALL' | 'D' | 'S' | 'T' | 'F';
  period: {
    start_year: number;
    end_year: number;
  };
  transaction_count: number;
  average_sold_price_gbp: number | null;
  median_sold_price_gbp: number | null;
  source: {
    name: 'Proply' | 'Synthetic fixture';
    refreshed_at: string | null;
    attribution: {
      statement: string;
      licence_name: string;
      licence_url: string | null;
    };
  };
  limitations: string[];
}

export interface AskProplyGroundedEnvelope {
  ok: true;
  status: 'grounded';
  data_mode: AskProplyDataMode;
  answer: string;
  citations: string[];
  evidence: AskProplyEvidence[];
  execution: Array<
    'request_checked'
    | 'plan_bounded'
    | 'evidence_retrieved'
    | 'answer_validated'
  >;
}

export interface AskProplyFailureEnvelope {
  ok: false;
  status: AskProplyFailureStatus;
  data_mode: 'synthetic_preview';
  message: string;
  retry_after_seconds?: number;
}

export type AskProplyEnvelope = AskProplyGroundedEnvelope | AskProplyFailureEnvelope;
export type AskProplyResearch = (question: string) => Promise<AskProplyEnvelope>;

export class AskProplyPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AskProplyPolicyError';
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function boundedString(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum;
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isEvidence(value: unknown, dataMode: AskProplyDataMode): value is AskProplyEvidence {
  const evidence = asRecord(value);
  const period = asRecord(evidence?.period);
  const source = asRecord(evidence?.source);
  const attribution = asRecord(source?.attribution);
  const expectedSource = dataMode === 'proply_https' ? 'Proply' : 'Synthetic fixture';
  const licenceUrl = attribution?.licence_url;
  const refreshedAt = source?.refreshed_at;
  const average = evidence?.average_sold_price_gbp;
  const median = evidence?.median_sold_price_gbp;

  return evidence != null
    && boundedString(evidence.citation_id, 256)
    && ['ALL', 'E10', 'E11', 'E17'].includes(String(evidence.area))
    && ['ALL', 'D', 'S', 'T', 'F'].includes(String(evidence.property_type))
    && period != null
    && nonNegativeInteger(period.start_year)
    && nonNegativeInteger(period.end_year)
    && Number(period.start_year) >= 1900
    && Number(period.start_year) <= Number(period.end_year)
    && Number(period.end_year) <= 2200
    && nonNegativeInteger(evidence.transaction_count)
    && (average === null || nonNegativeInteger(average))
    && (median === null || nonNegativeInteger(median))
    && (Number(evidence.transaction_count) === 0 || (average !== null && median !== null))
    && source != null
    && source.name === expectedSource
    && (refreshedAt === null || boundedString(refreshedAt, 64))
    && attribution != null
    && boundedString(attribution.statement, 500)
    && boundedString(attribution.licence_name, 160)
    && (
      licenceUrl === null
      || (boundedString(licenceUrl, 500) && licenceUrl.startsWith('https://'))
    )
    && Array.isArray(evidence.limitations)
    && evidence.limitations.length >= 1
    && evidence.limitations.length <= 10
    && evidence.limitations.every((item) => boundedString(item, 500));
}

export function adaptControlPlaneResult(value: unknown): AskProplyGroundedEnvelope {
  const record = asRecord(value);
  const upstreamMode = record?.data_mode;
  const dataMode: AskProplyDataMode | null = upstreamMode === 'proply_https'
    ? 'proply_https'
    : upstreamMode === 'synthetic_only'
      ? 'synthetic_preview'
      : null;
  const citations = record?.citations;
  const evidence = record?.evidence;

  if (
    record == null
    || dataMode == null
    || record.abstained !== false
    || !boundedString(record.answer, 16_384)
    || !Array.isArray(citations)
    || citations.length < 1
    || citations.length > 2
    || !citations.every((item) => boundedString(item, 256))
    || new Set(citations).size !== citations.length
    || !Array.isArray(evidence)
    || evidence.length < 1
    || evidence.length > 2
    || !evidence.every((item) => isEvidence(item, dataMode))
  ) {
    throw new AskProplyPolicyError('invalid_control_plane_result');
  }

  const evidenceIds = new Set(evidence.map((item) => item.citation_id));
  if (
    evidenceIds.size !== evidence.length
    || evidenceIds.size !== citations.length
    || !citations.every((citation) => evidenceIds.has(citation))
  ) {
    throw new AskProplyPolicyError('invalid_control_plane_result');
  }

  return {
    ok: true,
    status: 'grounded',
    data_mode: dataMode,
    answer: record.answer,
    citations: [...citations],
    evidence: evidence.map((item) => ({
      ...item,
      period: { ...item.period },
      source: {
        ...item.source,
        attribution: { ...item.source.attribution },
      },
      limitations: [...item.limitations],
    })),
    execution: [
      'request_checked',
      'plan_bounded',
      'evidence_retrieved',
      'answer_validated',
    ],
  };
}

function topLevelObjectKeys(raw: string) {
  const keys: string[] = [];
  let depth = 0;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (char === '{' || char === '[') {
      depth += 1;
      continue;
    }
    if (char === '}' || char === ']') {
      depth -= 1;
      continue;
    }
    if (char !== '"') continue;

    const start = index;
    index += 1;
    while (index < raw.length) {
      if (raw[index] === '\\') {
        index += 2;
        continue;
      }
      if (raw[index] === '"') break;
      index += 1;
    }
    if (index >= raw.length) break;

    let next = index + 1;
    while (/\s/.test(raw[next] ?? '')) next += 1;
    if (depth === 1 && raw[next] === ':') {
      keys.push(JSON.parse(raw.slice(start, index + 1)) as string);
    }
  }

  return keys;
}

export function parseAskProplyBody(raw: string): AskProplyRequest {
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    throw new AskProplyPolicyError('invalid_request');
  }

  if (decoded == null || typeof decoded !== 'object' || Array.isArray(decoded)) {
    throw new AskProplyPolicyError('invalid_request');
  }

  const keys = topLevelObjectKeys(raw);
  if (keys.length !== 1 || keys[0] !== 'question') {
    throw new AskProplyPolicyError('invalid_request');
  }

  const question = (decoded as Record<string, unknown>).question;
  if (typeof question !== 'string') {
    throw new AskProplyPolicyError('invalid_request');
  }
  const normalized = question.trim();
  if (
    normalized.length === 0
    || normalized.length > ASK_PROPLY_MAX_QUESTION_CHARS
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(normalized)
  ) {
    throw new AskProplyPolicyError('invalid_request');
  }

  return { question: normalized };
}

function failure(
  status: AskProplyFailureStatus,
  message: string,
  retryAfterSeconds?: number,
): AskProplyFailureEnvelope {
  return {
    ok: false,
    status,
    message,
    data_mode: 'synthetic_preview',
    ...(retryAfterSeconds == null ? {} : { retry_after_seconds: retryAfterSeconds }),
  };
}

export function isAskProplyEnvelope(value: unknown): value is AskProplyEnvelope {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (!['synthetic_preview', 'proply_https'].includes(String(record.data_mode)) || typeof record.status !== 'string') return false;

  if (record.ok === false) {
    return ['abstained', 'outside_scope', 'rate_limited', 'unavailable'].includes(record.status)
      && typeof record.message === 'string'
      && record.message.length > 0
      && record.message.length <= 240;
  }

  if (record.ok !== true || record.status !== 'grounded') return false;
  const dataMode = record.data_mode as AskProplyDataMode;
  const citations = record.citations;
  const evidence = record.evidence;
  if (
    !Array.isArray(citations)
    || citations.length < 1
    || citations.length > 2
    || !citations.every((item) => boundedString(item, 256))
    || new Set(citations).size !== citations.length
    || !Array.isArray(evidence)
    || evidence.length < 1
    || evidence.length > 2
    || !evidence.every((item) => isEvidence(item, dataMode))
  ) return false;
  const typedEvidence = evidence as AskProplyEvidence[];

  return typeof record.answer === 'string'
    && record.answer.length > 0
    && record.answer.length <= 16_384
    && new Set(typedEvidence.map((item) => item.citation_id)).size === typedEvidence.length
    && citations.every((citation) => typedEvidence.some((item) => item.citation_id === citation))
    && Array.isArray(record.execution)
    && record.execution.join(',') === 'request_checked,plan_bounded,evidence_retrieved,answer_validated';
}

const httpStatus: Record<AskProplyStatus, number> = {
  grounded: 200,
  abstained: 200,
  outside_scope: 422,
  rate_limited: 429,
  unavailable: 503,
};

function jsonResponse(body: AskProplyEnvelope, status = httpStatus[body.status]) {
  const headers = new Headers({
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
  });
  if (body.status === 'rate_limited' && body.retry_after_seconds != null) {
    headers.set('retry-after', String(body.retry_after_seconds));
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export function createAskProplyHandler({
  research,
  maxBodyBytes = ASK_PROPLY_MAX_BODY_BYTES,
}: {
  research: AskProplyResearch;
  maxBodyBytes?: number;
}) {
  return async function handle(request: Request) {
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
      return jsonResponse(failure('outside_scope', 'Send one plain-language question as JSON.'), 415);
    }

    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > maxBodyBytes) {
      return jsonResponse(failure('outside_scope', 'The question is too large.'), 413);
    }

    let parsed: AskProplyRequest;
    try {
      parsed = parseAskProplyBody(raw);
    } catch {
      return jsonResponse(failure('outside_scope', 'Ask one question of up to 500 characters.'), 400);
    }

    try {
      const envelope = await research(parsed.question);
      if (!isAskProplyEnvelope(envelope)) throw new Error('invalid_research_envelope');
      return jsonResponse(envelope);
    } catch {
      return jsonResponse(failure('unavailable', 'Research is temporarily unavailable. Please try again later.'));
    }
  };
}

export async function syntheticResearch(_question: string): Promise<AskProplyEnvelope> {
  return adaptControlPlaneResult({
    answer: 'This synthetic result demonstrates how a governed Proply research brief will present a bounded conclusion alongside its evidence and limitations.',
    citations: ['proply:market-summary:E10:T:2020-2025'],
    evidence: [
      {
        citation_id: 'proply:market-summary:E10:T:2020-2025',
        area: 'E10',
        property_type: 'T',
        period: { start_year: 2020, end_year: 2025 },
        transaction_count: 128,
        average_sold_price_gbp: 515_000,
        median_sold_price_gbp: 505_000,
        source: {
          name: 'Synthetic fixture',
          refreshed_at: null,
          attribution: {
            statement: 'Synthetic deployment fixture; no source-data attribution applies.',
            licence_name: 'Not applicable',
            licence_url: null,
          },
        },
        limitations: [
          'Synthetic preview values are illustrative and are not live market evidence.',
          'Proply is research software, not a valuation, lending or investment recommendation.',
        ],
      },
    ],
    trace_id: 'synthetic-server-only',
    abstained: false,
    usage: { model_calls: 0, tool_calls: 1 },
    data_mode: 'synthetic_only',
  });
}
