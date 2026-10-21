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
  /** Automatische opwarmset: leeg = alleen bij compound-oefeningen, true = altijd, false = nooit. */
  warmup?: boolean;
}

export type SetType = 'normal' | 'warmup' | 'drop' | 'failure';

export interface WorkoutSet {
  weight: number | null;
  reps: number | null;
  rpe?: number | null;
  type: SetType;
  done: boolean;
  /** Door de app berekende opwarmset die meebeweegt met het werkgewicht. */
  auto?: boolean;
}

export interface WorkoutExercise {
  exerciseId: string;
  sets: WorkoutSet[];
  notes?: string;
  /** Uitleg van de progressie-engine voor deze workout, zodat je ziet waarom. */
  suggestion?: string;
  /** Planning uit de template (rust, superset, doel-RPE), meegenomen in de workout. */
  plan?: ExercisePlan;
  /** Doel van de progressie-engine bij de start; haal je het niet, dan blijft het doel staan. */
  target?: { weight: number | null; reps: number };
  /** Zelf gekozen om vast te houden in plaats van het advies te volgen. */
  held?: boolean;
  /** Zelf gemarkeerd als zwaar; de engine houdt de volgende keer vast. */
  hard?: boolean;
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
  /** Rusttijd na een set van deze oefening; leeg = standaard uit Instellingen.
   *  In een superset: de rust tussen deze oefening en de volgende. */
  restSeconds?: number;
  /** In een superset: rust na de laatste oefening van de ronde; leeg = standaard. */
  roundRestSeconds?: number;
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

export type SoundKind = 'bell' | 'bowl' | 'chime';
export type Theme = 'auto' | 'light' | 'dark';

export interface Settings {
  id: 'settings';
  /** Standaard rust bij compound-oefeningen. */
  restSeconds: number;
  /** Standaard rust bij isolatie-oefeningen. */
  restIsolationSeconds: number;
  /** Beoogde herhalingen in reserve (RIR) op werksets. */
  targetRir: number;
  progressionEnabled: boolean;
  sound: boolean;
  soundKind: SoundKind;
  theme: Theme;
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  restSeconds: 120,
  restIsolationSeconds: 90,
  targetRir: 2,
  progressionEnabled: true,
  sound: true,
  soundKind: 'bell',
  theme: 'auto',
};
