import type { Workout, WorkoutSet } from '../types';

/** Geschatte 1RM volgens Epley; boven 12 herhalingen wordt de schatting onbetrouwbaar. */
export function e1rm(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + Math.min(reps, 12) / 30);
}

export function isWorkingSet(s: WorkoutSet): boolean {
  return s.type !== 'warmup' && s.done && (s.reps ?? 0) > 0;
}

export function setVolume(s: WorkoutSet): number {
  return (s.weight ?? 0) * (s.reps ?? 0);
}

export function workoutVolume(w: Workout): number {
  return w.exercises.reduce(
    (sum, e) => sum + e.sets.filter(isWorkingSet).reduce((a, s) => a + setVolume(s), 0),
    0,
  );
}

export interface ExerciseSession {
  workoutId: string;
  date: number;
  sets: WorkoutSet[];
  bestE1rm: number;
  topWeight: number;
  volume: number;
}

/** Alle afgeronde sessies van één oefening, oudste eerst. */
export function exerciseSessions(workouts: Workout[], exerciseId: string): ExerciseSession[] {
  const out: ExerciseSession[] = [];
  for (const w of workouts) {
    if (!w.endedAt) continue;
    for (const e of w.exercises) {
      if (e.exerciseId !== exerciseId) continue;
      const sets = e.sets.filter(isWorkingSet);
      if (!sets.length) continue;
      out.push({
        workoutId: w.id,
        date: w.startedAt,
        sets,
        bestE1rm: Math.max(...sets.map((s) => e1rm(s.weight ?? 0, s.reps ?? 0))),
        topWeight: Math.max(...sets.map((s) => s.weight ?? 0)),
        volume: sets.reduce((a, s) => a + setVolume(s), 0),
      });
    }
  }
  return out.sort((a, b) => a.date - b.date);
}

export interface Records {
  maxWeight: number;
  maxE1rm: number;
  maxReps: number;
  maxVolume: number;
}

export function recordsFor(sessions: ExerciseSession[]): Records {
  const r: Records = { maxWeight: 0, maxE1rm: 0, maxReps: 0, maxVolume: 0 };
  for (const s of sessions) {
    r.maxWeight = Math.max(r.maxWeight, s.topWeight);
    r.maxE1rm = Math.max(r.maxE1rm, s.bestE1rm);
    r.maxVolume = Math.max(r.maxVolume, s.volume);
    for (const set of s.sets) r.maxReps = Math.max(r.maxReps, set.reps ?? 0);
  }
  return r;
}

export type PrKind = 'gewicht' | 'e1RM' | 'volume';

/** Welke records een workout verbrak ten opzichte van alle eerdere workouts. */
export function prsInWorkout(workout: Workout, all: Workout[]): { exerciseId: string; kinds: PrKind[] }[] {
  const earlier = all.filter((w) => w.endedAt && w.startedAt < workout.startedAt);
  const result: { exerciseId: string; kinds: PrKind[] }[] = [];
  for (const ex of workout.exercises) {
    const current = exerciseSessions([{ ...workout, endedAt: workout.endedAt ?? Date.now(), exercises: [ex] }], ex.exerciseId)[0];
    if (!current) continue;
    const before = exerciseSessions(earlier, ex.exerciseId);
    if (!before.length) continue; // een eerste keer telt niet als PR
    const r = recordsFor(before);
    const kinds: PrKind[] = [];
    if (current.topWeight > r.maxWeight) kinds.push('gewicht');
    if (current.bestE1rm > r.maxE1rm + 0.01) kinds.push('e1RM');
    if (current.volume > r.maxVolume) kinds.push('volume');
    if (kinds.length) result.push({ exerciseId: ex.exerciseId, kinds });
  }
  return result;
}

/** Aantal werksets per spiergroep in de afgelopen `days` dagen. */
export function setsPerMuscle(
  workouts: Workout[],
  muscleOf: (exerciseId: string) => string | undefined,
  days = 7,
  now = Date.now(),
): Record<string, number> {
  const from = now - days * 86_400_000;
  const out: Record<string, number> = {};
  for (const w of workouts) {
    if (!w.endedAt || w.startedAt < from) continue;
    for (const e of w.exercises) {
      const m = muscleOf(e.exerciseId);
      if (!m) continue;
      out[m] = (out[m] ?? 0) + e.sets.filter(isWorkingSet).length;
    }
  }
  return out;
}
