import { db, getSettings, uid } from '../db';
import type { Exercise, Template, TemplateExercise, Workout, WorkoutExercise, WorkoutSet } from '../types';
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
  plan?: Omit<TemplateExercise, 'exerciseId'>,
  history?: Workout[],
): Promise<WorkoutExercise> {
  const settings = await getSettings();
  const sessions = exerciseSessions(history ?? (await finishedWorkouts()), exercise.id);
  const last = sessions[sessions.length - 1];

  if (!settings.progressionEnabled) {
    const sets: WorkoutSet[] = last
      ? last.sets.map((s) => ({ weight: s.weight, reps: s.reps, type: s.type, done: false }))
      : Array.from({ length: plan?.sets ?? 3 }, () => ({ weight: null, reps: null, type: 'normal', done: false }));
    return { exerciseId: exercise.id, sets };
  }

  const s = suggestProgression(exercise, sessions, {
    targetRir: settings.targetRir,
    sets: plan?.sets,
    repMin: plan?.repMin,
    repMax: plan?.repMax,
  });
  return {
    exerciseId: exercise.id,
    suggestion: `${s.action}|${s.explanation}`,
    sets: s.targets.map((t) => ({ weight: t.weight, reps: t.reps, type: 'normal', done: false })),
  };
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
    exercises: prev.exercises.map((e) => ({ exerciseId: e.exerciseId, sets: Math.max(e.sets.filter(isWorkingSet).length, 1) })),
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

export function templateFromWorkout(w: Workout, id = uid()): Template {
  return {
    id,
    name: w.name,
    updatedAt: Date.now(),
    exercises: w.exercises.map((e) => ({ exerciseId: e.exerciseId, sets: Math.max(e.sets.filter((s) => s.type !== 'warmup').length, 1) })),
  };
}

/** Opwarmsets richting het eerste werkgewicht: 40% × 10, 60% × 5, 80% × 3. */
export function warmupSets(workWeight: number, step: number): WorkoutSet[] {
  const r = (x: number) => Math.max(step, Math.round(x / step) * step);
  return [
    { weight: r(workWeight * 0.4), reps: 10, type: 'warmup', done: false },
    { weight: r(workWeight * 0.6), reps: 5, type: 'warmup', done: false },
    { weight: r(workWeight * 0.8), reps: 3, type: 'warmup', done: false },
  ];
}
