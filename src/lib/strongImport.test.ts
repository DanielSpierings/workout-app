import { describe, expect, it } from 'vitest';
import { SEED_EXERCISES } from '../data/exercises';
import { detectDelimiter, parseCsv, toCsv } from './csv';
import { importStrongCsv, parseDuration, parseNumber } from './strongImport';

let n = 0;
const id = () => `id${++n}`;

describe('csv', () => {
  it('parset aanhalingstekens en regeleinden in velden', () => {
    const rows = parseCsv('a,b\n"x, y","regel1\nregel2"\n"met ""quote""",3\n');
    expect(rows).toEqual([['a', 'b'], ['x, y', 'regel1\nregel2'], ['met "quote"', '3']]);
  });
  it('herkent puntkomma als scheidingsteken', () => {
    expect(detectDelimiter('Date;Workout Name;Exercise Name\n')).toBe(';');
  });
  it('round-trip via toCsv', () => {
    const data = [['a', 'b,c'], ['"q"', '1']];
    expect(parseCsv(toCsv(data))).toEqual(data);
  });
});

describe('parsers', () => {
  it('getallen in EU- en US-notatie', () => {
    expect(parseNumber('80,5')).toBe(80.5);
    expect(parseNumber('1.234,5')).toBe(1234.5);
    expect(parseNumber('1,234.5')).toBe(1234.5);
    expect(parseNumber('')).toBeNull();
  });
  it('duur', () => {
    expect(parseDuration('1h 5m')).toBe(3900);
    expect(parseDuration('45m')).toBe(2700);
    expect(parseDuration('3900', true)).toBe(3900);
  });
});

describe('importStrongCsv', () => {
  it('importeert de nieuwe Strong-export (komma, kg, Rest Timer-regels)', () => {
    const csv = [
      'Workout #,Date,Workout Name,Duration (sec),Exercise Name,Set Order,Weight (kg),Reps,RPE,Distance (meters),Seconds,Notes,Workout Notes',
      '1,2024-03-01 18:00:00,"Push",3600,"Bench Press (Barbell)",W,40,10,,,,,',
      '1,2024-03-01 18:00:00,"Push",3600,"Bench Press (Barbell)",1,80,8,8,,,,',
      '1,2024-03-01 18:00:00,"Push",3600,"Bench Press (Barbell)",Rest Timer,,,,,120,,',
      '1,2024-03-01 18:00:00,"Push",3600,"Bench Press (Barbell)",2,80,7,8.5,,,,',
      '1,2024-03-01 18:00:00,"Push",3600,"Cable Fly Superset",1,15,12,,,,,',
      '2,2024-03-03 10:00:00,"Legs",4200,"Squat (Barbell)",1,100,5,,,,,',
      '2,2024-03-03 10:00:00,"Legs",4200,"Running",1,,,,5000,1500,,',
    ].join('\n');
    const r = importStrongCsv(csv, SEED_EXERCISES, id);
    expect(r.workouts).toHaveLength(2);
    const push = r.workouts[0];
    expect(push.name).toBe('Push');
    expect(push.endedAt! - push.startedAt).toBe(3600_000);
    expect(push.exercises[0].exerciseId).toBe('bench-press-barbell');
    expect(push.exercises[0].sets.map((s) => [s.type, s.weight, s.reps, s.rpe])).toEqual([
      ['warmup', 40, 10, null], ['normal', 80, 8, 8], ['normal', 80, 7, 8.5],
    ]);
    expect(r.newExercises.map((e) => e.name)).toEqual(['Cable Fly Superset']);
    expect(r.newExercises[0].muscle).toBe('chest');
    expect(r.skippedRows).toBe(2); // rest timer + cardio
  });

  it('importeert de oude export (puntkomma, lbs, aparte eenheidkolom)', () => {
    const csv = [
      'Date;Workout Name;Exercise Name;Set Order;Weight;Weight Unit;Reps;RPE;Distance;Distance Unit;Seconds;Notes;Workout Notes;Workout Duration',
      '2021-05-10 07:30:00;Full body;Deadlift (Barbell);1;225;lbs;5;;;;0;"Voelde sterk";"Goede dag";1h 5m',
    ].join('\n');
    const r = importStrongCsv(csv, SEED_EXERCISES, id);
    const w = r.workouts[0];
    expect(w.exercises[0].sets[0].weight).toBeCloseTo(102.06, 2);
    expect(w.exercises[0].notes).toBe('Voelde sterk');
    expect(w.notes).toBe('Goede dag');
    expect(w.endedAt! - w.startedAt).toBe(3900_000);
  });

  it('geeft een duidelijke fout bij een verkeerd bestand', () => {
    expect(() => importStrongCsv('foo,bar\n1,2', SEED_EXERCISES, id)).toThrow(/Strong-export/);
  });
});
