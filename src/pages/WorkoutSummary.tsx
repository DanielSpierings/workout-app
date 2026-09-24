import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid } from '../db';
import type { Workout } from '../types';
import { toast } from '../components/Toast';
import { formatDuration, formatNumber } from '../lib/format';
import { isWorkingSet, prsInWorkout, workoutVolume } from '../lib/stats';
import { templateFromWorkout } from '../lib/workouts';

export function WorkoutSummary({ workout, onClose }: { workout: Workout; onClose: () => void }) {
  const all = useLiveQuery(() => db.workouts.toArray(), []) ?? [];
  const names = useLiveQuery(async () => new Map((await db.exercises.toArray()).map((e) => [e.id, e.name])), []);
  const template = useLiveQuery(() => (workout.templateId ? db.templates.get(workout.templateId) : undefined), [workout.templateId]);
  const prs = prsInWorkout(workout, all);
  const sets = workout.exercises.reduce((n, e) => n + e.sets.filter(isWorkingSet).length, 0);

  const saveTemplate = async () => {
    const t = templateFromWorkout(workout, template?.id ?? uid());
    if (template) t.name = template.name;
    await db.templates.put(t);
    if (!template) await db.workouts.update(workout.id, { templateId: t.id });
    toast(template ? 'Template bijgewerkt.' : 'Opgeslagen als template.');
  };

  return (
    <>
      <header className="page"><h1>Goed gedaan! 💪</h1></header>
      <div className="card stack">
        <h3>{workout.name}</h3>
        <div className="stats">
          <div className="stat"><div className="v">{formatDuration(workout.endedAt! - workout.startedAt)}</div><div className="l">Duur</div></div>
          <div className="stat"><div className="v">{formatNumber(workoutVolume(workout), 0)} kg</div><div className="l">Volume</div></div>
          <div className="stat"><div className="v">{sets}</div><div className="l">Werksets</div></div>
          <div className="stat"><div className="v">{prs.length}</div><div className="l">Records</div></div>
        </div>
      </div>
      {prs.length > 0 && (
        <>
          <h2>Nieuwe records 🏆</h2>
          <div className="card stack">
            {prs.map((p) => (
              <div key={p.exerciseId} className="spread">
                <span className="truncate">{names?.get(p.exerciseId) ?? p.exerciseId}</span>
                <span className="row">{p.kinds.map((k) => <span key={k} className="badge good">{k}</span>)}</span>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="stack" style={{ marginTop: 20 }}>
        <button className="btn block" onClick={saveTemplate}>{template ? `Template “${template.name}” bijwerken` : 'Opslaan als template'}</button>
        <button className="btn primary block" onClick={onClose}>Klaar</button>
      </div>
    </>
  );
}
