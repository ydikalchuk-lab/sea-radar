export type Vessel = {
  id: string;
  name: string | null;
  lat: number;
  lon: number;
  speedKnots: number | null;
  courseDeg: number | null;
  timestamp: string;
  source: 'demo' | 'aisstream';
};

export type DemoRouteDefinition = {
  id: string;
  name: string;
  speedKnots: number;
  points: { lat: number; lon: number }[];
};
