import { createHash, timingSafeEqual } from 'node:crypto';

const MINIMUM_TOKEN_LENGTH = 32;
const MAXIMUM_TOKEN_LENGTH = 512;
const SAFE_TOKEN = /^[\x21-\x7e]+$/;

function isSafeToken(value: string): boolean {
  return value.length >= MINIMUM_TOKEN_LENGTH
    && value.length <= MAXIMUM_TOKEN_LENGTH
    && SAFE_TOKEN.test(value);
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

export function verifyServiceBearer(
  authorizationHeader: string | null,
  configuredToken: string | undefined,
): boolean {
  if (!configuredToken || !isSafeToken(configuredToken) || authorizationHeader == null) {
    return false;
  }

  const match = /^Bearer ([^\s,]+)$/.exec(authorizationHeader);
  if (!match || !isSafeToken(match[1])) return false;

  return timingSafeEqual(digest(match[1]), digest(configuredToken));
}
