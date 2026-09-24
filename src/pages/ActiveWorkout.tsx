import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { db } from '../db';
import { DEFAULT_INCREMENT } from '../data/exercises';
import type { Exercise, SetType, Settings, Workout, WorkoutExercise, WorkoutSet } from '../types';
import { ExercisePicker } from '../components/ExercisePicker';
import { NumInput } from '../components/NumInput';
import { RestTimer, unlockAudio, type RestState } from '../components/RestTimer';
import { Sheet } from '../components/Sheet';
import { toast } from '../components/Toast';
import { formatClock, formatNumber } from '../lib/format';
import { exerciseSessions } from '../lib/stats';
import { buildExercise, finishWorkout, warmupSets } from '../lib/workouts';

const TYPE_ORDER: SetType[] = ['normal', 'warmup', 'drop', 'failure'];
const TYPE_LABEL: Record<SetType, string> = { normal: '', warmup: 'W', drop: 'D', failure: 'F' };
const ACTION_TITLE: Record<string, string> = {
  first: 'Eerste keer',
  increase: 'Gewicht omhoog',
  reps: 'Herhalingen erbij',
  hold: 'Vasthouden',
  deload: 'Deload',
  return: 'Weer opbouwen',
};
const RPE_OPTIONS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
const REST_KEY = 'rest-timer';

function loadRest(): RestState | null {
  try {
    const r = JSON.parse(localStorage.getItem(REST_KEY) ?? 'null') as RestState | null;
    return r && r.endsAt > Date.now() ? r : null;
  } catch {
    return null;
  }
}

export function ActiveWorkout({ initial, settings, onFinished }: { initial: Workout; settings: Settings; onFinished: (w: Workout) => void }) {
  const [w, setW] = useState<Workout>(initial);
  const [picker, setPicker] = useState(false);
  const [menu, setMenu] = useState<number | null>(null);
  const [rest, setRestState] = useState<RestState | null>(loadRest);
  const [now, setNow] = useState(Date.now());
  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  const history = useLiveQuery(() => db.workouts.filter((x) => !!x.endedAt).toArray(), []);
  const byId = useMemo(() => new Map((exercises ?? []).map((e) => [e.id, e])), [exercises]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Elke wijziging direct opslaan, zodat niets verloren gaat als iOS de app sluit.
  const saving = useRef(Promise.resolve());
  const update = useCallback((fn: (w: Workout) => Workout) => {
    setW((prev) => {
      const next = fn(prev);
      saving.current = saving.current.then(() => db.workouts.put(next).then(() => undefined));
      return next;
    });
  }, []);

  const setRest = useCallback((r: RestState | null) => {
    setRestState(r);
    try {
      if (r) localStorage.setItem(REST_KEY, JSON.stringify(r));
      else localStorage.removeItem(REST_KEY);
    } catch { /* opslag niet beschikbaar */ }
  }, []);

  const previous = useMemo(() => {
    const map = new Map<string, WorkoutSet[]>();
    if (!history) return map;
    for (const e of w.exercises) {
      if (map.has(e.exerciseId)) continue;
      const s = exerciseSessions(history, e.exerciseId);
      map.set(e.exerciseId, s[s.length - 1]?.sets ?? []);
    }
    return map;
  }, [history, w.exercises]);

  const updateExercise = (i: number, fn: (e: WorkoutExercise) => WorkoutExercise) =>
    update((prev) => ({ ...prev, exercises: prev.exercises.map((e, j) => (j === i ? fn(e) : e)) }));

  const updateSet = (i: number, si: number, patch: Partial<WorkoutSet>) =>
    updateExercise(i, (e) => ({ ...e, sets: e.sets.map((s, j) => (j === si ? { ...s, ...patch } : s)) }));

  const toggleDone = (i: number, si: number) => {
    const set = w.exercises[i].sets[si];
    if (!set.done && !(set.reps && set.reps > 0)) {
      toast('Vul eerst het aantal herhalingen in.');
      return;
    }
    unlockAudio();
    updateSet(i, si, { done: !set.done, weight: set.weight ?? 0 });
    if (!set.done && set.type !== 'warmup') setRest({ endsAt: Date.now() + settings.restSeconds * 1000, total: settings.restSeconds });
  };

  const addSet = (i: number) =>
    updateExercise(i, (e) => {
      const last = e.sets[e.sets.length - 1];
      return { ...e, sets: [...e.sets, { weight: last?.weight ?? null, reps: last?.reps ?? null, type: 'normal', done: false }] };
    });

  const addExercises = async (ids: string[]) => {
    setPicker(false);
    const blocks: WorkoutExercise[] = [];
    for (const id of ids) {
      const ex = await db.exercises.get(id);
      if (ex) blocks.push(await buildExercise(ex));
    }
    update((prev) => ({ ...prev, exercises: [...prev.exercises, ...blocks] }));
  };

  const move = (i: number, d: number) =>
    update((prev) => {
      const list = [...prev.exercises];
      const j = i + d;
      if (j < 0 || j >= list.length) return prev;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...prev, exercises: list };
    });

  const finish = async () => {
    const open = w.exercises.reduce((n, e) => n + e.sets.filter((s) => !s.done).length, 0);
    if (open && !confirm(`${open} set(s) zijn niet afgevinkt en worden niet opgeslagen. Afronden?`)) return;
    await saving.current;
    const done = await finishWorkout(w);
    setRest(null);
    if (!done) {
      toast('Geen afgeronde sets; workout verwijderd.');
      return;
    }
    onFinished(done);
  };

  const cancel = async () => {
    if (!confirm('Workout annuleren? Alles van deze workout wordt verwijderd.')) return;
    await saving.current;
    await db.workouts.delete(w.id);
    setRest(null);
  };

  return (
    <>
      <header className="page">
        <div className="grow">
          <input
            className="field"
            style={{ fontSize: 20, fontWeight: 700, background: 'transparent', border: 0, padding: 0, minHeight: 32 }}
            value={w.name}
            onChange={(e) => update((p) => ({ ...p, name: e.target.value }))}
          />
          <div className="small muted">{formatClock((now - w.startedAt) / 1000)}</div>
        </div>
        <button className="btn good" onClick={finish}>Afronden</button>
      </header>

      <div className="stack">
        {w.exercises.map((e, i) => {
          const ex = byId.get(e.exerciseId);
          const prev = previous.get(e.exerciseId) ?? [];
          const prevWork = prev.filter((s) => s.type !== 'warmup');
          let n = 0;
          const [action, text] = e.suggestion?.split('|') ?? [];
          return (
            <div className="card exercise-card" key={`${e.exerciseId}-${i}`}>
              <div className="spread">
                <h3 className="truncate" onClick={() => { location.hash = `#/exercises/${e.exerciseId}`; }}>{ex?.name ?? e.exerciseId}</h3>
                <button className="btn ghost small" onClick={() => setMenu(i)} aria-label="Opties">•••</button>
              </div>
              {text && (
                <div className={`suggestion ${action}`}>
                  <b>{ACTION_TITLE[action] ?? 'Advies'}</b>
                  {text}
                </div>
              )}
              {e.notes != null && (
                <textarea className="field" rows={2} placeholder="Notitie" value={e.notes} onChange={(ev) => updateExercise(i, (x) => ({ ...x, notes: ev.target.value }))} style={{ marginTop: 6 }} />
              )}
              <table className="sets">
                <thead>
                  <tr><th>Set</th><th>Vorige</th><th>kg</th><th>Reps</th><th>RPE</th><th></th><th></th></tr>
                </thead>
                <tbody>
                  {e.sets.map((s, si) => {
                    const idx = s.type === 'warmup' ? -1 : n++;
                    const p = idx >= 0 ? prevWork[idx] : undefined;
                    return (
                      <tr key={si} className={s.done ? 'done' : ''}>
                        <td>
                          <button
                            className={`set-type ${s.type}`}
                            onClick={() => updateSet(i, si, { type: TYPE_ORDER[(TYPE_ORDER.indexOf(s.type) + 1) % TYPE_ORDER.length] })}
                            aria-label="Type set wijzigen"
                          >
                            {TYPE_LABEL[s.type] || idx + 1}
                          </button>
                        </td>
                        <td className="prev">{p ? `${formatNumber(p.weight ?? 0, 2)}×${p.reps}` : '–'}</td>
                        <td><NumInput aria-label="Gewicht" value={s.weight} onChange={(v) => updateSet(i, si, { weight: v })} placeholder="kg" /></td>
                        <td><NumInput aria-label="Herhalingen" decimal={false} value={s.reps} onChange={(v) => updateSet(i, si, { reps: v })} placeholder="0" /></td>
                        <td>
                          <select aria-label="RPE" value={s.rpe ?? ''} onChange={(ev) => updateSet(i, si, { rpe: ev.target.value ? Number(ev.target.value) : null })}>
                            <option value="">–</option>
                            {RPE_OPTIONS.map((r) => <option key={r} value={r}>{String(r).replace('.', ',')}</option>)}
                          </select>
                        </td>
                        <td><button className={`check ${s.done ? 'on' : ''}`} onClick={() => toggleDone(i, si)} aria-label="Set afvinken">✓</button></td>
                        <td>
                          <button className="del" aria-label="Set verwijderen" onClick={() => updateExercise(i, (x) => ({ ...x, sets: x.sets.filter((_, j) => j !== si) }))}>✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <button className="btn block small" style={{ marginTop: 8 }} onClick={() => addSet(i)}>+ Set toevoegen</button>
            </div>
          );
        })}
        {!w.exercises.length && <div className="empty">Voeg je eerste oefening toe.</div>}
        <button className="btn primary block" onClick={() => setPicker(true)}>+ Oefening toevoegen</button>
        <button className="btn danger block" onClick={cancel}>Workout annuleren</button>
      </div>

      {rest && <RestTimer rest={rest} onChange={setRest} sound={settings.sound} />}
      {picker && <ExercisePicker onPick={addExercises} onClose={() => setPicker(false)} />}
      {menu != null && w.exercises[menu] && (
        <ExerciseMenu
          exercise={byId.get(w.exercises[menu].exerciseId)}
          block={w.exercises[menu]}
          onClose={() => setMenu(null)}
          onWarmup={() => {
            const block = w.exercises[menu];
            const first = block.sets.find((s) => s.type !== 'warmup' && (s.weight ?? 0) > 0);
            const ex = byId.get(block.exerciseId);
            if (!first || !ex) return toast('Vul eerst een werkgewicht in.');
            const step = ex.increment ?? DEFAULT_INCREMENT[ex.equipment];
            updateExercise(menu, (x) => ({ ...x, sets: [...warmupSets(first.weight!, step), ...x.sets.filter((s) => s.type !== 'warmup')] }));
            setMenu(null);
          }}
          onNote={() => { updateExercise(menu, (x) => ({ ...x, notes: x.notes ?? '' })); setMenu(null); }}
          onUp={() => { move(menu, -1); setMenu(null); }}
          onDown={() => { move(menu, 1); setMenu(null); }}
          onRemove={() => { update((p) => ({ ...p, exercises: p.exercises.filter((_, j) => j !== menu) })); setMenu(null); }}
        />
      )}
    </>
  );
}

function ExerciseMenu(props: {
  exercise?: Exercise;
  block: WorkoutExercise;
  onClose: () => void;
  onWarmup: () => void;
  onNote: () => void;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
}) {
  return (
    <Sheet title={props.exercise?.name ?? 'Oefening'} onClose={props.onClose}>
      <div className="list-item" onClick={props.onWarmup}>Opwarmsets toevoegen (40/60/80%)</div>
      <div className="list-item" onClick={props.onNote}>Notitie toevoegen</div>
      <div className="list-item" onClick={props.onUp}>Omhoog verplaatsen</div>
      <div className="list-item" onClick={props.onDown}>Omlaag verplaatsen</div>
      <div className="list-item" style={{ color: 'var(--bad)' }} onClick={props.onRemove}>Oefening verwijderen</div>
    </Sheet>
  );
}
