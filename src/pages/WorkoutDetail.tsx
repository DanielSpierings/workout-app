import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid } from '../db';
import { toast } from '../components/Toast';
import { formatDate, formatDuration, formatNumber, formatTime } from '../lib/format';
import { e1rm, prsInWorkout, workoutVolume } from '../lib/stats';
import { repeatWorkout, templateFromWorkout } from '../lib/workouts';
import { back, go } from '../router';

export function WorkoutDetail({ id }: { id: string }) {
  const w = useLiveQuery(() => db.workouts.get(id), [id]);
  const all = useLiveQuery(() => db.workouts.toArray(), []) ?? [];
  const names = useLiveQuery(async () => new Map((await db.exercises.toArray()).map((e) => [e.id, e.name])), []);
  if (!w) return null;
  const prs = new Map(prsInWorkout(w, all).map((p) => [p.exerciseId, p.kinds]));

  const remove = async () => {
    if (!confirm('Deze workout verwijderen?')) return;
    await db.workouts.delete(w.id);
    go('history');
  };
  const again = async () => {
    await repeatWorkout(w);
    go('workout');
  };
  const asTemplate = async () => {
    await db.templates.add(templateFromWorkout(w, uid()));
    toast('Opgeslagen als template.');
  };

  return (
    <>
      <header className="page">
        <button className="btn ghost" onClick={() => back('history')}>‹ Terug</button>
      </header>
      <h1 style={{ margin: '0 0 4px' }}>{w.name}</h1>
      <div className="muted small">
        {formatDate(w.startedAt)} {formatTime(w.startedAt)} · {w.endedAt ? formatDuration(w.endedAt - w.startedAt) : 'bezig'} · {formatNumber(workoutVolume(w), 0)} kg
        {w.source === 'strong' && ' · uit Strong'}
      </div>
      {w.notes && <p>{w.notes}</p>}
      <div className="stack" style={{ marginTop: 16 }}>
        {w.exercises.map((e, i) => {
          let n = 0;
          return (
            <div key={i} className="card">
              <div className="spread">
                <h3 className="truncate" style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => go(`exercises/${e.exerciseId}`)}>
                  {names?.get(e.exerciseId) ?? e.exerciseId}
                </h3>
                <span className="row">{prs.get(e.exerciseId)?.map((k) => <span key={k} className="badge good">PR {k}</span>)}</span>
              </div>
              {e.notes && <div className="small muted">{e.notes}</div>}
              {e.sets.map((s, si) => (
                <div key={si} className="spread small" style={{ marginTop: 4 }}>
                  <span className="muted" style={{ width: 24 }}>{s.type === 'warmup' ? 'W' : s.type === 'drop' ? 'D' : s.type === 'failure' ? 'F' : ++n}</span>
                  <span className="grow">{formatNumber(s.weight ?? 0, 2)} kg × {s.reps}{s.rpe ? ` @ RPE ${String(s.rpe).replace('.', ',')}` : ''}</span>
                  <span className="muted">1RM ≈ {formatNumber(e1rm(s.weight ?? 0, s.reps ?? 0))}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <div className="stack" style={{ marginTop: 20 }}>
        <button className="btn primary block" onClick={again}>Herhaal deze workout</button>
        <button className="btn block" onClick={asTemplate}>Opslaan als template</button>
        <button className="btn danger block" onClick={remove}>Workout verwijderen</button>
      </div>
    </>
  );
}
