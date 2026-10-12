import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db, uid } from '../db';
import type { Template } from '../types';
import { confirmDialog } from '../components/Confirm';
import { ExercisePicker } from '../components/ExercisePicker';
import { NumInput } from '../components/NumInput';
import { IconPlus } from '../components/Icons';
import { supersetLabel } from '../lib/plan';
import { back, go } from '../router';

export function TemplateEditor({ id }: { id: string }) {
  const isNew = id === 'new';
  const [t, setT] = useState<Template | null>(isNew ? { id: uid(), name: 'Nieuwe template', exercises: [], updatedAt: Date.now() } : null);
  const [picker, setPicker] = useState(false);
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? [];
  const byId = new Map(exercises.map((e) => [e.id, e]));

  useEffect(() => {
    if (!isNew) db.templates.get(id).then((x) => setT(x ?? null));
  }, [id, isNew]);

  if (!t) return <div className="empty">Template niet gevonden.</div>;

  const patch = (i: number, p: Partial<Template['exercises'][number]>) =>
    setT({ ...t, exercises: t.exercises.map((e, j) => (j === i ? { ...e, ...p } : e)) });
  const move = (i: number, d: number) => {
    const list = [...t.exercises];
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    setT({ ...t, exercises: list });
  };

  const save = async () => {
    await db.templates.put({ ...t, name: t.name.trim() || 'Template', updatedAt: Date.now() });
    go('workout');
  };
  const remove = async () => {
    if (!(await confirmDialog({ title: `Template “${t.name}” verwijderen?`, confirmLabel: 'Verwijderen', danger: true }))) return;
    await db.templates.delete(t.id);
    go('workout');
  };

  return (
    <>
      <header className="page">
        <button className="btn ghost" onClick={() => back('workout')}>‹ Terug</button>
        <div className="grow" />
        <button className="btn primary" onClick={save}>Opslaan</button>
      </header>
      <label className="lbl">Naam</label>
      <input className="field" value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} />
      <p className="small muted">Laat het herhalingsbereik leeg om het standaardbereik van de oefening te gebruiken.</p>
      <div className="stack">
        {t.exercises.map((e, i) => {
          const ex = byId.get(e.exerciseId);
          return (
            <div key={i} className="card">
              <div className="spread">
                <h3 className="truncate">
                  {e.supersetGroup != null && <span className="badge" style={{ marginRight: 6 }}>Superset {supersetLabel(e.supersetGroup)}</span>}
                  {ex?.name ?? e.exerciseId}
                </h3>
                <div className="row">
                  <button className="btn small" onClick={() => move(i, -1)} aria-label="Omhoog">↑</button>
                  <button className="btn small" onClick={() => move(i, 1)} aria-label="Omlaag">↓</button>
                  <button className="btn small danger" onClick={() => setT({ ...t, exercises: t.exercises.filter((_, j) => j !== i) })} aria-label="Verwijderen">✕</button>
                </div>
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                <div className="grow"><label className="lbl">Sets</label><NumInput className="field" decimal={false} value={e.sets} onChange={(v) => patch(i, { sets: Math.max(1, v ?? 1) })} /></div>
                <div className="grow"><label className="lbl">Min. reps</label><NumInput className="field" decimal={false} value={e.repMin} placeholder={String(ex?.repMin ?? '')} onChange={(v) => patch(i, { repMin: v ?? undefined })} /></div>
                <div className="grow"><label className="lbl">Max. reps</label><NumInput className="field" decimal={false} value={e.repMax} placeholder={String(ex?.repMax ?? '')} onChange={(v) => patch(i, { repMax: v ?? undefined })} /></div>
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                <div className="grow">
                  <label className="lbl">{e.supersetGroup != null ? 'Rust tussen (s)' : 'Rust (s)'}</label>
                  <NumInput className="field" decimal={false} value={e.restSeconds} placeholder="standaard" onChange={(v) => patch(i, { restSeconds: v || undefined })} />
                </div>
                {e.supersetGroup != null && (
                  <div className="grow">
                    <label className="lbl">Na ronde (s)</label>
                    <NumInput className="field" decimal={false} value={e.roundRestSeconds} placeholder="standaard" onChange={(v) => patch(i, { roundRestSeconds: v || undefined })} />
                  </div>
                )}
                <div className="grow">
                  <label className="lbl">Opwarmset</label>
                  <select className="field" value={e.warmupSets == null ? 'auto' : e.warmupSets > 0 ? 'yes' : 'no'} onChange={(ev) => patch(i, { warmupSets: ev.target.value === 'auto' ? undefined : ev.target.value === 'yes' ? 1 : 0 })}>
                    <option value="auto">Auto</option>
                    <option value="yes">Ja</option>
                    <option value="no">Nee</option>
                  </select>
                </div>
              </div>
              {e.rpe != null && (
                <p className="small muted" style={{ margin: '8px 0 0' }}>
                  Doel-RPE {String(e.rpe).replace('.', ',')}{e.lastSetRpe != null && e.lastSetRpe !== e.rpe ? `, laatste set ${String(e.lastSetRpe).replace('.', ',')}` : ''}
                </p>
              )}
              {e.notes && <p className="small muted" style={{ margin: '8px 0 0' }}>{e.notes}</p>}
            </div>
          );
        })}
        <button className="btn primary block" onClick={() => setPicker(true)}><IconPlus size={18} /> Oefening toevoegen</button>
        {!isNew && <button className="btn danger block" onClick={remove}>Template verwijderen</button>}
      </div>
      {picker && (
        <ExercisePicker
          onClose={() => setPicker(false)}
          onPick={(ids) => {
            setPicker(false);
            setT({ ...t, exercises: [...t.exercises, ...ids.map((exerciseId) => ({ exerciseId, sets: 3 }))] });
          }}
        />
      )}
    </>
  );
}
