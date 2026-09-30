'use client';

import { useEffect, useRef, useState } from 'react';
import type { AppConfig } from '@/config/app';
import type { Vessel } from '@/types/vessel';

type LeafletMapProps = {
  config: AppConfig;
  vessels: Vessel[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  viewResetKey: number;
};

export default function LeafletMap({ config, vessels, selectedId, onSelect, viewResetKey }: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<typeof import('leaflet') | null>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const vesselLayerRef = useRef<import('leaflet').LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const previousViewResetKeyRef = useRef(viewResetKey);
  useEffect(() => {
    if (!mapReady || previousViewResetKeyRef.current === viewResetKey) return;
    previousViewResetKeyRef.current = viewResetKey;
    mapRef.current?.setView(config.center, config.zoom);
  }, [config.center, config.zoom, mapReady, viewResetKey]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let active = true;
    let map: import('leaflet').Map | null = null;
    let resizeObserver: ResizeObserver | null = null;

    void import('leaflet').then((leaflet) => {
      if (!active) return;

      leafletRef.current = leaflet;
      map = leaflet.map(container, { maxBounds: config.bounds }).setView(config.center, config.zoom);
      leaflet.tileLayer(config.tileUrl, { attribution: config.tileAttribution }).addTo(map);
      vesselLayerRef.current = leaflet.layerGroup().addTo(map);
      mapRef.current = map;
      map.invalidateSize();

      resizeObserver = new ResizeObserver(() => map?.invalidateSize({ pan: false }));
      resizeObserver.observe(container);
      setMapReady(true);
    });

    return () => {
      active = false;
      resizeObserver?.disconnect();
      vesselLayerRef.current?.clearLayers();
      vesselLayerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
      setMapReady(false);
    };
  }, [config]);

  useEffect(() => {
    const leaflet = leafletRef.current;
    const vesselLayer = vesselLayerRef.current;
    if (!mapReady || !leaflet || !vesselLayer) return;

    vesselLayer.clearLayers();

    for (const vessel of vessels) {
      const isNeutral = vessel.courseDeg === null;
      const symbol = document.createElement('span');
      symbol.className = `vessel-marker-symbol ${isNeutral ? 'vessel-marker-symbol--neutral' : 'vessel-marker-symbol--course'}`;
      if (vessel.courseDeg !== null) {
        symbol.style.transform = `rotate(${vessel.courseDeg}deg)`;
      }

      const icon = leaflet.divIcon({
        className: 'vessel-marker-container',
        html: symbol,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      const marker = leaflet.marker([vessel.lat, vessel.lon], { icon }).addTo(vesselLayer);
      const element = marker.getElement();
      element?.setAttribute('data-vessel-id', vessel.id);
      element?.setAttribute('data-icon', isNeutral ? 'neutral' : 'course');
      element?.setAttribute('data-selected', String(vessel.id === selectedId));
      if (vessel.courseDeg !== null) {
        element?.setAttribute('data-course-deg', String(vessel.courseDeg));
      }
      element?.setAttribute('aria-label', vessel.name ?? vessel.id);
      marker.on('click', () => onSelectRef.current(vessel.id));
    }
  }, [mapReady, vessels, selectedId]);

  return <div ref={containerRef} className="map-viewport" data-testid="map" data-view-reset-key={viewResetKey} role="region" aria-label="Карта Дуврської протоки" />;
}
