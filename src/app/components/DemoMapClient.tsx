'use client';

import { useCallback, useState } from 'react';
import { DEMO_VESSELS } from '@/data/demo-vessels';
import { APP_CONFIG } from '@/config/app';
import type { Vessel } from '@/types/vessel';
import LeafletMap from './LeafletMap';

export default function DemoMapClient() {
  const [vessels] = useState<Vessel[]>(DEMO_VESSELS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const handleSelect = useCallback((id: string) => setSelectedId(id), []);

  return (
    <>
      <p className="demo-data-label">Демонстраційні дані</p>
      <LeafletMap config={APP_CONFIG} vessels={vessels} selectedId={selectedId} onSelect={handleSelect} />
    </>
  );
}
