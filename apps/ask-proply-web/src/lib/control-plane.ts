import { Sha256 } from '@aws-crypto/sha256-js';
import { HttpRequest } from '@smithy/protocol-http';
import { SignatureV4 } from '@smithy/signature-v4';
import { awsCredentialsProvider } from '@vercel/oidc-aws-credentials-provider';

import {
  adaptControlPlaneResult,
  AskProplyPolicyError,
  type AskProplyEnvelope,
  type AskProplyResearch,
} from './ask-proply.ts';

export const CONTROL_PLANE_MAX_RESPONSE_BYTES = 32_768;
export const CONTROL_PLANE_TIMEOUT_MS = 29_000;

type Environment = Record<string, string | undefined>;
type Transport = (url: string, init: RequestInit) => Promise<Response>;
type Sign = (input: { url: string; body: string }) => Promise<Record<string, string>>;

export interface ControlPlaneConfig {
  url: string;
  region: 'eu-west-2';
  roleArn: string;
}

function configurationError(): never {
  throw new Error('invalid_control_plane_configuration');
}

function exactHttpsUrl(value: string | undefined, pathname: string) {
  if (value == null) configurationError();
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    configurationError();
  }
  if (
    parsed.protocol !== 'https:'
    || parsed.username !== ''
    || parsed.password !== ''
    || parsed.port !== ''
    || parsed.search !== ''
    || parsed.hash !== ''
    || parsed.pathname !== pathname
    || parsed.hostname.length > 253
    || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(parsed.hostname)
  ) configurationError();
  return parsed;
}

export function loadControlPlaneConfig(environment: Environment): ControlPlaneConfig {
  const endpoint = exactHttpsUrl(environment.ASK_PROPLY_CONTROL_PLANE_URL, '/v1/research');
  const region = environment.AWS_REGION;
  const roleArn = environment.AWS_ROLE_ARN;
  if (
    region !== 'eu-west-2'
    || roleArn == null
    || !/^arn:aws:iam::[0-9]{12}:role\/[A-Za-z0-9+=,.@_\/-]{1,512}$/.test(roleArn)
  ) configurationError();
  return { url: endpoint.toString(), region, roleArn };
}

function expectedPublicOrigin(environment: Environment) {
  const explicit = environment.ASK_PROPLY_PUBLIC_ORIGIN;
  const candidate = explicit ?? (environment.VERCEL_URL == null ? undefined : `https://${environment.VERCEL_URL}`);
  if (candidate == null) return null;
  try {
    const parsed = new URL(candidate);
    if (
      parsed.protocol !== 'https:'
      || parsed.username !== ''
      || parsed.password !== ''
      || parsed.port !== ''
      || parsed.pathname !== '/'
      || parsed.search !== ''
      || parsed.hash !== ''
    ) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function verifyBrowserRequest(request: Request, environment: Environment) {
  const expectedOrigin = expectedPublicOrigin(environment);
  return expectedOrigin != null
    && request.headers.get('origin') === expectedOrigin
    && request.headers.get('sec-fetch-site') === 'same-origin';
}

async function defaultSign(config: ControlPlaneConfig, body: string) {
  const endpoint = new URL(config.url);
  const signer = new SignatureV4({
    credentials: awsCredentialsProvider({
      roleArn: config.roleArn,
      roleSessionName: 'ask-proply-web',
      durationSeconds: 900,
      clientConfig: { region: config.region },
    }),
    region: config.region,
    service: 'execute-api',
    sha256: Sha256,
  });
  const signed = await signer.sign(new HttpRequest({
    protocol: endpoint.protocol,
    hostname: endpoint.hostname,
    method: 'POST',
    path: endpoint.pathname,
    headers: {
      host: endpoint.hostname,
      'content-type': 'application/json',
    },
    body,
  }));
  return Object.fromEntries(
    Object.entries(signed.headers).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}

function unavailable(): never {
  throw new Error('control_plane_unavailable');
}

export function createControlPlaneResearch({
  config,
  sign = ({ body }) => defaultSign(config, body),
  transport = fetch,
}: {
  config: ControlPlaneConfig;
  sign?: Sign;
  transport?: Transport;
}): AskProplyResearch {
  return async function research(question: string): Promise<AskProplyEnvelope> {
    const body = JSON.stringify({ question });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONTROL_PLANE_TIMEOUT_MS);
    let stage = 'sign';
    try {
      const signedHeaders = await sign({ url: config.url, body });
      stage = 'request';
      const response = await transport(config.url, {
        method: 'POST',
        headers: { ...signedHeaders, 'content-type': 'application/json' },
        body,
        cache: 'no-store',
        redirect: 'error',
        signal: controller.signal,
      });
      if (response.status === 429) {
        return {
          ok: false,
          status: 'rate_limited',
          data_mode: 'synthetic_preview',
          message: 'The research service is busy. Please wait before trying again.',
          retry_after_seconds: 60,
        };
      }
      stage = 'status';
      if (response.status !== 200) unavailable();
      const declaredLength = Number(response.headers.get('content-length') ?? 0);
      stage = 'response_size';
      if (declaredLength > CONTROL_PLANE_MAX_RESPONSE_BYTES) unavailable();
      stage = 'response_read';
      const raw = await response.text();
      if (new TextEncoder().encode(raw).byteLength > CONTROL_PLANE_MAX_RESPONSE_BYTES) unavailable();
      let decoded: unknown;
      try {
        stage = 'response_json';
        decoded = JSON.parse(raw);
      } catch {
        unavailable();
      }
      stage = 'response_contract';
      return adaptControlPlaneResult(decoded);
    } catch (error) {
      console.info(JSON.stringify({
        event: 'ask_proply_upstream_rejected',
        stage,
        validation_code: error instanceof AskProplyPolicyError
          ? error.diagnosticCode ?? 'unclassified'
          : null,
        content_logged: false,
      }));
      unavailable();
    } finally {
      clearTimeout(timeout);
    }
  };
}

export function liveResearchFromEnvironment(environment: Environment = process.env) {
  return createControlPlaneResearch({ config: loadControlPlaneConfig(environment) });
}
