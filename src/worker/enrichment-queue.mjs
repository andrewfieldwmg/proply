export function retryDelayDays(attempts) {
  const normalized = Math.max(1, Number(attempts) || 1);
  return Math.min(30, 2 ** Math.min(normalized - 1, 5));
}

export function nextAttemptDate(days, now = new Date()) {
  return new Date(now.getTime() + Math.max(0, days) * 86_400_000);
}

export function incrementalPageReachedWatermark(resultCount, knownCount) {
  return resultCount > 0 && knownCount === resultCount;
}
