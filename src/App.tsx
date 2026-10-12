import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { db, withDefaults } from './db';
import { TabBar } from './components/TabBar';
import { ConfirmHost } from './components/Confirm';
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
  const stored = useLiveQuery(() => db.settings.get('settings'), []);
  const settings = withDefaults(stored);
  // Thema: volgt de iPhone, tenzij in Instellingen licht of donker is gekozen.
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'auto') delete root.dataset.theme;
    else root.dataset.theme = settings.theme;
    const dark = settings.theme === 'dark' || (settings.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#1b1a16' : '#faf8f5'));
  }, [settings.theme]);
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
      <div className="page-enter" key={`${section}/${id ?? ''}`}>{page}</div>
      {active && tab !== 'workout' && (
        <div className="banner" onClick={() => go('workout')}>
          Workout bezig: {active.name} · terug naar workout
        </div>
      )}
      <TabBar current={tab} />
      <ToastHost />
      <ConfirmHost />
    </div>
  );
}
