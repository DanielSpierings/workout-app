import { describe, expect, it } from 'vitest';
import type { Exercise, WorkoutSet } from '../types';
import { roundTo, suggestProgression } from './progression';
import { e1rm, type ExerciseSession } from './stats';

const bench: Exercise = {
  id: 'bench', name: 'Bench Press (Barbell)', muscle: 'chest', equipment: 'barbell',
  lowerBody: false, repMin: 6, repMax: 10,
};
const squat: Exercise = { ...bench, id: 'squat', name: 'Squat (Barbell)', muscle: 'quads', lowerBody: true };
const pullup: Exercise = { ...bench, id: 'pu', name: 'Pull Up', equipment: 'bodyweight', repMin: 5, repMax: 10 };

const NOW = new Date(2026, 8, 24).getTime();
const DAY = 86_400_000;

function session(daysAgo: number, weight: number, reps: number[], rpe?: number): ExerciseSession {
  const sets: WorkoutSet[] = reps.map((r) => ({ weight, reps: r, rpe: rpe ?? null, type: 'normal', done: true }));
  return {
    workoutId: String(daysAgo), date: NOW - daysAgo * DAY, sets,
    bestE1rm: Math.max(...reps.map((r) => e1rm(weight, r))), topWeight: weight,
    volume: reps.reduce((a, r) => a + r * weight, 0),
  };
}

const opts = { targetRir: 2, now: NOW };

describe('suggestProgression', () => {
  it('geeft een startadvies zonder historie', () => {
    const s = suggestProgression(bench, [], opts);
    expect(s.action).toBe('first');
    expect(s.targets).toHaveLength(3);
    expect(s.targets[0].weight).toBeNull();
  });

  it('voegt herhalingen toe binnen het bereik', () => {
    const s = suggestProgression(bench, [session(3, 80, [8, 7, 7])], opts);
    expect(s.action).toBe('reps');
    expect(s.targets.map((t) => t.reps)).toEqual([9, 8, 8]);
    expect(s.targets.every((t) => t.weight === 80)).toBe(true);
  });

  it('verhoogt het gewicht (bovenlichaam ~2,5%, min. één stap) bij de bovengrens', () => {
    const s = suggestProgression(bench, [session(3, 80, [10, 10, 10])], opts);
    expect(s.action).toBe('increase');
    expect(s.targets[0]).toEqual({ weight: 82.5, reps: 8 }); // Epley: ~8,8 herhalingen op 82,5 kg
  });

  it('verhoogt onderlichaam met ~5%', () => {
    const s = suggestProgression(squat, [session(3, 100, [10, 10, 10])], opts);
    expect(s.targets[0].weight).toBe(105);
  });

  it('springt verder via e1RM als het veel te makkelijk was, maar maximaal +10%', () => {
    const s = suggestProgression(bench, [session(3, 60, [15, 15, 14], 6)], opts);
    expect(s.action).toBe('increase');
    expect(s.targets[0]).toEqual({ weight: 65, reps: 8 }); // e1RM zou ~66 geven, begrensd op +10% → afgerond 65
  });

  it('verhoogt niet als de bovengrens alleen met falen werd gehaald', () => {
    const s = suggestProgression(bench, [session(3, 80, [10, 10, 10], 10)], opts);
    expect(s.action).toBe('hold');
    expect(s.targets[0].weight).toBe(80);
  });

  it('houdt het gewicht vast na één sessie onder de ondergrens', () => {
    const s = suggestProgression(bench, [session(6, 80, [7, 7, 6]), session(3, 82.5, [6, 5, 4])], opts);
    expect(s.action).toBe('hold');
    expect(s.targets[0]).toEqual({ weight: 82.5, reps: 6 });
  });

  it('deload na twee sessies onder de ondergrens', () => {
    const s = suggestProgression(bench, [session(6, 82.5, [5, 5, 4]), session(3, 82.5, [6, 5, 4])], opts);
    expect(s.action).toBe('deload');
    expect(s.targets[0].weight).toBe(75); // 90% van 82,5 = 74,25 → 75
  });

  it('telt vooruitgang in latere sets niet als stagnatie', () => {
    const s = suggestProgression(bench, [
      session(9, 80, [8, 7, 7]), session(6, 80, [8, 8, 7]), session(3, 80, [8, 8, 8]),
    ], opts);
    expect(s.action).toBe('reps');
    expect(s.targets.map((t) => t.reps)).toEqual([9, 9, 9]);
  });

  it('deload bij drie sessies zonder vooruitgang', () => {
    const s = suggestProgression(bench, [
      session(9, 80, [8, 8, 7]), session(6, 80, [8, 7, 7]), session(3, 80, [8, 7, 7]),
    ], opts);
    expect(s.action).toBe('deload');
  });

  it('start lager na een lange pauze', () => {
    const s = suggestProgression(bench, [session(40, 80, [8, 8, 8])], opts);
    expect(s.action).toBe('return');
    expect(s.targets[0].weight).toBe(72.5);
  });

  it('stelt gewicht toevoegen voor bij lichaamsgewicht-oefeningen op de bovengrens', () => {
    const s = suggestProgression(pullup, [session(3, 0, [10, 10, 11])], opts);
    expect(s.action).toBe('increase');
    expect(s.targets[0]).toEqual({ weight: 2.5, reps: 5 });
  });

  it('verlaagt het doel na een verhoging nooit onder de ondergrens', () => {
    const s = suggestProgression({ ...bench, increment: 10 }, [session(3, 20, [10, 10, 10])], opts);
    expect(s.targets[0]).toEqual({ weight: 30, reps: 6 });
  });

  it('respecteert een ander aantal sets uit de template', () => {
    const s = suggestProgression(bench, [session(3, 80, [8, 8])], { ...opts, sets: 4 });
    expect(s.targets).toHaveLength(4);
    expect(s.targets[3].reps).toBe(9);
  });

  it('rondt af op de gewichtsstap', () => {
    expect(roundTo(74.25, 2.5)).toBe(75);
    expect(roundTo(21.1, 2)).toBe(22);
  });
});
