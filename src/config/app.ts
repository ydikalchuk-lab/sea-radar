export type MapCoordinate = [number, number];

export type AppConfig = {
  bounds: [MapCoordinate, MapCoordinate];
  center: MapCoordinate;
  zoom: number;
  tileUrl: string;
  tileAttribution: string;
};

export const DEMO_TICK_MS = 2000;
export const AIS_SNAPSHOT_WINDOW_MS = 15_000;
export const AIS_SNAPSHOT_MAX_VESSELS = 100;

export const APP_CONFIG: AppConfig = {
  bounds: [
    [50.75, 0.95],
    [51.25, 1.95],
  ],
  center: [51.0, 1.45],
  zoom: 10,
  tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  tileAttribution: '© OpenStreetMap contributors',
};
