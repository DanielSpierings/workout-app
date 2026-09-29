import { db, getSettings, uid } from '../db';
import type { Exercise, ExercisePlan, Template, TemplateExercise, Workout, WorkoutExercise, WorkoutSet } from '../types';
import { DEFAULT_INCREMENT } from '../data/exercises';
import { suggestProgression } from './progression';
import { exerciseSessions, isWorkingSet } from './stats';

export async function getActiveWorkout(): Promise<Workout | undefined> {
  return db.workouts.filter((w) => !w.endedAt).first();
}

async function finishedWorkouts(): Promise<Workout[]> {
  return db.workouts.filter((w) => !!w.endedAt).toArray();
}

/** Bouwt een oefenblok met sets die al zijn ingevuld volgens de progressie-engine. */
export async function buildExercise(
  exercise: Exercise,
  plan?: ExercisePlan,
  history?: Workout[],
): Promise<WorkoutExercise> {
  const withPlan = (block: WorkoutExercise): WorkoutExercise => {
    if (!plan) return block;
    const first = block.sets.find((x) => (x.weight ?? 0) > 0);
    const warmups = plan.warmupSets && first
      ? warmupSets(first.weight!, exercise.increment ?? DEFAULT_INCREMENT[exercise.equipment], plan.warmupSets)
      : [];
    return { ...block, plan: { ...plan }, sets: [...warmups, ...block.sets] };
  };
  const settings = await getSettings();
  const sessions = exerciseSessions(history ?? (await finishedWorkouts()), exercise.id);
  const last = sessions[sessions.length - 1];

  if (!settings.progressionEnabled) {
    const sets: WorkoutSet[] = last
      ? last.sets.map((s) => ({ weight: s.weight, reps: s.reps, type: s.type, done: false }))
      : Array.from({ length: plan?.sets ?? 3 }, () => ({ weight: null, reps: null, type: 'normal', done: false }));
    return withPlan({ exerciseId: exercise.id, sets: plan?.warmupSets ? sets.filter((x) => x.type !== 'warmup') : sets });
  }

  const s = suggestProgression(exercise, sessions, {
    targetRir: settings.targetRir,
    sets: plan?.sets,
    repMin: plan?.repMin,
    repMax: plan?.repMax,
    plannedRpe: plan?.rpe != null ? { early: plan.rpe, last: plan.lastSetRpe ?? plan.rpe } : undefined,
  });
  return withPlan({
    exerciseId: exercise.id,
    suggestion: `${s.action}|${s.explanation}`,
    sets: s.targets.map((t) => ({ weight: t.weight, reps: t.reps, type: 'normal', done: false })),
  });
}

export interface WorkoutPlan {
  name: string;
  templateId?: string;
  exercises: TemplateExercise[];
}

export async function startWorkout(template?: Template): Promise<Workout> {
  return startPlan(template ? { name: template.name, templateId: template.id, exercises: template.exercises } : undefined);
}

export async function startPlan(plan?: WorkoutPlan): Promise<Workout> {
  const active = await getActiveWorkout();
  if (active) return active;
  const history = await finishedWorkouts();
  const exercises: WorkoutExercise[] = [];
  for (const te of plan?.exercises ?? []) {
    const ex = await db.exercises.get(te.exerciseId);
    if (ex) exercises.push(await buildExercise(ex, te, history));
  }
  const w: Workout = {
    id: uid(),
    name: plan?.name ?? workoutNameForNow(),
    templateId: plan?.templateId,
    startedAt: Date.now(),
    exercises,
    source: 'app',
  };
  await db.workouts.add(w);
  return w;
}

/** Start een nieuwe workout met dezelfde oefeningen als een eerdere workout. */
export function repeatWorkout(prev: Workout): Promise<Workout> {
  return startPlan({
    name: prev.name,
    templateId: prev.templateId,
    exercises: prev.exercises.map((e) => ({ ...e.plan, exerciseId: e.exerciseId, sets: Math.max(e.sets.filter(isWorkingSet).length, 1) })),
  });
}

function workoutNameForNow(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Ochtendworkout' : h < 18 ? 'Middagworkout' : 'Avondworkout';
}

/** Rondt af: niet-afgevinkte sets vallen weg, lege oefeningen ook. */
export async function finishWorkout(w: Workout): Promise<Workout | null> {
  const exercises = w.exercises
    .map((e) => ({ ...e, sets: e.sets.filter((s) => s.done && ((s.reps ?? 0) > 0 || (s.weight ?? 0) > 0)) }))
    .filter((e) => e.sets.length);
  if (!exercises.length) {
    await db.workouts.delete(w.id);
    return null;
  }
  const done: Workout = { ...w, exercises, endedAt: Date.now() };
  await db.workouts.put(done);
  return done;
}

/** Maakt een nieuwe template van een workout, met de planning die de oefeningen al hadden. */
export function templateFromWorkout(w: Workout, id = uid()): Template {
  return {
    id,
    name: w.name,
    updatedAt: Date.now(),
    exercises: w.exercises.map((e) => ({
      ...e.plan,
      exerciseId: e.exerciseId,
      sets: Math.max(e.sets.filter((s) => s.type !== 'warmup').length, 1),
    })),
  };
}

/**
 * Oefeningen die in de workout zijn toegevoegd maar nog niet in de template staan.
 * Bijwerken voegt alleen deze toe: een onvolledige workout mag de template
 * (zoals een geïmporteerd programma) nooit inkorten.
 */
export function addedExercises(w: Workout, template: Template): TemplateExercise[] {
  const known = new Set(template.exercises.map((e) => e.exerciseId));
  return templateFromWorkout(w, template.id).exercises.filter((e) => !known.has(e.exerciseId));
}

// Opbouw richting het werkgewicht, afhankelijk van het aantal opwarmsets.
const WARMUP_RAMPS: [number, number][][] = [
  [],
  [[0.6, 8]],
  [[0.5, 8], [0.7, 5]],
  [[0.45, 8], [0.65, 5], [0.85, 3]],
  [[0.45, 8], [0.6, 5], [0.75, 4], [0.85, 3]],
];

/** Opwarmsets richting het eerste werkgewicht (1–4 sets). */
export function warmupSets(workWeight: number, step: number, count = 3): WorkoutSet[] {
  const ramp = WARMUP_RAMPS[Math.max(0, Math.min(count, WARMUP_RAMPS.length - 1))];
  const r = (x: number) => Math.max(step, Math.round(x / step) * step);
  return ramp.map(([pct, reps]) => ({ weight: r(workWeight * pct), reps, type: 'warmup', done: false }));
}
