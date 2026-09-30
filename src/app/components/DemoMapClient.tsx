'use client';

import { useCallback, useState } from 'react';
import { DEMO_VESSELS } from '@/data/demo-vessels';
import { APP_CONFIG } from '@/config/app';
import { normalizeVesselName } from '@/lib/vessel-display';
import type { Vessel } from '@/types/vessel';
import VesselCard from './VesselCard';
import LeafletMap from './LeafletMap';

export default function DemoMapClient() {
  const [vessels] = useState<Vessel[]>(() =>
    DEMO_VESSELS.map((vessel) => ({ ...vessel, name: normalizeVesselName(vessel.name) })),
  );
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
