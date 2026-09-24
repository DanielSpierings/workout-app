import { db } from '../db';
import type { Exercise, Template, Workout } from '../types';
import { toCsv } from './csv';
import { importStrongCsv } from './strongImport';

export interface Backup {
  app: 'workout-app';
  version: 1;
  exportedAt: string;
  exercises: Exercise[];
  workouts: Workout[];
  templates: Template[];
}

export async function exportBackup(): Promise<Backup> {
  const [exercises, workouts, templates] = await Promise.all([
    db.exercises.toArray(),
    db.workouts.toArray(),
    db.templates.toArray(),
  ]);
  return { app: 'workout-app', version: 1, exportedAt: new Date().toISOString(), exercises, workouts, templates };
}

export async function restoreBackup(b: Backup): Promise<void> {
  if (b.app !== 'workout-app') throw new Error('Dit is geen back-up van deze app.');
  await db.transaction('rw', db.exercises, db.workouts, db.templates, async () => {
    await db.exercises.bulkPut(b.exercises);
    await db.workouts.bulkPut(b.workouts);
    await db.templates.bulkPut(b.templates);
  });
}

/** Importeert een Strong-export; workouts die al bestaan (zelfde start en naam) worden overgeslagen. */
export async function importStrong(text: string): Promise<{ added: number; duplicates: number; newExercises: number; skippedRows: number }> {
  const existing = await db.exercises.toArray();
  const result = importStrongCsv(text, existing, () => crypto.randomUUID());
  const current = await db.workouts.toArray();
  const seen = new Set(current.map((w) => `${w.startedAt}|${w.name}`));
  const fresh = result.workouts.filter((w) => !seen.has(`${w.startedAt}|${w.name}`));
  await db.transaction('rw', db.exercises, db.workouts, async () => {
    await db.exercises.bulkPut(result.newExercises);
    await db.workouts.bulkAdd(fresh);
  });
  return {
    added: fresh.length,
    duplicates: result.workouts.length - fresh.length,
    newExercises: result.newExercises.length,
    skippedRows: result.skippedRows,
  };
}

export async function exportCsv(): Promise<string> {
  const [exercises, workouts] = await Promise.all([db.exercises.toArray(), db.workouts.orderBy('startedAt').toArray()]);
  const names = new Map(exercises.map((e) => [e.id, e.name]));
  const rows: (string | number | null | undefined)[][] = [
    ['Date', 'Workout Name', 'Duration (sec)', 'Exercise Name', 'Set Order', 'Weight (kg)', 'Reps', 'RPE', 'Notes', 'Workout Notes'],
  ];
  const pad = (n: number) => String(n).padStart(2, '0');
  for (const w of workouts) {
    if (!w.endedAt) continue;
    const d = new Date(w.startedAt);
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    const dur = Math.round((w.endedAt - w.startedAt) / 1000);
    for (const e of w.exercises) {
      let n = 0;
      for (const s of e.sets) {
        if (!s.done) continue;
        const order = s.type === 'warmup' ? 'W' : s.type === 'drop' ? 'D' : s.type === 'failure' ? 'F' : String(++n);
        rows.push([date, w.name, dur, names.get(e.exerciseId) ?? e.exerciseId, order, s.weight, s.reps, s.rpe, e.notes, w.notes]);
      }
    }
  }
  return toCsv(rows);
}

export function download(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
