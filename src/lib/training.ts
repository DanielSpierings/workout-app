import type { Exercise, ExercisePlan, Settings, WorkoutExercise, WorkoutSet } from '../types';
import { DEFAULT_INCREMENT } from '../data/exercises';

const COMPOUND = /squat|deadlift|press|row|pull ?up|chin ?up|dip|lunge|thrust|clean|snatch|good morning/;
const ISOLATION = /curl|extension|raise|fly|crossover|kickback|calf|pushdown|shrug|crunch|pec deck|abduct|adduct/;

/** Meergewrichtsoefening (squat, deadlift, presses, rows…) op basis van de naam. */
export function isCompound(exercise: Pick<Exercise, 'name'>): boolean {
  const n = exercise.name.toLowerCase().replace(/[-_]/g, ' ');
  return COMPOUND.test(n) && !ISOLATION.test(n);
}

/**
 * Aantal automatische opwarmsets: hooguit één, zodat workouts kort blijven.
 * Een eigen keuze bij de oefening gaat voor; daarna de template; anders alleen bij compound.
 */
export function warmupCount(exercise: Exercise, plan?: ExercisePlan): 0 | 1 {
  if (exercise.warmup != null) return exercise.warmup ? 1 : 0;
  if (plan?.warmupSets != null) return plan.warmupSets > 0 ? 1 : 0;
  return isCompound(exercise) ? 1 : 0;
}

/** Eén opwarmset op ~60% van het werkgewicht, 8 herhalingen, afgerond op de kleinste stap. */
export function warmupSet(workWeight: number | null, exercise: Exercise): WorkoutSet {
  const step = exercise.increment ?? DEFAULT_INCREMENT[exercise.equipment];
  const weight = workWeight && workWeight > 0 ? Math.max(step, Math.round((workWeight * 0.6) / step) * step) : null;
  return { weight: weight == null ? null : Number(weight.toFixed(2)), reps: 8, type: 'warmup', done: false, auto: true };
}

/** Werkt automatische opwarmsets bij als het eerste werkgewicht verandert (afgevinkte blijven staan). */
export function syncWarmups(sets: WorkoutSet[], exercise: Exercise): WorkoutSet[] {
  const first = sets.find((s) => s.type !== 'warmup');
  return sets.map((s) => {
    if (!s.auto || s.done) return s;
    const next = warmupSet(first?.weight ?? null, exercise);
    return next.weight === s.weight ? s : { ...s, weight: next.weight };
  });
}

export function defaultRest(exercise: Exercise | undefined, settings: Settings): number {
  return exercise && !isCompound(exercise) ? settings.restIsolationSeconds : settings.restSeconds;
}

/** Plek van een oefening in haar superset: null als ze er niet in zit. */
export function supersetPosition(list: WorkoutExercise[], index: number): { last: boolean; members: number[] } | null {
  const group = list[index]?.plan?.supersetGroup;
  if (group == null) return null;
  const members = list.map((e, i) => (e.plan?.supersetGroup === group ? i : -1)).filter((i) => i >= 0);
  if (members.length < 2) return null;
  return { last: members[members.length - 1] === index, members };
}

/**
 * Rust na een set. In een superset is de rust tussen de oefeningen kort (uit het programma);
 * na de laatste oefening van de ronde volgt de langere rust van de zwaarste oefening in de groep.
 */
export function restAfter(
  list: WorkoutExercise[],
  index: number,
  byId: Map<string, Exercise>,
  settings: Settings,
): { seconds: number; kind: 'normal' | 'between' | 'round' } {
  const e = list[index];
  const pos = supersetPosition(list, index);
  if (!pos) return { seconds: e.plan?.restSeconds ?? defaultRest(byId.get(e.exerciseId), settings), kind: 'normal' };
  if (!pos.last) return { seconds: e.plan?.restSeconds ?? 30, kind: 'between' };
  const round = e.plan?.roundRestSeconds
    ?? Math.max(...pos.members.map((i) => defaultRest(byId.get(list[i].exerciseId), settings)));
  return { seconds: round, kind: 'round' };
}
