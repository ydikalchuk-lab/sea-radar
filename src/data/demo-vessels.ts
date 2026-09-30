import type { DemoRouteDefinition } from '@/types/vessel';

export const DEMO_ROUTES: DemoRouteDefinition[] = [
  {
    id: 'demo-1',
    name: 'Демо-судно 1',
    speedKnots: 12.5,
    points: [
      { lat: 51.0, lon: 1.3 },
      { lat: 51.01, lon: 1.34 },
      { lat: 51.025, lon: 1.37 },
      { lat: 51.03, lon: 1.42 },
      { lat: 51.05, lon: 1.45 },
      { lat: 51.055, lon: 1.5 },
      { lat: 51.07, lon: 1.53 },
      { lat: 51.075, lon: 1.58 },
      { lat: 51.09, lon: 1.61 },
      { lat: 51.1, lon: 1.65 },
    ],
  },
  {
    id: 'demo-2',
    name: 'Демо-судно 2',
    speedKnots: 8.4,
    points: [
      { lat: 50.92, lon: 1.62 },
      { lat: 50.93, lon: 1.58 },
      { lat: 50.94, lon: 1.54 },
      { lat: 50.95, lon: 1.5 },
      { lat: 50.96, lon: 1.46 },
      { lat: 50.97, lon: 1.42 },
      { lat: 50.98, lon: 1.38 },
      { lat: 50.99, lon: 1.34 },
    ],
  },
  {
    id: 'demo-3',
    name: 'Демо-судно 3',
    speedKnots: 15.2,
    points: [
      { lat: 51.14, lon: 1.08 },
      { lat: 51.13, lon: 1.14 },
      { lat: 51.12, lon: 1.2 },
      { lat: 51.11, lon: 1.26 },
      { lat: 51.1, lon: 1.32 },
      { lat: 51.09, lon: 1.38 },
      { lat: 51.08, lon: 1.44 },
      { lat: 51.07, lon: 1.5 },
    ],
  },
];
