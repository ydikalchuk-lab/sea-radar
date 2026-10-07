export type MapCoordinate = [number, number];

export type AppConfig = {
  bounds: [MapCoordinate, MapCoordinate];
  center: MapCoordinate;
  zoom: number;
  tileUrl: string;
  tileAttribution: string;
};

export const DEMO_TICK_MS = 2000;
export const SNAPSHOT_WINDOW_OPTIONS = [15, 30, 60, 120, 180, 240, 300] as const;
export const AIS_SNAPSHOT_WINDOW_MS = SNAPSHOT_WINDOW_OPTIONS[0] * 1_000;
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
