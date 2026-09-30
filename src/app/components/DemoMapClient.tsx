'use client';

import { useCallback, useEffect, useState } from 'react';
import { DEMO_ROUTES } from '@/data/demo-vessels';
import { APP_CONFIG, DEMO_TICK_MS } from '@/config/app';
import { advanceDemoVessels, createInitialDemoState } from '@/lib/demo-motion';
import VesselCard from './VesselCard';
import LeafletMap from './LeafletMap';

export default function DemoMapClient() {
  const [demoState, setDemoState] = useState(() =>
    createInitialDemoState(DEMO_ROUTES, new Date().toISOString()),
  );
  const { vessels } = demoState;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const timerStartTime = new Date().toISOString();
    setDemoState(createInitialDemoState(DEMO_ROUTES, timerStartTime));

    const timerId = window.setInterval(() => {
      const tickTime = new Date().toISOString();
      setDemoState((current) => advanceDemoVessels(DEMO_ROUTES, current.progress, tickTime));
    }, DEMO_TICK_MS);

    return () => window.clearInterval(timerId);
  }, []);
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
