import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../db';
import type { Settings, Template, Workout } from '../types';
import { Sheet } from '../components/Sheet';
import { formatDate } from '../lib/format';
import { describePlan, supersetLabel } from '../lib/plan';
import { startWorkout } from '../lib/workouts';
import { go } from '../router';
import { ActiveWorkout } from './ActiveWorkout';
import { WorkoutSummary } from './WorkoutSummary';

export function WorkoutPage({ settings }: { settings: Settings }) {
  const active = useLiveQuery(async () => (await db.workouts.filter((w) => !w.endedAt).first()) ?? null, []);
  const templates = useLiveQuery(() => db.templates.orderBy('name').toArray(), []) ?? [];
  const exerciseList = useLiveQuery(() => db.exercises.toArray(), []);
  const byId = new Map((exerciseList ?? []).map((e) => [e.id, e]));
  const names = new Map((exerciseList ?? []).map((e) => [e.id, e.name]));
  const lastUsed = useLiveQuery(async () => {
    const m = new Map<string, number>();
    await db.workouts.each((w) => {
      if (w.templateId && w.endedAt) m.set(w.templateId, Math.max(m.get(w.templateId) ?? 0, w.startedAt));
    });
    return m;
  }, []);
  const [preview, setPreview] = useState<Template | null>(null);
  const [finished, setFinished] = useState<Workout | null>(null);

  if (finished) return <WorkoutSummary workout={finished} onClose={() => { setFinished(null); go('history'); }} />;
  if (active === undefined) return null;
  if (active) return <ActiveWorkout key={active.id} initial={active} settings={settings} onFinished={setFinished} />;

  const start = async (t?: Template) => {
    setPreview(null);
    await startWorkout(t);
  };

  return (
    <>
      <header className="page"><h1>Workout</h1></header>
      <button className="btn primary block" onClick={() => start()}>Lege workout starten</button>

      <div className="spread" style={{ marginTop: 24 }}>
        <h2 style={{ margin: 0 }}>Templates</h2>
        <button className="btn ghost" onClick={() => go('templates/new')}>+ Template</button>
      </div>
      <p className="small muted">Bij het starten vult de app gewicht en herhalingen in op basis van je vorige prestaties (progressive overload).</p>
      {groupByProgram(templates).map(([program, list]) => (
        <section key={program ?? ''}>
          {program && <h3 className="muted small" style={{ margin: '16px 0 8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{program}</h3>}
          <div className="stack">
            {list.map((t) => (
              <div key={t.id} className="card clickable" onClick={() => setPreview(t)}>
                <div className="spread">
                  <h3 className="truncate">{t.name}</h3>
                  {lastUsed?.get(t.id) && <span className="small muted">{formatDate(lastUsed.get(t.id)!)}</span>}
                </div>
                <div className="small muted" style={{ marginTop: 4 }}>
                  {t.exercises.map((e) => `${e.sets} × ${names.get(e.exerciseId) ?? '?'}`).join(' · ')}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
      {!templates.length && (
        <div className="empty">Nog geen templates. Maak er een, rond een workout af en sla hem op als template, of importeer een programma via Instellingen.</div>
      )}

      {preview && (
        <Sheet title={preview.name} onClose={() => setPreview(null)} actions={<button className="btn ghost" onClick={() => go(`templates/${preview.id}`)}>Bewerk</button>}>
          {preview.exercises.map((e, i) => (
            <div key={i} className="list-item" style={{ cursor: 'default' }}>
              <div className="grow">
                <div className="truncate">
                  {e.supersetGroup != null && <span className="badge" style={{ marginRight: 6 }}>{supersetLabel(e.supersetGroup)}</span>}
                  {names.get(e.exerciseId) ?? e.exerciseId}
                </div>
                <div className="muted small">{describePlan(e, byId.get(e.exerciseId))}</div>
                {e.notes && <div className="muted small">{e.notes}</div>}
              </div>
            </div>
          ))}
          <button className="btn primary block" style={{ marginTop: 16 }} onClick={() => start(preview)}>Start workout</button>
        </Sheet>
      )}
    </>
  );
}

/** Groepeert templates per programma; losse templates eerst. */
function groupByProgram(templates: Template[]): [string | undefined, Template[]][] {
  const groups = new Map<string | undefined, Template[]>();
  for (const t of templates) {
    const list = groups.get(t.program) ?? [];
    list.push(t);
    groups.set(t.program, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a == null ? -1 : b == null ? 1 : a.localeCompare(b)))
    .map(([p, list]) => [p, p ? [...list].sort((x, y) => x.name.localeCompare(y.name, 'nl', { numeric: true })) : list]);
}
