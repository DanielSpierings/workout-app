import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { db } from '../db';
import { EQUIPMENT_LABELS, MUSCLE_LABELS, guessExercise, slug } from '../data/exercises';
import type { Exercise, Muscle } from '../types';
import { Sheet } from './Sheet';

export function ExercisePicker({ onPick, onClose, multi = true }: { onPick: (ids: string[]) => void; onClose: () => void; multi?: boolean }) {
  const exercises = useLiveQuery(() => db.exercises.orderBy('name').toArray(), []) ?? [];
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  const filtered = useMemo(() => filterExercises(exercises, q, muscle), [exercises, q, muscle]);

  const toggle = (id: string) => {
    if (!multi) return onPick([id]);
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  const create = async () => {
    const name = q.trim();
    if (!name) return;
    let id = slug(name);
    if (await db.exercises.get(id)) id = `${id}-${Date.now()}`;
    const ex: Exercise = { id, name, custom: true, ...guessExercise(name), ...(muscle ? { muscle } : {}) };
    await db.exercises.add(ex);
    toggle(id);
    setQ('');
  };

  return (
    <Sheet
      title="Oefening kiezen"
      onClose={onClose}
      actions={multi && <button className="btn ghost" disabled={!picked.length} onClick={() => onPick(picked)}>Voeg toe{picked.length ? ` (${picked.length})` : ''}</button>}
    >
      <input className="field" placeholder="Zoeken of nieuwe oefening…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips" style={{ margin: '10px 0' }}>
        <button className={`chip ${muscle == null ? 'on' : ''}`} onClick={() => setMuscle(null)}>Alles</button>
        {(Object.keys(MUSCLE_LABELS) as Muscle[]).map((m) => (
          <button key={m} className={`chip ${muscle === m ? 'on' : ''}`} onClick={() => setMuscle(m)}>{MUSCLE_LABELS[m]}</button>
        ))}
      </div>
      {q.trim() && !exercises.some((e) => e.name.toLowerCase() === q.trim().toLowerCase()) && (
        <button className="btn block" style={{ marginBottom: 8 }} onClick={create}>+ Nieuwe oefening “{q.trim()}”</button>
      )}
      {filtered.map((e) => (
        <div key={e.id} className={`list-item ${picked.includes(e.id) ? 'on' : ''}`} onClick={() => toggle(e.id)}>
          <div className="grow">
            <div className="truncate">{e.name}</div>
            <div className="small muted">{MUSCLE_LABELS[e.muscle]} · {EQUIPMENT_LABELS[e.equipment]}</div>
          </div>
          {picked.includes(e.id) && <span>✓</span>}
        </div>
      ))}
    </Sheet>
  );
}

export function filterExercises(list: Exercise[], q: string, muscle: Muscle | null): Exercise[] {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  return list.filter((e) => (!muscle || e.muscle === muscle) && terms.every((t) => e.name.toLowerCase().includes(t)));
}
