import type { Exercise, SetType, Workout, WorkoutSet } from '../types';
import { guessExercise, slug } from '../data/exercises';
import { parseCsv } from './csv';

const LBS_TO_KG = 0.45359237;

export interface ImportResult {
  workouts: Workout[];
  newExercises: Exercise[];
  skippedRows: number;
}

function norm(h: string): string {
  return h.toLowerCase().replace(/[^a-z#]/g, '');
}

/** Zoekt een kolom op basis van (genormaliseerde) kopnamen; werkt voor oude en nieuwe Strong-exports. */
function column(headers: string[], ...candidates: string[]): number {
  const hs = headers.map(norm);
  for (const c of candidates) {
    const exact = hs.indexOf(c);
    if (exact >= 0) return exact;
  }
  for (const c of candidates) {
    const i = hs.findIndex((h) => h.startsWith(c) && !(c === 'weight' && h === 'weightunit'));
    if (i >= 0) return i;
  }
  return -1;
}

export function parseNumber(v: string | undefined): number | null {
  if (v == null) return null;
  const s = v.trim();
  if (!s) return null;
  // "1.234,5" (EU) en "1,234.5" (US) en "80,5" en "80.5"
  let t = s;
  if (t.includes(',') && t.includes('.')) {
    t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  } else t = t.replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** "2023-01-15 08:30:00", "2023-01-15T08:30:00" of "15/01/2023 08:30" → lokale tijd in ms. */
export function parseDate(v: string): number | null {
  const s = v.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0)).getTime();
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[ ,]+(\d{1,2}):(\d{2}))?/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] ?? 0), +(m[5] ?? 0)).getTime();
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

/** "1h 5m", "45m", "1:05:00", "3900" (seconden) → seconden. */
export function parseDuration(v: string | undefined, isSeconds = false): number | null {
  if (!v) return null;
  const s = v.trim();
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) return isSeconds ? Number(s) : Number(s) * 60;
  const hms = s.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (hms) return hms[3] != null ? +hms[1] * 3600 + +hms[2] * 60 + +hms[3] : +hms[1] * 60 + +hms[2];
  const h = s.match(/(\d+)\s*h/);
  const m = s.match(/(\d+)\s*m(?!s)/);
  const sec = s.match(/(\d+)\s*s/);
  if (!h && !m && !sec) return null;
  return (h ? +h[1] * 3600 : 0) + (m ? +m[1] * 60 : 0) + (sec ? +sec[1] : 0);
}

function setType(order: string): SetType | 'skip' {
  const o = order.trim().toUpperCase();
  if (o === 'W') return 'warmup';
  if (o === 'D') return 'drop';
  if (o === 'F') return 'failure';
  if (/^\d+$/.test(o)) return 'normal';
  return 'skip'; // o.a. "Rest Timer"-regels uit nieuwere exports
}

/**
 * Zet een Strong CSV-export om in workouts. Bekende oefeningen (op naam) worden
 * hergebruikt; onbekende krijgen een nieuwe entry met een gok voor spiergroep.
 */
export function importStrongCsv(text: string, existing: Exercise[], idFn: () => string): ImportResult {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('Het bestand bevat geen gegevens.');
  const [headers, ...data] = rows;

  const iDate = column(headers, 'date');
  const iWorkout = column(headers, 'workoutname');
  const iExercise = column(headers, 'exercisename');
  const iOrder = column(headers, 'setorder');
  const iWeight = column(headers, 'weight');
  const iUnit = column(headers, 'weightunit');
  const iReps = column(headers, 'reps');
  const iRpe = column(headers, 'rpe');
  const iNotes = headers.findIndex((h) => norm(h) === 'notes');
  const iWorkoutNotes = column(headers, 'workoutnotes');
  const iDuration = column(headers, 'duration', 'workoutduration');
  if (iDate < 0 || iExercise < 0 || iReps < 0) {
    throw new Error('Dit lijkt geen Strong-export: kolommen "Date", "Exercise Name" of "Reps" ontbreken.');
  }
  const weightHeader = iWeight >= 0 ? headers[iWeight].toLowerCase() : '';
  const headerLbs = /lb/.test(weightHeader);
  const durationInSeconds = iDuration >= 0 && /sec/.test(headers[iDuration].toLowerCase());

  const byName = new Map(existing.map((e) => [e.name.toLowerCase(), e]));
  const bySlug = new Map(existing.map((e) => [e.id, e]));
  const newExercises: Exercise[] = [];
  const workouts = new Map<string, Workout>();
  let skippedRows = 0;

  const exerciseFor = (name: string): Exercise => {
    const key = name.toLowerCase();
    const found = byName.get(key) ?? bySlug.get(slug(name));
    if (found) return found;
    const created: Exercise = { id: slug(name) || idFn(), name, custom: true, ...guessExercise(name) };
    byName.set(key, created);
    bySlug.set(created.id, created);
    newExercises.push(created);
    return created;
  };

  for (const r of data) {
    const date = parseDate(r[iDate] ?? '');
    const exName = (r[iExercise] ?? '').trim();
    const type = iOrder >= 0 ? setType(r[iOrder] ?? '1') : 'normal';
    if (date == null || !exName || type === 'skip') {
      skippedRows++;
      continue;
    }
    let weight = iWeight >= 0 ? parseNumber(r[iWeight]) : null;
    const reps = parseNumber(r[iReps]);
    if (!reps && !weight) {
      skippedRows++; // bv. alleen afstand/tijd (cardio)
      continue;
    }
    const unitLbs = iUnit >= 0 ? /lb/i.test(r[iUnit] ?? '') : headerLbs;
    if (weight != null && unitLbs) weight = Number((weight * LBS_TO_KG).toFixed(2));

    const wName = (iWorkout >= 0 ? r[iWorkout] : '')?.trim() || 'Workout';
    const key = `${date}|${wName}`;
    let w = workouts.get(key);
    if (!w) {
      const secs = iDuration >= 0 ? parseDuration(r[iDuration], durationInSeconds) : null;
      w = {
        id: idFn(),
        name: wName,
        startedAt: date,
        endedAt: date + (secs ?? 3600) * 1000,
        notes: iWorkoutNotes >= 0 ? r[iWorkoutNotes]?.trim() || undefined : undefined,
        exercises: [],
        source: 'strong',
      };
      workouts.set(key, w);
    }
    const exercise = exerciseFor(exName);
    // Strong zet oefeningen in volgorde; dezelfde oefening later opnieuw = nieuw blok.
    let block = w.exercises[w.exercises.length - 1];
    if (!block || block.exerciseId !== exercise.id) {
      block = { exerciseId: exercise.id, sets: [] };
      w.exercises.push(block);
    }
    const rpe = iRpe >= 0 ? parseNumber(r[iRpe]) : null;
    const set: WorkoutSet = { weight: weight ?? 0, reps: reps ?? 0, rpe: rpe || null, type, done: true };
    block.sets.push(set);
    const note = iNotes >= 0 ? r[iNotes]?.trim() : '';
    if (note && !block.notes) block.notes = note;
  }

  return {
    workouts: [...workouts.values()].sort((a, b) => a.startedAt - b.startedAt),
    newExercises,
    skippedRows,
  };
}
