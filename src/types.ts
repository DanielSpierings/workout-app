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

export interface TemplateExercise {
  exerciseId: string;
  sets: number;
  repMin?: number;
  repMax?: number;
}

export interface Template {
  id: string;
  name: string;
  exercises: TemplateExercise[];
  updatedAt: number;
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
