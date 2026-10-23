const millisecondsPerDay = 86_400_000;

export function listingPriceEvent(previousPrice, currentPrice) {
  if (currentPrice == null) return null;
  if (previousPrice == null) return 'listed';
  if (currentPrice < previousPrice) return 'reduced';
  if (currentPrice > previousPrice) return 'increased';
  return 'observed';
}

export function listingNeedsDetail(previous, listing, now = new Date(), refreshDays = 30) {
  if (!previous || !previous.tenure_verified) return true;
  if (!previous.last_detail_checked_at) return true;
  if (previous.property_type !== listing.propertyType || Number(previous.bedrooms) !== listing.bedrooms) {
    return true;
  }
  const lastChecked = new Date(previous.last_detail_checked_at);
  return !Number.isFinite(lastChecked.getTime()) ||
    now.getTime() - lastChecked.getTime() >= refreshDays * millisecondsPerDay;
}

export function activePageCount(totalResults, pageSize = 24, hardCap = 20, configuredLimit = 0) {
  const required = Math.max(1, Math.ceil(Math.max(0, totalResults) / pageSize));
  return Math.min(required, hardCap, configuredLimit > 0 ? configuredLimit : Number.POSITIVE_INFINITY);
}
