import type { Exercise, Template, TemplateExercise } from '../types';
import { guessExercise, slug } from '../data/exercises';

/*
 * Import van trainingsprogramma's in het JSON-formaat (schema_version 1):
 * { program: { name }, workouts: [{ id, name, exercises: [{ name, working_sets, reps, ... }] }] }
 *
 * Stap 1 (analyzeProgram) controleert het bestand en koppelt elke oefeningnaam aan
 * de bibliotheek. Stap 2 (buildProgram) maakt de templates, met de keuzes die je
 * in het voorbeeldscherm eventueel hebt aangepast.
 */

interface Range {
  min: number;
  max: number;
}

export interface ProgramExerciseJson {
  order?: number;
  name: string;
  superset_group?: number | null;
  warmup_sets?: Range | null;
  working_sets: number;
  reps: Range;
  early_set_rpe?: Range | null;
  last_set_rpe?: Range | null;
  rest_seconds?: Range | null;
  last_set_technique?: string | null;
  substitutions?: string[] | null;
  note?: string | null;
}

export interface ProgramJson {
  schema_version: number;
  program: { name: string; [k: string]: unknown };
  workouts: { id?: string; name: string; exercises: ProgramExerciseJson[] }[];
  [k: string]: unknown;
}

export type MatchStatus = 'exact' | 'matched' | 'ambiguous' | 'new';

export interface NameMapping {
  name: string;
  status: MatchStatus;
  /** Gekozen oefening, of null voor een nieuwe oefening. */
  exerciseId: string | null;
  candidates: string[];
}

export interface ProgramAnalysis {
  program: ProgramJson;
  mappings: NameMapping[];
}

const EQUIPMENT = new Set(['barbell', 'dumbbell', 'machine', 'cable', 'kettlebell', 'bodyweight', 'band', 'smith']);
const STOPWORDS = new Set(['optional', 'assistance', 'assisted', 'the', 'with', 'and', 'a']);
const SYNONYMS: Record<string, string> = {
  biceps: 'bicep',
  tricep: 'triceps',
  db: 'dumbbell',
  bb: 'barbell',
  ez: 'barbell',
  raises: 'raise',
  curls: 'curl',
  pullup: 'pull up',
  pullups: 'pull up',
  chinup: 'chin up',
  pushup: 'push up',
  facepull: 'face pull',
};

/** Namen die niet via woorden te koppelen zijn, naar een oefening uit de standaardbibliotheek. */
const ALIASES: Record<string, string> = {
  'cable row': 'seated-row-cable',
  'seated cable row': 'seated-row-cable',
  'incline dumbbell press': 'incline-bench-press-dumbbell',
  'flat dumbbell press': 'bench-press-dumbbell',
  'dumbbell press': 'bench-press-dumbbell',
  'bench press': 'bench-press-barbell',
  'back squat': 'squat-barbell',
  'barbell back squat': 'squat-barbell',
  'dumbbell row': 'bent-over-one-arm-row-dumbbell',
  'hip thrust': 'hip-thrust-barbell',
  'dumbbell fly': 'chest-fly-dumbbell',
  'rope face pull': 'face-pull-cable',
  'triceps pushdown': 'triceps-pushdown-cable-straight-bar',
  'overhead press': 'overhead-press-barbell',
};

export function tokens(name: string): string[] {
  const words = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ez[- ]?bar/g, 'barbell')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .flatMap((w) => (SYNONYMS[w] ?? w).split(' '))
    .filter((w) => w && !STOPWORDS.has(w) && !/^\d+$/.test(w));
  return [...new Set(words)].sort();
}

function split(name: string) {
  const t = tokens(name);
  return { core: t.filter((w) => !EQUIPMENT.has(w)).join(' '), equipment: t.filter((w) => EQUIPMENT.has(w)) };
}

/** Koppelt een naam aan een oefening: exact, via alias, of via dezelfde woorden met passende uitrusting. */
export function matchExercise(name: string, exercises: Exercise[]): Omit<NameMapping, 'name'> {
  const lower = name.trim().toLowerCase();
  const exact = exercises.find((e) => e.name.toLowerCase() === lower);
  if (exact) return { status: 'exact', exerciseId: exact.id, candidates: [exact.id] };

  const alias = ALIASES[tokens(name).join(' ')] ?? ALIASES[lower];
  if (alias && exercises.some((e) => e.id === alias)) return { status: 'matched', exerciseId: alias, candidates: [alias] };

  const a = split(name);
  const candidates = exercises.filter((e) => {
    const b = split(e.name);
    if (b.core !== a.core) return false;
    return !a.equipment.length || !b.equipment.length || a.equipment.every((x) => b.equipment.includes(x));
  });
  if (candidates.length === 1) return { status: 'matched', exerciseId: candidates[0].id, candidates: [candidates[0].id] };
  if (candidates.length > 1) {
    // Voorkeur voor de halter-variant, daarna alfabetisch; het voorbeeldscherm vraagt om controle.
    const sorted = [...candidates].sort((x, y) => Number(y.equipment === 'barbell') - Number(x.equipment === 'barbell') || x.name.localeCompare(y.name));
    return { status: 'ambiguous', exerciseId: sorted[0].id, candidates: sorted.map((c) => c.id) };
  }
  return { status: 'new', exerciseId: null, candidates: [] };
}

function isRange(v: unknown): v is Range {
  return !!v && typeof v === 'object' && Number.isFinite((v as Range).min) && Number.isFinite((v as Range).max);
}

/** Controleert het bestand; gooit een fout met een Nederlandse uitleg als iets niet klopt. */
export function validateProgram(data: unknown): ProgramJson {
  const d = data as ProgramJson;
  if (!d || typeof d !== 'object') throw new Error('Het bestand bevat geen JSON-object.');
  if (d.schema_version !== 1) throw new Error(`Onbekende schema_version (${String(d.schema_version)}); alleen versie 1 wordt ondersteund.`);
  if (!d.program || typeof d.program.name !== 'string' || !d.program.name.trim()) throw new Error('program.name ontbreekt.');
  if (!Array.isArray(d.workouts) || !d.workouts.length) throw new Error('Er staan geen workouts in het bestand.');
  d.workouts.forEach((w, i) => {
    const where = `Workout ${i + 1}${w?.name ? ` (${w.name})` : ''}`;
    if (!w || typeof w.name !== 'string' || !w.name.trim()) throw new Error(`${where}: naam ontbreekt.`);
    if (!Array.isArray(w.exercises) || !w.exercises.length) throw new Error(`${where}: geen oefeningen.`);
    w.exercises.forEach((e, j) => {
      const at = `${where}, oefening ${j + 1}`;
      if (!e || typeof e.name !== 'string' || !e.name.trim()) throw new Error(`${at}: naam ontbreekt.`);
      if (!Number.isInteger(e.working_sets) || e.working_sets < 1) throw new Error(`${at} (${e.name}): working_sets moet een heel getal ≥ 1 zijn.`);
      if (!isRange(e.reps) || e.reps.min < 1 || e.reps.max < e.reps.min) throw new Error(`${at} (${e.name}): reps.min/reps.max kloppen niet.`);
      for (const key of ['warmup_sets', 'early_set_rpe', 'last_set_rpe', 'rest_seconds'] as const) {
        if (e[key] != null && !isRange(e[key])) throw new Error(`${at} (${e.name}): ${key} moet {min, max} zijn.`);
      }
    });
  });
  return d;
}

export function analyzeProgram(data: unknown, exercises: Exercise[]): ProgramAnalysis {
  const program = validateProgram(data);
  const names = [...new Set(program.workouts.flatMap((w) => w.exercises.map((e) => e.name.trim())))];
  return { program, mappings: names.map((name) => ({ name, ...matchExercise(name, exercises) })) };
}

const mid = (r: Range) => Math.round(((r.min + r.max) / 2) * 2) / 2;

function planFor(e: ProgramExerciseJson): Omit<TemplateExercise, 'exerciseId'> {
  const notes = [
    e.note?.trim(),
    e.last_set_technique?.trim() && `Laatste set: ${e.last_set_technique.trim()}`,
    e.substitutions?.length ? `Alternatieven: ${e.substitutions.join(', ')}` : '',
  ].filter(Boolean).join(' ');
  return {
    sets: e.working_sets,
    repMin: e.reps.min,
    repMax: e.reps.max,
    warmupSets: e.warmup_sets ? e.warmup_sets.min : undefined,
    restSeconds: e.rest_seconds ? e.rest_seconds.min : undefined,
    supersetGroup: e.superset_group ?? undefined,
    rpe: e.early_set_rpe ? mid(e.early_set_rpe) : undefined,
    lastSetRpe: e.last_set_rpe ? mid(e.last_set_rpe) : undefined,
    notes: notes || undefined,
  };
}

export function programTemplateId(programName: string, workout: { id?: string; name: string }): string {
  return `prog-${slug(programName)}-${slug(workout.id || workout.name)}`;
}

/**
 * Maakt templates en ontbrekende oefeningen. `choices` overschrijft de automatische
 * koppeling per naam (een exercise-id, of null voor een nieuwe oefening).
 */
export function buildProgram(
  analysis: ProgramAnalysis,
  exercises: Exercise[],
  choices: Record<string, string | null> = {},
  now = Date.now(),
): { templates: Template[]; newExercises: Exercise[] } {
  const { program } = analysis;
  const ids = new Set(exercises.map((e) => e.id));
  const resolved = new Map<string, string>();
  const newExercises: Exercise[] = [];

  for (const m of analysis.mappings) {
    const chosen = m.name in choices ? choices[m.name] : m.exerciseId;
    if (chosen && ids.has(chosen)) {
      resolved.set(m.name, chosen);
      continue;
    }
    const first = program.workouts.flatMap((w) => w.exercises).find((e) => e.name.trim() === m.name)!;
    let id = slug(m.name) || 'oefening';
    for (let n = 2; ids.has(id); n++) id = `${slug(m.name)}-${n}`;
    ids.add(id);
    newExercises.push({ id, name: m.name, custom: true, ...guessExercise(m.name), repMin: first.reps.min, repMax: first.reps.max });
    resolved.set(m.name, id);
  }

  const templates: Template[] = program.workouts.map((w) => ({
    id: programTemplateId(program.program.name, w),
    name: w.name.trim(),
    program: program.program.name.trim(),
    updatedAt: now,
    exercises: [...w.exercises]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((e) => ({ exerciseId: resolved.get(e.name.trim())!, ...planFor(e) })),
  }));
  return { templates, newExercises };
}
