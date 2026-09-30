import type { DemoRouteDefinition, Vessel } from '@/types/vessel';

export type DemoProgress = {
  pointIndex: number;
  timestamp: string;
};

export type DemoMotionState = {
  vessels: Vessel[];
  progress: DemoProgress[];
};

function initialBearing(from: { lat: number; lon: number }, to: { lat: number; lon: number }): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitude1 = toRadians(from.lat);
  const latitude2 = toRadians(to.lat);
  const longitudeDifference = toRadians(to.lon - from.lon);
  const y = Math.sin(longitudeDifference) * Math.cos(latitude2);
  const x =
    Math.cos(latitude1) * Math.sin(latitude2) -
    Math.sin(latitude1) * Math.cos(latitude2) * Math.cos(longitudeDifference);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;

  return (bearing + 360) % 360;
}

export function createInitialDemoState(
  definitions: DemoRouteDefinition[],
  timestamp: string,
): DemoMotionState {
  return {
    vessels: definitions.map((route) => {
      const [firstPoint, secondPoint] = route.points;

      return {
        id: route.id,
        name: route.name,
        lat: firstPoint.lat,
        lon: firstPoint.lon,
        speedKnots: route.speedKnots,
        courseDeg: initialBearing(firstPoint, secondPoint),
        timestamp,
        source: 'demo',
      };
    }),
    progress: definitions.map(() => ({ pointIndex: 0, timestamp })),
  };
}

export function advanceDemoVessels(
  definitions: DemoRouteDefinition[],
  progress: DemoProgress[],
  tickTime: string,
): DemoMotionState {
  const vessels = definitions.map((route, index) => {
    const currentProgress = progress[index];
    const lastIndex = route.points.length - 1;
    const isFinished = currentProgress.pointIndex >= lastIndex;
    const nextIndex = isFinished ? lastIndex : currentProgress.pointIndex + 1;
    const previousIndex = isFinished ? Math.max(0, lastIndex - 1) : currentProgress.pointIndex;
    const previousPoint = route.points[previousIndex];
    const currentPoint = route.points[nextIndex];

    return {
      id: route.id,
      name: route.name,
      lat: currentPoint.lat,
      lon: currentPoint.lon,
      speedKnots: isFinished || nextIndex === lastIndex ? 0 : route.speedKnots,
      courseDeg: initialBearing(previousPoint, currentPoint),
      timestamp: isFinished ? currentProgress.timestamp : tickTime,
      source: 'demo' as const,
    };
  });

  const nextProgress = definitions.map((route, index) => {
    const currentProgress = progress[index];
    const lastIndex = route.points.length - 1;

    return currentProgress.pointIndex >= lastIndex
      ? currentProgress
      : { pointIndex: currentProgress.pointIndex + 1, timestamp: tickTime };
  });

  return { vessels, progress: nextProgress };
}
