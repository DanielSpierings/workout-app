import { go } from '../router';
import { IconDumbbell, IconHistory, IconList, IconSettings } from './Icons';

const TABS = [
  { id: 'workout', label: 'Workout', icon: <IconDumbbell /> },
  { id: 'history', label: 'Geschiedenis', icon: <IconHistory /> },
  { id: 'exercises', label: 'Oefeningen', icon: <IconList /> },
  { id: 'settings', label: 'Instellingen', icon: <IconSettings /> },
];

export function TabBar({ current }: { current: string }) {
  return (
    <nav className="tabbar">
      {TABS.map((t) => (
        <button key={t.id} className={current === t.id ? 'on' : ''} onClick={() => go(t.id)}>
          {t.icon}
          {t.label}
        </button>
      ))}
    </nav>
  );
}
