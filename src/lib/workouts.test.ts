import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { Exercise, Template, Workout, WorkoutSet } from '../types';
import { addedExercises, buildExercise, templateFromWorkout } from './workouts';

const set = (done = true): WorkoutSet => ({ weight: 50, reps: 8, type: 'normal', done });

const template: Template = {
  id: 't1', name: 'Full Body #1', program: 'Programma', updatedAt: 0,
  exercises: [
    { exerciseId: 'leg-press', sets: 3, repMin: 6, repMax: 8, restSeconds: 120, rpe: 7, lastSetRpe: 8 },
    { exerciseId: 'lateral-raise-dumbbell', sets: 2, supersetGroup: 1 },
  ],
};

// Onvolledige workout: één set leg press, lateral raise overgeslagen, curl toegevoegd.
const workout: Workout = {
  id: 'w1', name: 'Full Body #1', templateId: 't1', startedAt: 0, endedAt: 1,
  exercises: [
    { exerciseId: 'leg-press', sets: [set()], plan: template.exercises[0] },
    { exerciseId: 'bicep-curl-dumbbell', sets: [set(), set()] },
  ],
};

describe('templates bijwerken', () => {
  it('voegt alleen nieuwe oefeningen toe en laat de planning ongemoeid', () => {
    expect(addedExercises(workout, template)).toEqual([{ exerciseId: 'bicep-curl-dumbbell', sets: 2 }]);
  });

  it('neemt de planning mee bij opslaan als nieuwe template', () => {
    const t = templateFromWorkout(workout, 'nieuw');
    expect(t.exercises[0]).toMatchObject({ exerciseId: 'leg-press', sets: 1, repMin: 6, restSeconds: 120, rpe: 7 });
  });
});

describe('advies bij het starten', () => {
  const curl: Exercise = { id: 'curl', name: 'Curl', muscle: 'biceps', equipment: 'dumbbell', lowerBody: false, repMin: 8, repMax: 12 };
  const reps = (r: number[]): WorkoutSet[] => r.map((n) => ({ weight: 12, reps: n, type: 'normal', done: true }));
  const prev: Workout = {
    id: 'p', name: 'Vorige', startedAt: Date.now() - 3 * 86_400_000, endedAt: Date.now(),
    exercises: [{ exerciseId: 'curl', sets: reps([10, 10, 11]), target: { weight: 12, reps: 10 } }],
  };

  it('bewaart het doel, zodat de volgende keer bekend is wat je moest halen', async () => {
    const block = await buildExercise(curl, undefined, [prev]);
    expect(block.target).toEqual({ weight: 12, reps: 11 });
    expect(block.sets.map((s) => s.reps)).toEqual([11, 11, 11]);
    expect(block.held).toBeUndefined();
  });

  it('kan vasthouden in plaats van verhogen', async () => {
    const block = await buildExercise(curl, undefined, [prev], true);
    expect(block.held).toBe(true);
    expect(block.suggestion?.startsWith('hold|')).toBe(true);
    expect(block.sets.map((s) => s.reps)).toEqual([10, 10, 10]);
  });
});
