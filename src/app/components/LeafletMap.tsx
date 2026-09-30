'use client';

import { useEffect, useRef } from 'react';
import type { AppConfig } from '@/config/app';

type LeafletMapProps = {
  config: AppConfig;
};

export default function LeafletMap({ config }: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let active = true;
    let map: import('leaflet').Map | null = null;
    let resizeObserver: ResizeObserver | null = null;

    void import('leaflet').then((leaflet) => {
      if (!active) return;

      map = leaflet.map(container, { maxBounds: config.bounds }).setView(config.center, config.zoom);
      leaflet.tileLayer(config.tileUrl, { attribution: config.tileAttribution }).addTo(map);
      map.invalidateSize();

      resizeObserver = new ResizeObserver(() => map?.invalidateSize({ pan: false }));
      resizeObserver.observe(container);
    });

    return () => {
      active = false;
      resizeObserver?.disconnect();
      map?.remove();
    };
  }, [config]);

  return <div ref={containerRef} className="map-viewport" data-testid="map" role="region" aria-label="Карта Дуврської протоки" />;
}
