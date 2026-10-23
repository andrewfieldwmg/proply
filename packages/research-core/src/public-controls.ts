export type RateLimitDecision =
  | { allowed: true }
  | { allowed: false; reason: 'burst_limit' | 'sustained_limit'; retryAfterSeconds: number };

type WindowLimit = {
  limit: number;
  windowMs: number;
};

type RateLimiterOptions = {
  now?: () => number;
  burst: WindowLimit;
  sustained: WindowLimit;
  maxKeys: number;
};

type Bucket = {
  burstStartedAt: number;
  burstCount: number;
  sustainedStartedAt: number;
  sustainedCount: number;
  lastSeenAt: number;
};

function assertWindow(name: string, value: WindowLimit) {
  if (!Number.isSafeInteger(value.limit) || value.limit < 1) {
    throw new Error(`${name}_limit_must_be_positive`);
  }
  if (!Number.isSafeInteger(value.windowMs) || value.windowMs < 1) {
    throw new Error(`${name}_window_must_be_positive`);
  }
}

function resetWindow(now: number, startedAt: number, windowMs: number) {
  return now < startedAt || now - startedAt >= windowMs;
}

function retryAfterSeconds(now: number, startedAt: number, windowMs: number) {
  return Math.max(1, Math.ceil((startedAt + windowMs - now) / 1_000));
}

export function createRateLimiter(options: RateLimiterOptions) {
  assertWindow('burst', options.burst);
  assertWindow('sustained', options.sustained);
  if (!Number.isSafeInteger(options.maxKeys) || options.maxKeys < 1) {
    throw new Error('max_keys_must_be_positive');
  }

  const now = options.now ?? Date.now;
  const buckets = new Map<string, Bucket>();

  function evictOldestKey() {
    let oldestKey: string | undefined;
    let oldestSeen = Number.POSITIVE_INFINITY;
    for (const [key, bucket] of buckets) {
      if (bucket.lastSeenAt < oldestSeen) {
        oldestKey = key;
        oldestSeen = bucket.lastSeenAt;
      }
    }
    if (oldestKey != null) buckets.delete(oldestKey);
  }

  return {
    check(key: string): RateLimitDecision {
      const checkedAt = now();
      let bucket = buckets.get(key);
      if (!bucket) {
        if (buckets.size >= options.maxKeys) evictOldestKey();
        bucket = {
          burstStartedAt: checkedAt,
          burstCount: 0,
          sustainedStartedAt: checkedAt,
          sustainedCount: 0,
          lastSeenAt: checkedAt,
        };
        buckets.set(key, bucket);
      }

      if (resetWindow(checkedAt, bucket.burstStartedAt, options.burst.windowMs)) {
        bucket.burstStartedAt = checkedAt;
        bucket.burstCount = 0;
      }
      if (resetWindow(checkedAt, bucket.sustainedStartedAt, options.sustained.windowMs)) {
        bucket.sustainedStartedAt = checkedAt;
        bucket.sustainedCount = 0;
      }
      bucket.lastSeenAt = checkedAt;

      if (bucket.burstCount >= options.burst.limit) {
        return {
          allowed: false,
          reason: 'burst_limit',
          retryAfterSeconds: retryAfterSeconds(
            checkedAt,
            bucket.burstStartedAt,
            options.burst.windowMs,
          ),
        };
      }
      if (bucket.sustainedCount >= options.sustained.limit) {
        return {
          allowed: false,
          reason: 'sustained_limit',
          retryAfterSeconds: retryAfterSeconds(
            checkedAt,
            bucket.sustainedStartedAt,
            options.sustained.windowMs,
          ),
        };
      }

      bucket.burstCount += 1;
      bucket.sustainedCount += 1;
      return { allowed: true };
    },
    retainedKeys() {
      return buckets.size;
    },
  };
}

export function createConcurrencyGate(limit: number) {
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new Error('concurrency_limit_must_be_positive');
  }
  let active = 0;

  return {
    acquire(): (() => void) | null {
      if (active >= limit) return null;
      active += 1;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        active -= 1;
      };
    },
    activeCount() {
      return active;
    },
  };
}

export function getClientKey(request: Request) {
  const forwarded = request.headers.get('x-vercel-forwarded-for')
    ?? request.headers.get('x-forwarded-for')
    ?? 'unknown';
  return (forwarded.split(',', 1)[0]?.trim() || 'unknown').slice(0, 128);
}
