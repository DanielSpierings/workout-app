import { describe, expect, it } from 'vitest';
import type { Workout, WorkoutSet } from '../types';
import { setsPerMuscle, startOfWeek } from './stats';

const set: WorkoutSet = { weight: 50, reps: 8, type: 'normal', done: true };
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();
const workout = (startedAt: number, sets = 3): Workout => ({
  id: String(startedAt), name: 'W', startedAt, endedAt: startedAt + 3_600_000,
  exercises: [{ exerciseId: 'squat', sets: Array(sets).fill(set) }],
});
const muscle = () => 'quads';

describe('startOfWeek', () => {
  it('geeft maandag 00:00 van dezelfde week', () => {
    const monday = new Date(2026, 10, 2).getTime(); // ma 2 nov 2026
    expect(startOfWeek(at(2026, 11, 2, 0))).toBe(monday);
    expect(startOfWeek(at(2026, 11, 4))).toBe(monday); // woensdag
    expect(startOfWeek(at(2026, 11, 8, 23))).toBe(monday); // zondagavond
  });
});

describe('setsPerMuscle', () => {
  it('telt alleen workouts van maandag t/m zondag van de huidige week', () => {
    const workouts = [
      workout(at(2026, 11, 1, 20), 5), // zondag ervoor: telt niet mee
      workout(at(2026, 11, 2, 9), 3), // maandag
      workout(at(2026, 11, 4, 18), 4), // woensdag
    ];
    expect(setsPerMuscle(workouts, muscle, startOfWeek(at(2026, 11, 4, 19)))).toEqual({ quads: 7 });
  });

  it('begint op maandag weer bij nul', () => {
    const workouts = [workout(at(2026, 11, 7)), workout(at(2026, 11, 8))];
    expect(setsPerMuscle(workouts, muscle, startOfWeek(at(2026, 11, 9, 8)))).toEqual({});
  });
});
