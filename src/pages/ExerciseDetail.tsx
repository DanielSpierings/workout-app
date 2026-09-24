import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { db, getSettings } from '../db';
import { DEFAULT_INCREMENT, EQUIPMENT_LABELS, MUSCLE_LABELS } from '../data/exercises';
import type { Equipment, Exercise, Muscle } from '../types';
import { LineChart } from '../components/LineChart';
import { NumInput } from '../components/NumInput';
import { toast } from '../components/Toast';
import { formatDate, formatKg, formatNumber } from '../lib/format';
import { suggestProgression, type Suggestion } from '../lib/progression';
import { exerciseSessions, recordsFor } from '../lib/stats';
import { back, go } from '../router';

type Metric = 'e1rm' | 'weight' | 'volume';

export function ExerciseDetail({ id }: { id: string }) {
  const exercise = useLiveQuery(() => db.exercises.get(id), [id]);
  const workouts = useLiveQuery(() => db.workouts.filter((w) => !!w.endedAt && w.exercises.some((e) => e.exerciseId === id)).toArray(), [id]);
  const [metric, setMetric] = useState<Metric>('e1rm');
  const [edit, setEdit] = useState<Exercise | null>(null);
  const [next, setNext] = useState<Suggestion | null>(null);

  const sessions = useMemo(() => exerciseSessions(workouts ?? [], id), [workouts, id]);
  const records = useMemo(() => recordsFor(sessions), [sessions]);

  useEffect(() => {
    if (!exercise) return;
    getSettings().then((s) => setNext(suggestProgression(exercise, sessions, { targetRir: s.targetRir })));
  }, [exercise, sessions]);

  if (exercise === undefined || workouts === undefined) return null;
  if (!exercise) return <div className="empty">Oefening niet gevonden.</div>;

  const points = sessions.map((s) => ({ x: s.date, y: metric === 'e1rm' ? s.bestE1rm : metric === 'weight' ? s.topWeight : s.volume }));

  const save = async () => {
    if (!edit) return;
    await db.exercises.put({ ...edit, name: edit.name.trim() || exercise.name, repMax: Math.max(edit.repMax, edit.repMin) });
    setEdit(null);
    toast('Opgeslagen.');
  };
  const remove = async () => {
    if (sessions.length) return toast('Deze oefening zit in je geschiedenis en kan niet worden verwijderd.');
    if (!confirm(`“${exercise.name}” verwijderen?`)) return;
    await db.exercises.delete(exercise.id);
    go('exercises');
  };

  return (
    <>
      <header className="page">
        <button className="btn ghost" onClick={() => back('exercises')}>‹ Terug</button>
        <div className="grow" />
        {!edit && <button className="btn ghost" onClick={() => setEdit(exercise)}>Bewerk</button>}
      </header>
      <h1 style={{ margin: '0 0 4px' }}>{exercise.name}</h1>
      <div className="muted small">{MUSCLE_LABELS[exercise.muscle]} · {EQUIPMENT_LABELS[exercise.equipment]} · doel {exercise.repMin}–{exercise.repMax} reps</div>

      {edit && <ExerciseForm value={edit} onChange={setEdit} onSave={save} onCancel={() => setEdit(null)} onDelete={remove} />}

      {next && (
        <div className={`suggestion ${next.action}`} style={{ marginTop: 16 }}>
          <b>Volgende keer</b>
          {next.targets[0]?.weight != null && `${formatKg(next.targets[0].weight)} × ${next.targets.map((t) => t.reps).join('/')} — `}
          {next.explanation}
        </div>
      )}

      <div className="stats" style={{ marginTop: 16 }}>
        <div className="stat"><div className="v">{formatKg(records.maxE1rm ? Number(records.maxE1rm.toFixed(1)) : null)}</div><div className="l">Beste geschatte 1RM</div></div>
        <div className="stat"><div className="v">{formatKg(records.maxWeight || null)}</div><div className="l">Zwaarste gewicht</div></div>
        <div className="stat"><div className="v">{records.maxReps || '–'}</div><div className="l">Meeste herhalingen</div></div>
        <div className="stat"><div className="v">{sessions.length}</div><div className="l">Sessies</div></div>
      </div>

      <h2>Voortgang</h2>
      <div className="chips" style={{ marginBottom: 8 }}>
        {([['e1rm', 'Geschatte 1RM'], ['weight', 'Zwaarste set'], ['volume', 'Volume']] as [Metric, string][]).map(([m, l]) => (
          <button key={m} className={`chip ${metric === m ? 'on' : ''}`} onClick={() => setMetric(m)}>{l}</button>
        ))}
      </div>
      <div className="card"><LineChart points={points} /></div>

      <h2>Historie</h2>
      <div className="stack">
        {[...sessions].reverse().slice(0, 50).map((s) => (
          <div key={`${s.workoutId}-${s.date}`} className="card clickable" onClick={() => go(`history/${s.workoutId}`)}>
            <div className="spread"><b className="small">{formatDate(s.date)}</b><span className="small muted">1RM ≈ {formatNumber(s.bestE1rm)} kg</span></div>
            <div className="small" style={{ marginTop: 4 }}>
              {s.sets.map((x) => `${formatNumber(x.weight ?? 0, 2)}×${x.reps}${x.rpe ? `@${String(x.rpe).replace('.', ',')}` : ''}`).join('  ·  ')}
            </div>
          </div>
        ))}
        {!sessions.length && <div className="empty">Nog niet gedaan.</div>}
      </div>
    </>
  );
}

function ExerciseForm({ value, onChange, onSave, onCancel, onDelete }: {
  value: Exercise;
  onChange: (e: Exercise) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const set = (p: Partial<Exercise>) => onChange({ ...value, ...p });
  return (
    <div className="card stack" style={{ marginTop: 16 }}>
      <div><label className="lbl">Naam</label><input className="field" value={value.name} onChange={(e) => set({ name: e.target.value })} /></div>
      <div className="row">
        <div className="grow">
          <label className="lbl">Spiergroep</label>
          <select className="field" value={value.muscle} onChange={(e) => set({ muscle: e.target.value as Muscle })}>
            {Object.entries(MUSCLE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div className="grow">
          <label className="lbl">Uitrusting</label>
          <select className="field" value={value.equipment} onChange={(e) => set({ equipment: e.target.value as Equipment })}>
            {Object.entries(EQUIPMENT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
      </div>
      <div className="row">
        <div className="grow"><label className="lbl">Min. reps</label><NumInput className="field" decimal={false} value={value.repMin} onChange={(v) => set({ repMin: Math.max(1, v ?? 1) })} /></div>
        <div className="grow"><label className="lbl">Max. reps</label><NumInput className="field" decimal={false} value={value.repMax} onChange={(v) => set({ repMax: Math.max(1, v ?? 1) })} /></div>
        <div className="grow"><label className="lbl">Stap (kg)</label><NumInput className="field" value={value.increment} placeholder={String(DEFAULT_INCREMENT[value.equipment]).replace('.', ',')} onChange={(v) => set({ increment: v && v > 0 ? v : undefined })} /></div>
      </div>
      <label className="row small">
        <input type="checkbox" checked={value.lowerBody} onChange={(e) => set({ lowerBody: e.target.checked })} />
        Onderlichaam / grote oefening (stappen van ~5% i.p.v. ~2,5%)
      </label>
      <div className="row">
        <button className="btn grow" onClick={onCancel}>Annuleren</button>
        <button className="btn primary grow" onClick={onSave}>Opslaan</button>
      </div>
      {value.custom && <button className="btn danger block" onClick={onDelete}>Oefening verwijderen</button>}
    </div>
  );
}
