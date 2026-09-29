export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'kettlebell' | 'other';

export type Muscle =
  | 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'forearms'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'core' | 'fullbody' | 'other';

export interface Exercise {
  id: string;
  name: string;
  muscle: Muscle;
  equipment: Equipment;
  /** Onderlichaam-oefeningen krijgen grotere relatieve gewichtsstappen. */
  lowerBody: boolean;
  /** Kleinste gewichtsstap in kg; leeg = standaard voor het type uitrusting. */
  increment?: number;
  /** Doelbereik voor herhalingen, gebruikt door de progressie-engine. */
  repMin: number;
  repMax: number;
  custom?: boolean;
}

export type SetType = 'normal' | 'warmup' | 'drop' | 'failure';

export interface WorkoutSet {
  weight: number | null;
  reps: number | null;
  rpe?: number | null;
  type: SetType;
  done: boolean;
}

export interface WorkoutExercise {
  exerciseId: string;
  sets: WorkoutSet[];
  notes?: string;
  /** Uitleg van de progressie-engine voor deze workout, zodat je ziet waarom. */
  suggestion?: string;
  /** Planning uit de template (rust, superset, doel-RPE), meegenomen in de workout. */
  plan?: ExercisePlan;
}

export interface Workout {
  id: string;
  name: string;
  templateId?: string;
  startedAt: number;
  endedAt?: number;
  notes?: string;
  exercises: WorkoutExercise[];
  source?: 'app' | 'strong';
}

export interface ExercisePlan {
  /** Aantal werksets. */
  sets: number;
  repMin?: number;
  repMax?: number;
  /** Aantal opwarmsets dat bij de start wordt toegevoegd (als er een werkgewicht bekend is). */
  warmupSets?: number;
  /** Rusttijd na een set van deze oefening; leeg = standaard uit Instellingen. */
  restSeconds?: number;
  /** Oefeningen met hetzelfde nummer vormen samen een superset. */
  supersetGroup?: number;
  /** Doel-RPE voor alle sets behalve de laatste. */
  rpe?: number;
  /** Doel-RPE voor de laatste set. */
  lastSetRpe?: number;
  notes?: string;
}

export interface TemplateExercise extends ExercisePlan {
  exerciseId: string;
}

export interface Template {
  id: string;
  name: string;
  exercises: TemplateExercise[];
  updatedAt: number;
  /** Programma waar deze template bij hoort (bij import). */
  program?: string;
}

export interface Settings {
  id: 'settings';
  restSeconds: number;
  /** Beoogde herhalingen in reserve (RIR) op werksets. */
  targetRir: number;
  progressionEnabled: boolean;
  sound: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  restSeconds: 120,
  targetRir: 2,
  progressionEnabled: true,
  sound: true,
};
