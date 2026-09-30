import { APP_CONFIG } from '@/config/app';
import LeafletMap from './components/LeafletMap';

export default function HomePage() {
  return (
    <main>
      <LeafletMap config={APP_CONFIG} />
    </main>
  );
}
