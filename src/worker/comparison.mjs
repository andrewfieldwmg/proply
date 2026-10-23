export function askingPriceVerification(listingPrice, soldPrice, maximumAbsoluteMargin = 50) {
  const marginPercent = ((soldPrice - listingPrice) / listingPrice) * 100;
  const verified = Number.isFinite(marginPercent) && Math.abs(marginPercent) <= maximumAbsoluteMargin;
  return {
    verified,
    source: verified ? 'propertylog-earliest' : 'propertylog-outlier-review',
    marginPercent,
  };
}
