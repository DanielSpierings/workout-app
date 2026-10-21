import { db, getSettings, uid } from '../db';
import type { Exercise, ExercisePlan, Template, TemplateExercise, Workout, WorkoutExercise, WorkoutSet } from '../types';
import { warmupCount, warmupSet } from './training';
import { suggestProgression } from './progression';
import { exerciseSessions, isWorkingSet } from './stats';

export async function getActiveWorkout(): Promise<Workout | undefined> {
  return db.workouts.filter((w) => !w.endedAt).first();
}

async function finishedWorkouts(): Promise<Workout[]> {
  return db.workouts.filter((w) => !!w.endedAt).toArray();
}

/**
 * Bouwt een oefenblok met sets die al zijn ingevuld volgens de progressie-engine.
 * Met `hold` kiest de engine voor vasthouden in plaats van verhogen.
 */
export async function buildExercise(
  exercise: Exercise,
  plan?: ExercisePlan,
  history?: Workout[],
  hold = false,
): Promise<WorkoutExercise> {
  // Hooguit één automatische opwarmset; die rekent mee zodra het werkgewicht bekend is.
  const withPlan = (block: WorkoutExercise): WorkoutExercise => {
    const working = block.sets.filter((x) => x.type !== 'warmup');
    const bodyweight = exercise.equipment === 'bodyweight' && !working.some((x) => (x.weight ?? 0) > 0);
    const warmups = warmupCount(exercise, plan) && !bodyweight ? [warmupSet(working[0]?.weight ?? null, exercise)] : [];
    return { ...block, ...(plan ? { plan: { ...plan } } : {}), sets: [...warmups, ...working] };
  };
  const settings = await getSettings();
  const sessions = exerciseSessions(history ?? (await finishedWorkouts()), exercise.id);
  const last = sessions[sessions.length - 1];

  if (!settings.progressionEnabled) {
    const sets: WorkoutSet[] = last
      ? last.sets.map((s) => ({ weight: s.weight, reps: s.reps, type: s.type, done: false }))
      : Array.from({ length: plan?.sets ?? 3 }, () => ({ weight: null, reps: null, type: 'normal', done: false }));
    return withPlan({ exerciseId: exercise.id, sets });
  }

  const s = suggestProgression(exercise, sessions, {
    targetRir: settings.targetRir,
    sets: plan?.sets,
    repMin: plan?.repMin,
    repMax: plan?.repMax,
    plannedRpe: plan?.rpe != null ? { early: plan.rpe, last: plan.lastSetRpe ?? plan.rpe } : undefined,
    hold,
  });
  return withPlan({
    exerciseId: exercise.id,
    suggestion: `${s.action}|${s.explanation}|${targetSummary(s.targets, plan?.repMin ?? exercise.repMin, plan?.repMax ?? exercise.repMax)}`,
    ...(s.targets[0] ? { target: { ...s.targets[0] } } : {}),
    ...(hold ? { held: true } : {}),
    sets: s.targets.map((t) => ({ weight: t.weight, reps: t.reps, type: 'normal', done: false })),
  });
}

/** Korte samenvatting van het advies, bv. "82,5 kg × 7" of "100 kg × 9/8/8". */
export function targetSummary(targets: { weight: number | null; reps: number }[], repMin: number, repMax: number): string {
  const first = targets[0];
  if (!first) return '';
  const reps = [...new Set(targets.map((t) => t.reps))].length === 1 ? String(first.reps) : targets.map((t) => t.reps).join('/');
  if (first.weight == null) return `${repMin}–${repMax} herhalingen`;
  const w = Number(first.weight.toFixed(2)).toString().replace('.', ',');
  return first.weight > 0 ? `${w} kg × ${reps}` : `${reps} herhalingen`;
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
