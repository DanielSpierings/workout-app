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

describe('eigen geheugen per template', () => {
  const legPress: Exercise = { id: 'lp', name: 'Leg Press', muscle: 'quads', equipment: 'machine', lowerBody: true, repMin: 6, repMax: 8 };
  const day = 86_400_000;
  const work = (b: { sets: WorkoutSet[] }) => b.sets.filter((s) => s.type !== 'warmup');
  const lp = (weight: number, r: number[], rpe?: number): WorkoutSet[] => r.map((n) => ({ weight, reps: n, rpe, type: 'normal', done: true }));
  const session = (id: string, templateId: string | undefined, daysAgo: number, sets: WorkoutSet[], target?: { weight: number; reps: number }): Workout => ({
    id, name: templateId === 'fb1' ? 'Full Body #1' : templateId === 'fb2' ? 'Full Body #2' : 'Vrije workout',
    templateId, startedAt: Date.now() - daysAgo * day, endedAt: Date.now() - daysAgo * day + 3_600_000,
    exercises: [{ exerciseId: 'lp', sets, ...(target ? { target } : {}) }],
  });
  const fb2Plan = { sets: 3, repMin: 6, repMax: 8, rpe: 7, lastSetRpe: 8 };

  it('kijkt alleen naar eerdere keren in dezelfde template', async () => {
    const history = [
      session('a', 'fb2', 5, lp(130, [7, 7, 7]), { weight: 130, reps: 7 }),
      session('b', 'fb1', 2, lp(140, [7, 7, 7], 9), { weight: 140, reps: 7 }),
    ];
    const block = await buildExercise(legPress, fb2Plan, history, false, 'fb2');
    expect(work(block).map((s) => [s.weight, s.reps])).toEqual([[130, 8], [130, 8], [130, 8]]);
    // De andere template blijft ook op zichzelf.
    const fb1 = await buildExercise(legPress, { ...fb2Plan, rpe: 8, lastSetRpe: 9 }, history, false, 'fb1');
    expect(work(fb1).every((s) => s.weight === 140)).toBe(true);
  });

  it('neemt de eerste keer alleen het gewicht van elders over, op de ondergrens', async () => {
    const history = [session('b', 'fb1', 2, lp(140, [7, 7, 7]), { weight: 140, reps: 7 })];
    const block = await buildExercise(legPress, fb2Plan, history, false, 'fb2');
    expect(work(block).map((s) => [s.weight, s.reps])).toEqual([[140, 6], [140, 6], [140, 6]]);
    expect(block.suggestion).toMatch(/^first\|Eerste keer in deze template\. Startgewicht uit Full Body #1/);
  });

  it('gebruikt zonder template alle geschiedenis', async () => {
    const history = [session('a', 'fb2', 5, lp(130, [7, 7, 7])), session('b', 'fb1', 2, lp(140, [7, 7, 7]))];
    const block = await buildExercise(legPress, undefined, history);
    expect(work(block).every((s) => s.weight === 140 && s.reps === 8)).toBe(true);
  });
});
