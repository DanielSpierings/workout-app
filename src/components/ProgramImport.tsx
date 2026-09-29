import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../db';
import type { Exercise } from '../types';
import { buildProgram, type MatchStatus, type ProgramAnalysis } from '../lib/programImport';
import { Sheet } from './Sheet';
import { toast } from './Toast';

const STATUS: Record<MatchStatus, { label: string; cls: string }> = {
  exact: { label: 'gevonden', cls: 'good' },
  matched: { label: 'gekoppeld', cls: 'good' },
  ambiguous: { label: 'controleer', cls: 'warn' },
  new: { label: 'nieuw', cls: '' },
};
const NEW = '__new__';

/** Voorbeeld van een programma-import: controleer per oefeningnaam de koppeling en importeer. */
export function ProgramImport({ analysis, onClose }: { analysis: ProgramAnalysis; onClose: () => void }) {
  const exercises = useLiveQuery(() => db.exercises.orderBy('name').toArray(), []) ?? [];
  const existingIds = useLiveQuery(async () => new Set(await db.templates.toCollection().primaryKeys()), []);
  const [choices, setChoices] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);
  const { program, mappings } = analysis;

  const preview = exercises.length ? buildProgram(analysis, exercises, choices) : null;
  const replacing = preview?.templates.filter((t) => existingIds?.has(t.id)).length ?? 0;

  const confirm = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      await db.transaction('rw', db.exercises, db.templates, async () => {
        await db.exercises.bulkAdd(preview.newExercises);
        await db.templates.bulkPut(preview.templates);
      });
      toast(`${preview.templates.length} templates geïmporteerd${preview.newExercises.length ? `, ${preview.newExercises.length} nieuwe oefeningen` : ''}.`);
      onClose();
    } catch (e) {
      toast(`Import mislukt: ${(e as Error).message}`);
      setBusy(false);
    }
  };

  const valueFor = (name: string, fallback: string | null) => {
    const v = name in choices ? choices[name] : fallback;
    return v ?? NEW;
  };

  return (
    <Sheet
      title="Programma importeren"
      onClose={onClose}
      actions={<button className="btn ghost" disabled={busy || !preview} onClick={confirm}>Importeer</button>}
    >
      <h3>{program.program.name}</h3>
      <p className="small muted" style={{ margin: '4px 0 12px' }}>
        {program.workouts.length} workouts: {program.workouts.map((w) => w.name).join(', ')}.
        {replacing > 0 && ` ${replacing} bestaande template(s) van dit programma worden bijgewerkt.`}
      </p>
      <b className="small">Oefeningen koppelen</b>
      <p className="small muted" style={{ margin: '2px 0 4px' }}>
        Koppel aan een bestaande oefening om je geschiedenis en progressie mee te nemen.
      </p>
      {mappings.map((m) => (
        <div key={m.name} className="list-item" style={{ cursor: 'default', flexWrap: 'wrap' }}>
          <div className="grow" style={{ minWidth: 160 }}>
            <div className="truncate">{m.name}</div>
            <span className={`badge ${STATUS[m.name in choices ? 'matched' : m.status].cls}`}>
              {m.name in choices ? 'handmatig' : STATUS[m.status].label}
            </span>
          </div>
          <select
            className="field"
            style={{ flex: '1 1 180px', minHeight: 38 }}
            value={valueFor(m.name, m.exerciseId)}
            onChange={(e) => setChoices((c) => ({ ...c, [m.name]: e.target.value === NEW ? null : e.target.value }))}
          >
            <option value={NEW}>+ Nieuwe oefening “{m.name}”</option>
            <ExerciseOptions exercises={exercises} candidates={m.candidates} />
          </select>
        </div>
      ))}
      <button className="btn primary block" style={{ marginTop: 16 }} disabled={busy || !preview} onClick={confirm}>
        {busy ? 'Bezig…' : `Importeer ${program.workouts.length} templates`}
      </button>
    </Sheet>
  );
}

function ExerciseOptions({ exercises, candidates }: { exercises: Exercise[]; candidates: string[] }) {
  const top = exercises.filter((e) => candidates.includes(e.id));
  return (
    <>
      {top.length > 0 && (
        <optgroup label="Voorgesteld">
          {top.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </optgroup>
      )}
      <optgroup label="Alle oefeningen">
        {exercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
      </optgroup>
    </>
  );
}
