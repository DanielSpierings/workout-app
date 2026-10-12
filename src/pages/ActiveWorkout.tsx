import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { db } from '../db';
import type { Exercise, SetType, Settings, Workout, WorkoutExercise, WorkoutSet } from '../types';
import { confirmDialog } from '../components/Confirm';
import { ExercisePicker } from '../components/ExercisePicker';
import { IconCheck, IconChevronDown, IconClock, IconDots, IconPlus, IconTrash } from '../components/Icons';
import { RestSheet } from '../components/RestSheet';
import { RestTimer, type RestState } from '../components/RestTimer';
import { SetEditor } from '../components/SetEditor';
import { Sheet } from '../components/Sheet';
import { toast } from '../components/Toast';
import { formatClock, formatNumber } from '../lib/format';
import { describePlan, supersetLabel } from '../lib/plan';
import { unlockAudio } from '../lib/sound';
import { exerciseSessions } from '../lib/stats';
import { restAfter, supersetPosition, syncWarmups, warmupSet } from '../lib/training';
import { buildExercise, finishWorkout } from '../lib/workouts';

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
const REST_KEY = 'rest-timer';

function loadRest(): RestState | null {
  try {
    const r = JSON.parse(localStorage.getItem(REST_KEY) ?? 'null') as RestState | null;
    return r && r.endsAt > Date.now() ? r : null;
  } catch {
    return null;
  }
}

const kg = (n: number | null | undefined) => formatNumber(n ?? 0, 2);

export function ActiveWorkout({ initial, settings, onFinished }: { initial: Workout; settings: Settings; onFinished: (w: Workout) => void }) {
  const [w, setW] = useState<Workout>(initial);
  const [picker, setPicker] = useState(false);
  const [menu, setMenu] = useState<number | null>(null);
  const [editor, setEditor] = useState<{ i: number; si: number } | null>(null);
  const [restFor, setRestFor] = useState<number | null>(null);
  const [open, setOpen] = useState<Set<number>>(new Set());
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
      map.set(e.exerciseId, s[s.length - 1]?.sets.filter((x) => x.type !== 'warmup') ?? []);
    }
    return map;
  }, [history, w.exercises]);

  const updateExercise = (i: number, fn: (e: WorkoutExercise) => WorkoutExercise) =>
    update((prev) => ({ ...prev, exercises: prev.exercises.map((e, j) => (j === i ? fn(e) : e)) }));

  const updateSet = (i: number, si: number, patch: Partial<WorkoutSet>) =>
    updateExercise(i, (e) => {
      let sets = e.sets.map((s, j) => (j === si ? { ...s, ...patch } : s));
      const ex = byId.get(e.exerciseId);
      // Opwarmset rekent mee met het eerste werkgewicht.
      if (ex && 'weight' in patch && sets[si].type !== 'warmup') sets = syncWarmups(sets, ex);
      return { ...e, sets };
    });

  const toggleDone = (i: number, si: number) => {
    const set = w.exercises[i].sets[si];
    if (!set.done && !(set.reps && set.reps > 0)) {
      toast('Vul eerst het aantal herhalingen in');
      return;
    }
    unlockAudio();
    updateSet(i, si, { done: !set.done, weight: set.weight ?? 0 });
    if (!set.done && set.type !== 'warmup') {
      const { seconds } = restAfter(w.exercises, i, byId, settings);
      setRest({ endsAt: Date.now() + seconds * 1000, total: seconds });
    }
  };

  const removeSet = (i: number, si: number) => {
    const before = w.exercises[i].sets;
    updateExercise(i, (e) => ({ ...e, sets: e.sets.filter((_, j) => j !== si) }));
    toast('Set verwijderd', { label: 'Ongedaan maken', onClick: () => updateExercise(i, (e) => ({ ...e, sets: before })) });
  };

  const addSet = (i: number) =>
    updateExercise(i, (e) => {
      const last = [...e.sets].reverse().find((s) => s.type !== 'warmup') ?? e.sets[e.sets.length - 1];
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

  const saveRest = async (i: number, seconds: number, toTemplate: boolean) => {
    const block = w.exercises[i];
    const { kind } = restAfter(w.exercises, i, byId, settings);
    const field = kind === 'round' ? 'roundRestSeconds' : 'restSeconds';
    const working = block.sets.filter((s) => s.type !== 'warmup').length || 1;
    updateExercise(i, (e) => ({ ...e, plan: { sets: working, ...e.plan, [field]: seconds } }));
    if (rest) setRest(null);
    if (toTemplate && w.templateId) {
      const t = await db.templates.get(w.templateId);
      const idx = t?.exercises.findIndex((x) => x.exerciseId === block.exerciseId) ?? -1;
      if (t && idx >= 0) {
        const list = t.exercises.map((x, j) => (j === idx ? { ...x, [field]: seconds } : x));
        await db.templates.put({ ...t, exercises: list, updatedAt: Date.now() });
        toast('Rust ook opgeslagen in de template');
      } else {
        toast('Deze oefening staat niet in de template');
      }
    }
  };

  const finish = async () => {
    const openSets = w.exercises.reduce((n, e) => n + e.sets.filter((s) => !s.done).length, 0);
    if (openSets && !(await confirmDialog({
      title: 'Workout afronden?',
      message: `${openSets} set${openSets === 1 ? ' is' : 's zijn'} niet afgevinkt en ${openSets === 1 ? 'wordt' : 'worden'} niet opgeslagen.`,
      confirmLabel: 'Afronden',
    }))) return;
    await saving.current;
    const done = await finishWorkout(w);
    setRest(null);
    if (!done) {
      toast('Geen afgevinkte sets, workout niet opgeslagen');
      return;
    }
    onFinished(done);
  };

  const cancel = async () => {
    if (!(await confirmDialog({ title: 'Workout annuleren?', message: 'Alles van deze workout wordt verwijderd.', confirmLabel: 'Workout verwijderen', danger: true }))) return;
    await saving.current;
    await db.workouts.delete(w.id);
    setRest(null);
  };

  // Voortgang, huidige oefening en de volgende set voor de rusttimer.
  const allSets = w.exercises.flatMap((e) => e.sets);
  const doneCount = allSets.filter((s) => s.done).length;
  // Open sets vóór een al afgevinkte set (zoals een overgeslagen opwarmset) tellen niet als "volgende".
  const nextOpen = (e: WorkoutExercise) => {
    const lastDone = e.sets.reduce((acc, s, j) => (s.done ? j : acc), -1);
    return e.sets.findIndex((s, j) => !s.done && j > lastDone);
  };
  const current = w.exercises.findIndex((e) => nextOpen(e) >= 0);
  let next: ReactNode;
  if (current >= 0) {
    const block = w.exercises[current];
    const s = block.sets[nextOpen(block)];
    next = <>Volgende: <b>{byId.get(block.exerciseId)?.name ?? ''}</b> · {s.weight != null ? `${kg(s.weight)} kg × ` : ''}{s.reps ?? '?'}{s.type === 'warmup' ? ' (opwarmen)' : ''}</>;
  }

  const editing = editor && w.exercises[editor.i]?.sets[editor.si] ? editor : null;

  return (
    <>
      <div className="workout-head">
        <div className="row">
          <div className="grow">
            <input className="name" aria-label="Naam van de workout" value={w.name} onChange={(e) => update((p) => ({ ...p, name: e.target.value }))} />
            <div className="small muted">{formatClock((now - w.startedAt) / 1000)} · {doneCount} van {allSets.length} sets</div>
          </div>
          <button className="btn good" onClick={finish}>Afronden</button>
        </div>
        <div className="progress" aria-hidden="true"><div style={{ width: `${allSets.length ? (doneCount / allSets.length) * 100 : 0}%` }} /></div>
      </div>

      <div className="stack">
        {w.exercises.map((e, i) => {
          const ex = byId.get(e.exerciseId);
          const prevWork = previous.get(e.exerciseId) ?? [];
          const r = restAfter(w.exercises, i, byId, settings);
          const pos = supersetPosition(w.exercises, i);
          const [action, explanation, summary] = e.suggestion?.split('|') ?? [];
          const isOpen = open.has(i);
          let n = 0;
          return (
            <div className={`card exercise-card ${i === current ? 'current' : ''}`} key={`${e.exerciseId}-${i}`}>
              <div className="spread">
                <h3 className="truncate" onClick={() => { location.hash = `#/exercises/${e.exerciseId}`; }}>
                  {pos && <span className="badge" style={{ marginRight: 6 }}>{supersetLabel(e.plan!.supersetGroup!)}{pos.members.indexOf(i) + 1}</span>}
                  {ex?.name ?? e.exerciseId}
                </h3>
                <button className="btn icon" onClick={() => setMenu(i)} aria-label="Opties"><IconDots /></button>
              </div>
              <div className="meta-row">
                <button className="rest-chip" onClick={() => setRestFor(i)} aria-label="Rusttijd aanpassen">
                  <IconClock size={16} /> {formatClock(r.seconds)}{r.kind === 'between' ? ' tot volgende' : r.kind === 'round' ? ' na ronde' : ''}
                </button>
                {e.plan && <span className="small muted">{describePlan(e.plan, ex, { rest: false, warmup: false })}</span>}
              </div>
              {(explanation || e.plan?.notes) && (
                <div className={`suggestion ${action ?? ''} ${isOpen ? 'open' : ''}`}>
                  <button onClick={() => setOpen((o) => { const s = new Set(o); if (s.has(i)) s.delete(i); else s.add(i); return s; })} aria-expanded={isOpen}>
                    <span className="grow">
                      {explanation ? <><b>{ACTION_TITLE[action] ?? 'Advies'}</b>{summary ? ` · ${summary}` : ''}</> : <b>Notities</b>}
                    </span>
                    <IconChevronDown size={18} />
                  </button>
                  {isOpen && (
                    <div className="detail">
                      {explanation && <p>{explanation}</p>}
                      {e.plan?.notes && <p>{e.plan.notes}</p>}
                    </div>
                  )}
                </div>
              )}
              {e.notes != null && (
                <textarea className="field" rows={2} placeholder="Notitie" value={e.notes} onChange={(ev) => updateExercise(i, (x) => ({ ...x, notes: ev.target.value }))} style={{ marginTop: 6 }} />
              )}
              <div className="set-head" aria-hidden="true"><span>Set</span><span>Vorige</span><span>kg</span><span>Reps</span><span /></div>
              {e.sets.map((s, si) => {
                const idx = s.type === 'warmup' ? -1 : n++;
                const p = idx >= 0 ? prevWork[idx] : undefined;
                const label = TYPE_LABEL[s.type] || String(idx + 1);
                return (
                  <SwipeRow key={si} onDelete={() => removeSet(i, si)}>
                    <div className={`set-row ${s.done ? 'done' : ''}`}>
                      <button
                        className={`set-type ${s.type}`}
                        onClick={() => updateSet(i, si, { type: TYPE_ORDER[(TYPE_ORDER.indexOf(s.type) + 1) % TYPE_ORDER.length], auto: false })}
                        aria-label={`Type set ${label} wijzigen`}
                      >
                        {label}
                      </button>
                      <span className="prev">{p ? `${kg(p.weight)} × ${p.reps}` : s.type === 'warmup' ? 'opwarmen' : '–'}</span>
                      <button className={`value-btn ${s.weight == null ? 'blank' : ''}`} onClick={() => setEditor({ i, si })} aria-label={`Gewicht set ${label}`}>
                        {s.weight == null ? 'kg' : kg(s.weight)}
                      </button>
                      <button className={`value-btn ${s.reps == null ? 'blank' : ''}`} onClick={() => setEditor({ i, si })} aria-label={`Herhalingen set ${label}`}>
                        {s.reps ?? '–'}
                        {s.rpe != null && <small>@{String(s.rpe).replace('.', ',')}</small>}
                      </button>
                      <button className={`check ${s.done ? 'on' : ''}`} onClick={() => toggleDone(i, si)} aria-label={`Set ${label} afvinken`} aria-pressed={s.done}>
                        <IconCheck size={22} />
                      </button>
                    </div>
                  </SwipeRow>
                );
              })}
              <button className="btn block small" style={{ marginTop: 8 }} onClick={() => addSet(i)}><IconPlus size={18} /> Set toevoegen</button>
            </div>
          );
        })}
        {!w.exercises.length && <div className="empty">Voeg je eerste oefening toe.</div>}
        <button className="btn primary block" onClick={() => setPicker(true)}><IconPlus size={18} /> Oefening toevoegen</button>
        <button className="btn danger block" onClick={cancel}>Workout annuleren</button>
      </div>

      {rest && <RestTimer rest={rest} onChange={setRest} sound={settings.sound} soundKind={settings.soundKind} next={next} />}
      {picker && <ExercisePicker onPick={addExercises} onClose={() => setPicker(false)} />}
      {editing && (
        <SetEditor
          exercise={byId.get(w.exercises[editing.i].exerciseId)}
          label={(() => {
            const s = w.exercises[editing.i].sets[editing.si];
            if (s.type === 'warmup') return 'opwarmset';
            return `set ${w.exercises[editing.i].sets.slice(0, editing.si + 1).filter((x) => x.type !== 'warmup').length}`;
          })()}
          set={w.exercises[editing.i].sets[editing.si]}
          previous={(() => {
            const block = w.exercises[editing.i];
            if (block.sets[editing.si].type === 'warmup') return undefined;
            const idx = block.sets.slice(0, editing.si).filter((x) => x.type !== 'warmup').length;
            return previous.get(block.exerciseId)?.[idx];
          })()}
          onChange={(patch) => updateSet(editing.i, editing.si, patch)}
          onToggleDone={() => toggleDone(editing.i, editing.si)}
          onClose={() => setEditor(null)}
        />
      )}
      {restFor != null && w.exercises[restFor] && (
        <RestSheet
          title={byId.get(w.exercises[restFor].exerciseId)?.name ?? 'Rust'}
          kind={restAfter(w.exercises, restFor, byId, settings).kind}
          seconds={restAfter(w.exercises, restFor, byId, settings).seconds}
          canSaveToTemplate={!!w.templateId}
          onSave={(s, t) => void saveRest(restFor, s, t)}
          onClose={() => setRestFor(null)}
        />
      )}
      {menu != null && w.exercises[menu] && (
        <ExerciseMenu
          exercise={byId.get(w.exercises[menu].exerciseId)}
          block={w.exercises[menu]}
          onClose={() => setMenu(null)}
          onWarmup={() => {
            const block = w.exercises[menu];
            const ex = byId.get(block.exerciseId);
            const has = block.sets.some((s) => s.type === 'warmup');
            if (ex) {
              updateExercise(menu, (x) => has
                ? { ...x, sets: x.sets.filter((s) => s.type !== 'warmup') }
                : { ...x, sets: [warmupSet(x.sets.find((s) => s.type !== 'warmup')?.weight ?? null, ex), ...x.sets] });
            }
            setMenu(null);
          }}
          onNote={() => { updateExercise(menu, (x) => ({ ...x, notes: x.notes ?? '' })); setMenu(null); }}
          onUp={() => { move(menu, -1); setMenu(null); }}
          onDown={() => { move(menu, 1); setMenu(null); }}
          onRemove={async () => {
            const i = menu;
            setMenu(null);
            const name = byId.get(w.exercises[i].exerciseId)?.name ?? 'deze oefening';
            if (await confirmDialog({ title: `${name} verwijderen?`, message: 'De sets van deze oefening worden uit de workout gehaald.', confirmLabel: 'Verwijderen', danger: true })) {
              update((p) => ({ ...p, exercises: p.exercises.filter((_, j) => j !== i) }));
            }
          }}
        />
      )}
    </>
  );
}

/** Rij die je naar links veegt om te verwijderen. */
function SwipeRow({ children, onDelete }: { children: ReactNode; onDelete: () => void }) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; horizontal: boolean | null } | null>(null);
  const moved = useRef(false);
  const THRESHOLD = 90;

  return (
    <div
      className="swipe"
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        start.current = { x: e.clientX, y: e.clientY, horizontal: null };
        moved.current = false;
      }}
      onPointerMove={(e) => {
        const s = start.current;
        if (!s) return;
        const ddx = e.clientX - s.x;
        const ddy = e.clientY - s.y;
        if (s.horizontal == null && Math.hypot(ddx, ddy) > 8) s.horizontal = Math.abs(ddx) > Math.abs(ddy);
        if (!s.horizontal) return;
        moved.current = true;
        setDragging(true);
        setDx(Math.min(0, Math.max(ddx, -160)));
      }}
      onPointerUp={() => {
        if (dx < -THRESHOLD) onDelete();
        start.current = null;
        setDragging(false);
        setDx(0);
      }}
      onPointerCancel={() => { start.current = null; setDragging(false); setDx(0); }}
      onClickCapture={(e) => {
        if (moved.current) {
          e.stopPropagation();
          e.preventDefault();
          moved.current = false;
        }
      }}
    >
      {dx < 0 && <div className="behind" aria-hidden="true"><IconTrash size={18} /> {dx < -THRESHOLD ? 'Loslaten om te verwijderen' : 'Verwijderen'}</div>}
      <div style={{ transform: `translateX(${dx}px)`, transition: dragging ? 'none' : 'transform 0.2s ease' }}>{children}</div>
    </div>
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
  const hasWarmup = props.block.sets.some((s) => s.type === 'warmup');
  return (
    <Sheet title={props.exercise?.name ?? 'Oefening'} onClose={props.onClose}>
      <div className="list-item" onClick={props.onWarmup}>{hasWarmup ? 'Opwarmset verwijderen' : 'Opwarmset toevoegen (~60%)'}</div>
      <div className="list-item" onClick={props.onNote}>Notitie toevoegen</div>
      <div className="list-item" onClick={props.onUp}>Omhoog verplaatsen</div>
      <div className="list-item" onClick={props.onDown}>Omlaag verplaatsen</div>
      <div className="list-item danger" onClick={props.onRemove}>Oefening verwijderen</div>
    </Sheet>
  );
}
