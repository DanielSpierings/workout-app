import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { DEFAULT_SETTINGS } from './types';
import { TabBar } from './components/TabBar';
import { ToastHost } from './components/Toast';
import { ExerciseDetail } from './pages/ExerciseDetail';
import { ExercisesPage } from './pages/ExercisesPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { TemplateEditor } from './pages/TemplateEditor';
import { WorkoutDetail } from './pages/WorkoutDetail';
import { WorkoutPage } from './pages/WorkoutPage';
import { go, useRoute } from './router';

export function App() {
  const [section, id] = useRoute();
  const settings = useLiveQuery(() => db.settings.get('settings'), []) ?? DEFAULT_SETTINGS;
  const active = useLiveQuery(async () => (await db.workouts.filter((w) => !w.endedAt).first()) ?? null, []);

  let page;
  let tab = section;
  switch (section) {
    case 'history':
      page = id ? <WorkoutDetail id={id} /> : <HistoryPage />;
      break;
    case 'exercises':
      page = id ? <ExerciseDetail id={id} /> : <ExercisesPage />;
      break;
    case 'settings':
      page = <SettingsPage settings={settings} />;
      break;
    case 'templates':
      page = <TemplateEditor id={id ?? 'new'} />;
      tab = 'workout';
      break;
    default:
      page = <WorkoutPage settings={settings} />;
      tab = 'workout';
  }

  return (
    <div className="app">
      {page}
      {active && tab !== 'workout' && (
        <div className="banner" onClick={() => go('workout')}>
          Workout bezig: {active.name} · tik om verder te gaan
        </div>
      )}
      <TabBar current={tab} />
      <ToastHost />
    </div>
  );
}
