'use client';

import { useCallback, useState } from 'react';
import { DEMO_ROUTES } from '@/data/demo-vessels';
import { APP_CONFIG } from '@/config/app';
import { normalizeVesselName } from '@/lib/vessel-display';
import type { Vessel } from '@/types/vessel';
import VesselCard from './VesselCard';
import LeafletMap from './LeafletMap';

function initialBearing(from: { lat: number; lon: number }, to: { lat: number; lon: number }): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitude1 = toRadians(from.lat);
  const latitude2 = toRadians(to.lat);
  const longitudeDifference = toRadians(to.lon - from.lon);
  const y = Math.sin(longitudeDifference) * Math.cos(latitude2);
  const x =
    Math.cos(latitude1) * Math.sin(latitude2) -
    Math.sin(latitude1) * Math.cos(latitude2) * Math.cos(longitudeDifference);

  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

export default function DemoMapClient() {
  const [vessels] = useState<Vessel[]>(() => {
    const timestamp = new Date().toISOString();

    return DEMO_ROUTES.map((route) => {
      const [firstPoint, secondPoint] = route.points;

      return {
        id: route.id,
        name: normalizeVesselName(route.name),
        lat: firstPoint.lat,
        lon: firstPoint.lon,
        speedKnots: route.speedKnots,
        courseDeg: initialBearing(firstPoint, secondPoint),
        timestamp,
        source: 'demo',
      };
    });
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const handleSelect = useCallback((id: string) => setSelectedId(id), []);
  const selectedVessel = vessels.find((vessel) => vessel.id === selectedId) ?? null;

  return (
    <>
      <p className="demo-data-label">Демонстраційні дані</p>
      {selectedVessel && <VesselCard vessel={selectedVessel} />}
      <LeafletMap config={APP_CONFIG} vessels={vessels} selectedId={selectedId} onSelect={handleSelect} />
    </>
  );
}
