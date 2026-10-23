'use client';

import { useEffect, useRef } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import type { SoldMapPoint } from '@/lib/dashboard';

const money = new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', maximumFractionDigits: 0,
});

function markerColour(margin: number | null) {
  if (margin == null) return '#637168';
  if (margin > 1) return '#275f47';
  if (margin < -1) return '#b8563f';
  return '#a2872f';
}

function popup(point: SoldMapPoint) {
  const root = document.createElement('div');
  root.className = 'map-popup';
  if (point.thumbnailUrl) {
    const image = document.createElement('img');
    image.src = point.thumbnailUrl;
    image.alt = '';
    image.referrerPolicy = 'no-referrer';
    root.append(image);
  }
  const heading = document.createElement('strong');
  heading.textContent = point.address;
  root.append(heading);
  const meta = document.createElement('span');
  meta.textContent = [point.postcode, point.bedrooms == null ? null
    : point.bedroomsEstimated
      ? `likely ${point.bedrooms} beds (estimated ${point.bedroomEstimateLow}–${point.bedroomEstimateHigh})`
      : `${point.bedrooms} beds`]
    .filter(Boolean).join(' · ');
  root.append(meta);
  const prices = document.createElement('span');
  prices.textContent = `Sold ${money.format(point.soldPrice)}` +
    (point.listingPrice == null ? '' : ` · ask ${money.format(point.listingPrice)}`) +
    (point.differencePercent == null ? '' : ` · ${point.differencePercent > 0 ? '+' : ''}${point.differencePercent.toFixed(1)}%`);
  root.append(prices);
  if (point.floorAreaSqm != null) {
    const area = document.createElement('span');
    area.textContent = `${Math.round(point.floorAreaSqm)} m²${point.floorAreaSource === 'epc_exact_match' ? ' EPC' : ''}` +
      (point.pricePerSqm == null ? '' : ` · ${money.format(point.pricePerSqm)}/m²`);
    root.append(area);
  }
  if (point.gardenAreaSqm != null) {
    const garden = document.createElement('span');
    garden.textContent = `Garden ${Math.round(point.gardenAreaSqm)} m²`;
    garden.title = `Property-level measurement from ${point.gardenAreaSource || 'verified title-boundary intersection'}.`;
    root.append(garden);
  } else if (point.gardenContextMedianSqm != null) {
    const garden = document.createElement('span');
    const range = point.gardenContextP25Sqm == null || point.gardenContextP75Sqm == null
      ? '' : ` · middle 50% ${Math.round(point.gardenContextP25Sqm)}–${Math.round(point.gardenContextP75Sqm)} m²`;
    garden.textContent = `Street garden median ~${Math.round(point.gardenContextMedianSqm)} m²${range}`;
    garden.title = `Context from ${point.gardenContextCount || 0} OS NGD garden polygons; not this property's measured garden.`;
    root.append(garden);
  }
  if (point.soldOverviewUrl) {
    const link = document.createElement('a');
    link.href = point.soldOverviewUrl;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = 'Open Rightmove sold page';
    root.append(link);
  }
  return root;
}

export default function SoldMap({ points }: { points: SoldMapPoint[] }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;
    let disposed = false;
    let map: LeafletMap | null = null;
    void import('leaflet').then(({ default: L }) => {
      if (disposed || !container.current) return;
      map = L.map(container.current, { preferCanvas: true, zoomControl: true })
        .setView([51.575, -0.035], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const bounds = L.latLngBounds([]);
      for (const point of points) {
        if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) continue;
        const position = L.latLng(point.latitude, point.longitude);
        bounds.extend(position);
        L.circleMarker(position, {
          radius: 6,
          color: '#fbfaf5',
          weight: 1.5,
          fillColor: markerColour(point.differencePercent),
          fillOpacity: .9,
        }).bindPopup(() => popup(point), { maxWidth: 300 }).addTo(map);
      }
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
      window.setTimeout(() => map?.invalidateSize(), 0);
    });
    return () => {
      disposed = true;
      map?.remove();
    };
  }, [points]);

  return <div className="sold-map-canvas" ref={container} aria-label="Map of filtered sold properties" />;
}
