import { describe, expect, it } from 'vitest';
import { SEED_EXERCISES } from '../data/exercises';
import { analyzeProgram, buildProgram, matchExercise, programTemplateId, validateProgram } from './programImport';

const ex = (name: string, extra: Record<string, unknown> = {}) => ({
  name, working_sets: 3, reps: { min: 8, max: 10 }, ...extra,
});

const program = {
  schema_version: 1,
  program: { name: 'Testprogramma A/B' },
  workouts: [
    {
      id: 'dag-a',
      name: 'Dag A',
      exercises: [
        ex('Dumbbell Lateral Raise', {
          order: 2, superset_group: 1, rest_seconds: { min: 30, max: 30 },
          early_set_rpe: { min: 9, max: 9 }, last_set_rpe: { min: 10, max: 10 },
          substitutions: ['Cable Lateral Raise'], note: 'Rustig laten zakken.',
        }),
        ex('Leg Press', { order: 1, warmup_sets: { min: 2, max: 3 }, rest_seconds: { min: 120, max: 180 }, early_set_rpe: { min: 7, max: 8 } }),
        ex('Pec Deck', { order: 3, reps: { min: 15, max: 20 } }),
      ],
    },
    { name: 'Dag B', exercises: [ex('Cable Row'), ex('EZ-Bar Skullcrusher'), ex('Pull-Up (Optional Assistance)'), ex('45° Back Extension')] },
  ],
};

describe('matchExercise', () => {
  const cases: [string, string | null][] = [
    ['Leg Press', 'leg-press'],
    ['Dumbbell Lateral Raise', 'lateral-raise-dumbbell'],
    ['Machine Chest Press', 'chest-press-machine'],
    ['Barbell Romanian Deadlift', 'romanian-deadlift-barbell'],
    ['EZ-Bar Skullcrusher', 'skullcrusher-barbell'],
    ['Pull-Up (Optional Assistance)', 'pull-up'],
    ['45° Back Extension', 'back-extension'],
    ['Seated Calf Raise', 'seated-calf-raise-machine'],
    ['Lat Pulldown', 'lat-pulldown-cable'],
    ['Cable Row', 'seated-row-cable'],
    ['Incline Dumbbell Press', 'incline-bench-press-dumbbell'],
    ['Pec Deck', null],
  ];
  it.each(cases)('%s → %s', (name, id) => {
    expect(matchExercise(name, SEED_EXERCISES).exerciseId).toBe(id);
  });

  it('meldt dubbelzinnige namen en kiest de halter-variant voor', () => {
    const m = matchExercise('Bicep Curl', SEED_EXERCISES);
    expect(m.status).toBe('ambiguous');
    expect(m.exerciseId).toBe('bicep-curl-barbell');
    expect(m.candidates).toContain('bicep-curl-dumbbell');
  });

  it('koppelt geen andere uitrusting', () => {
    expect(matchExercise('Kettlebell Romanian Deadlift', SEED_EXERCISES).status).toBe('new');
  });
});

describe('validateProgram', () => {
  it('geeft een duidelijke fout met de plek van het probleem', () => {
    const bad = structuredClone(program);
    (bad.workouts[1].exercises[0] as { working_sets: number }).working_sets = 0;
    expect(() => validateProgram(bad)).toThrow(/Workout 2 \(Dag B\), oefening 1 \(Cable Row\): working_sets/);
    expect(() => validateProgram({ ...program, schema_version: 2 })).toThrow(/schema_version/);
    expect(() => validateProgram({ ...program, workouts: [] })).toThrow(/geen workouts/);
  });
});

describe('buildProgram', () => {
  const analysis = analyzeProgram(program, SEED_EXERCISES);

  it('zet het programma om in templates met planning', () => {
    const { templates, newExercises } = buildProgram(analysis, SEED_EXERCISES, {}, 1);
    expect(templates.map((t) => t.name)).toEqual(['Dag A', 'Dag B']);
    expect(templates[0].program).toBe('Testprogramma A/B');
    expect(templates[0].exercises.map((e) => e.exerciseId)).toEqual(['leg-press', 'lateral-raise-dumbbell', 'pec-deck']);
    expect(templates[0].exercises[0]).toMatchObject({ sets: 3, repMin: 8, repMax: 10, warmupSets: 2, restSeconds: 120, rpe: 7.5 });
    expect(templates[0].exercises[1]).toMatchObject({
      supersetGroup: 1, restSeconds: 30, rpe: 9, lastSetRpe: 10,
      notes: 'Rustig laten zakken. Alternatieven: Cable Lateral Raise',
    });
    expect(newExercises).toHaveLength(1);
    expect(newExercises[0]).toMatchObject({ id: 'pec-deck', muscle: 'chest', equipment: 'machine', repMin: 15, repMax: 20, custom: true });
  });

  it('gebruikt vaste template-ids, zodat opnieuw importeren bijwerkt in plaats van dupliceert', () => {
    const a = buildProgram(analysis, SEED_EXERCISES).templates.map((t) => t.id);
    const b = buildProgram(analyzeProgram(program, SEED_EXERCISES), SEED_EXERCISES).templates.map((t) => t.id);
    expect(a).toEqual(b);
    expect(a[0]).toBe(programTemplateId('Testprogramma A/B', { id: 'dag-a', name: 'Dag A' }));
    expect(a[1]).toBe('prog-testprogramma-a-b-dag-b');
  });

  it('respecteert handmatige keuzes', () => {
    const { templates, newExercises } = buildProgram(analysis, SEED_EXERCISES, { 'Pec Deck': 'chest-fly-dumbbell', 'Cable Row': null });
    expect(templates[0].exercises[2].exerciseId).toBe('chest-fly-dumbbell');
    expect(newExercises.map((e) => e.name)).toEqual(['Cable Row']);
    expect(newExercises[0].id).toBe('cable-row');
  });
});
