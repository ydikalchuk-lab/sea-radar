import type { Vessel } from '@/types/vessel';
import {
  formatCoordinates,
  formatCourse,
  formatSource,
  formatSpeedKnots,
  formatTimestamp,
  normalizeVesselName,
  NO_DATA_LABEL,
} from '@/lib/vessel-display';

type VesselCardProps = {
  vessel: Vessel;
};

export default function VesselCard({ vessel }: VesselCardProps) {
  return (
    <aside className="vessel-card" aria-label="Картка судна">
      <h2>Дані судна</h2>
      <dl>
        <div>
          <dt>Ідентифікатор</dt>
          <dd>{vessel.id}</dd>
        </div>
        <div>
          <dt>Назва</dt>
          <dd>{normalizeVesselName(vessel.name) ?? NO_DATA_LABEL}</dd>
        </div>
        <div>
          <dt>Координати</dt>
          <dd>{formatCoordinates(vessel.lat, vessel.lon)}</dd>
        </div>
        <div>
          <dt>Швидкість</dt>
          <dd>{formatSpeedKnots(vessel.speedKnots)}</dd>
        </div>
        <div>
          <dt>Курс</dt>
          <dd>{formatCourse(vessel.courseDeg)}</dd>
        </div>
        <div>
          <dt>Час повідомлення</dt>
          <dd>{formatTimestamp(vessel.timestamp)}</dd>
        </div>
        <div>
          <dt>Джерело</dt>
          <dd>{formatSource(vessel.source)}</dd>
        </div>
      </dl>
    </aside>
  );
}
