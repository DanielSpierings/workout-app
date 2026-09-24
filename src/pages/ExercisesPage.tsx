import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { db } from '../db';
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from '../data/exercises';
import type { Muscle } from '../types';
import { filterExercises } from '../components/ExercisePicker';
import { go } from '../router';

export function ExercisesPage() {
  const exercises = useLiveQuery(() => db.exercises.orderBy('name').toArray(), []) ?? [];
  const counts = useLiveQuery(async () => {
    const m = new Map<string, number>();
    await db.workouts.each((w) => {
      for (const e of w.exercises) m.set(e.exerciseId, (m.get(e.exerciseId) ?? 0) + 1);
    });
    return m;
  }, []);
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const list = useMemo(() => filterExercises(exercises, q, muscle), [exercises, q, muscle]);

  return (
    <>
      <header className="page"><h1>Oefeningen</h1></header>
      <input className="field" placeholder="Zoeken…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips" style={{ margin: '10px 0' }}>
        <button className={`chip ${muscle == null ? 'on' : ''}`} onClick={() => setMuscle(null)}>Alles</button>
        {(Object.keys(MUSCLE_LABELS) as Muscle[]).map((m) => (
          <button key={m} className={`chip ${muscle === m ? 'on' : ''}`} onClick={() => setMuscle(m)}>{MUSCLE_LABELS[m]}</button>
        ))}
      </div>
      <div className="card" style={{ padding: '0 14px' }}>
        {list.map((e) => (
          <div key={e.id} className="list-item" onClick={() => go(`exercises/${e.id}`)}>
            <div className="grow">
              <div className="truncate">{e.name}</div>
              <div className="small muted">{MUSCLE_LABELS[e.muscle]} · {EQUIPMENT_LABELS[e.equipment]} · {e.repMin}–{e.repMax} reps</div>
            </div>
            {counts?.get(e.id) ? <span className="badge">{counts.get(e.id)}×</span> : null}
          </div>
        ))}
        {!list.length && <div className="empty">Niets gevonden. Nieuwe oefeningen voeg je toe vanuit een workout.</div>}
      </div>
    </>
  );
}
