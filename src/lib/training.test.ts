import { describe, expect, it } from 'vitest';
import { SEED_EXERCISES } from '../data/exercises';
import type { Exercise, WorkoutExercise, WorkoutSet } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { isCompound, restAfter, syncWarmups, warmupCount, warmupSet } from './training';

const byName = (n: string) => SEED_EXERCISES.find((e) => e.name === n)!;
const byId = new Map(SEED_EXERCISES.map((e) => [e.id, e]));

describe('isCompound', () => {
  it.each([
    ['Squat (Barbell)', true], ['Bench Press (Barbell)', true], ['Leg Press', true], ['Romanian Deadlift (Barbell)', true],
    ['Seated Row (Cable)', true], ['Overhead Press (Dumbbell)', true], ['Hip Thrust (Barbell)', true],
    ['Leg Extension (Machine)', false], ['Lateral Raise (Dumbbell)', false], ['Bicep Curl (Barbell)', false],
    ['Standing Calf Raise (Machine)', false], ['Triceps Pushdown (Cable - Straight Bar)', false], ['Chest Fly (Dumbbell)', false],
    ['Leg Press Calf Press', false], ['Pec Deck', false],
  ])('%s → %s', (name, expected) => {
    expect(isCompound({ name })).toBe(expected);
  });
});

describe('warmupCount', () => {
  const squat = byName('Squat (Barbell)');
  const raise = byName('Lateral Raise (Dumbbell)');
  it('geeft compound-oefeningen standaard één opwarmset', () => {
    expect(warmupCount(squat)).toBe(1);
    expect(warmupCount(raise)).toBe(0);
  });
  it('houdt het bij hooguit één, ook als een programma er meer vraagt', () => {
    expect(warmupCount(squat, { sets: 3, warmupSets: 3 })).toBe(1);
    expect(warmupCount(raise, { sets: 3, warmupSets: 0 })).toBe(0);
  });
  it('laat de keuze bij de oefening voorgaan', () => {
    expect(warmupCount({ ...squat, warmup: false }, { sets: 3, warmupSets: 2 })).toBe(0);
    expect(warmupCount({ ...raise, warmup: true })).toBe(1);
  });
});

describe('opwarmset', () => {
  const bench = byName('Bench Press (Barbell)');
  it('is ~60% × 8, afgerond op de kleinste stap', () => {
    expect(warmupSet(100, bench)).toMatchObject({ weight: 60, reps: 8, type: 'warmup', auto: true });
    expect(warmupSet(82.5, bench).weight).toBe(50); // 49,5 → 50
    expect(warmupSet(null, bench).weight).toBeNull();
  });
  it('rekent mee met het werkgewicht, behalve als hij al is afgevinkt', () => {
    const w = (weight: number | null, done = false): WorkoutSet => ({ weight, reps: 8, type: 'normal', done });
    const sets = [warmupSet(null, bench), w(90), w(90)];
    expect(syncWarmups(sets, bench)[0].weight).toBe(55);
    const done = [{ ...warmupSet(100, bench), done: true }, w(80)];
    expect(syncWarmups(done, bench)[0].weight).toBe(60);
    const manual: WorkoutSet = { weight: 20, reps: 10, type: 'warmup', done: false };
    expect(syncWarmups([manual, w(100)], bench)[0].weight).toBe(20);
  });
});

describe('restAfter', () => {
  const block = (exerciseId: string, plan?: WorkoutExercise['plan']): WorkoutExercise => ({ exerciseId, sets: [], plan });
  const s = DEFAULT_SETTINGS;

  it('gebruikt compound- of isolatierust als de template niets zegt', () => {
    const list = [block('squat-barbell'), block('lateral-raise-dumbbell')];
    expect(restAfter(list, 0, byId, s)).toEqual({ seconds: 120, kind: 'normal' });
    expect(restAfter(list, 1, byId, s)).toEqual({ seconds: 90, kind: 'normal' });
  });

  it('gebruikt de rust uit de template', () => {
    expect(restAfter([block('leg-press', { sets: 3, restSeconds: 150 })], 0, byId, s).seconds).toBe(150);
  });

  it('kort tussen superset-oefeningen, lang na de laatste van de ronde', () => {
    const list = [
      block('leg-press'),
      block('back-extension', { sets: 2, supersetGroup: 1, restSeconds: 30 }),
      block('lateral-raise-dumbbell', { sets: 2, supersetGroup: 1, restSeconds: 30 }),
    ];
    expect(restAfter(list, 1, byId, s)).toEqual({ seconds: 30, kind: 'between' });
    expect(restAfter(list, 2, byId, s)).toEqual({ seconds: 90, kind: 'round' });
    list[2] = { ...list[2], plan: { ...list[2].plan!, roundRestSeconds: 60 } };
    expect(restAfter(list, 2, byId, s).seconds).toBe(60);
  });

  it('neemt de langste standaardrust van de groep na een ronde met een compound-oefening', () => {
    const custom: Exercise = { ...byName('Bench Press (Barbell)') };
    const list = [block(custom.id, { sets: 3, supersetGroup: 2 }), block('bicep-curl-dumbbell', { sets: 3, supersetGroup: 2 })];
    expect(restAfter(list, 1, byId, s).seconds).toBe(120);
  });
});
