import type { Equipment, Exercise, Muscle } from '../types';

export function slug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function ex(
  name: string,
  muscle: Muscle,
  equipment: Equipment,
  lowerBody: boolean,
  repMin: number,
  repMax: number,
): Exercise {
  return { id: slug(name), name, muscle, equipment, lowerBody, repMin, repMax };
}

// Namen volgen de conventie van Strong ("Oefening (Uitrusting)") zodat een
// Strong-export zonder handwerk aan de juiste oefening wordt gekoppeld.
export const SEED_EXERCISES: Exercise[] = [
  // Borst
  ex('Bench Press (Barbell)', 'chest', 'barbell', false, 5, 8),
  ex('Incline Bench Press (Barbell)', 'chest', 'barbell', false, 6, 10),
  ex('Bench Press (Dumbbell)', 'chest', 'dumbbell', false, 8, 12),
  ex('Incline Bench Press (Dumbbell)', 'chest', 'dumbbell', false, 8, 12),
  ex('Chest Fly (Dumbbell)', 'chest', 'dumbbell', false, 10, 15),
  ex('Chest Press (Machine)', 'chest', 'machine', false, 8, 12),
  ex('Cable Crossover', 'chest', 'cable', false, 10, 15),
  ex('Push Up', 'chest', 'bodyweight', false, 8, 20),
  ex('Chest Dip', 'chest', 'bodyweight', false, 6, 12),
  // Rug
  ex('Deadlift (Barbell)', 'back', 'barbell', true, 3, 6),
  ex('Bent Over Row (Barbell)', 'back', 'barbell', false, 6, 10),
  ex('Bent Over One Arm Row (Dumbbell)', 'back', 'dumbbell', false, 8, 12),
  ex('Pull Up', 'back', 'bodyweight', false, 5, 10),
  ex('Chin Up', 'back', 'bodyweight', false, 5, 10),
  ex('Lat Pulldown (Cable)', 'back', 'cable', false, 8, 12),
  ex('Seated Row (Cable)', 'back', 'cable', false, 8, 12),
  ex('T Bar Row', 'back', 'barbell', false, 8, 12),
  ex('Iso-Lateral Row (Machine)', 'back', 'machine', false, 8, 12),
  ex('Back Extension', 'back', 'bodyweight', true, 10, 15),
  ex('Shrug (Dumbbell)', 'back', 'dumbbell', false, 10, 15),
  // Schouders
  ex('Overhead Press (Barbell)', 'shoulders', 'barbell', false, 5, 8),
  ex('Overhead Press (Dumbbell)', 'shoulders', 'dumbbell', false, 8, 12),
  ex('Seated Overhead Press (Dumbbell)', 'shoulders', 'dumbbell', false, 8, 12),
  ex('Lateral Raise (Dumbbell)', 'shoulders', 'dumbbell', false, 12, 20),
  ex('Lateral Raise (Cable)', 'shoulders', 'cable', false, 12, 20),
  ex('Reverse Fly (Dumbbell)', 'shoulders', 'dumbbell', false, 12, 20),
  ex('Face Pull (Cable)', 'shoulders', 'cable', false, 12, 20),
  ex('Shoulder Press (Machine)', 'shoulders', 'machine', false, 8, 12),
  // Armen
  ex('Bicep Curl (Barbell)', 'biceps', 'barbell', false, 8, 12),
  ex('Bicep Curl (Dumbbell)', 'biceps', 'dumbbell', false, 8, 12),
  ex('Hammer Curl (Dumbbell)', 'biceps', 'dumbbell', false, 8, 12),
  ex('Preacher Curl (Barbell)', 'biceps', 'barbell', false, 8, 12),
  ex('Bicep Curl (Cable)', 'biceps', 'cable', false, 10, 15),
  ex('Triceps Pushdown (Cable - Straight Bar)', 'triceps', 'cable', false, 10, 15),
  ex('Triceps Extension (Cable)', 'triceps', 'cable', false, 10, 15),
  ex('Skullcrusher (Barbell)', 'triceps', 'barbell', false, 8, 12),
  ex('Triceps Dip', 'triceps', 'bodyweight', false, 6, 12),
  ex('Close Grip Bench Press (Barbell)', 'triceps', 'barbell', false, 6, 10),
  ex('Wrist Curl (Barbell)', 'forearms', 'barbell', false, 12, 20),
  // Benen
  ex('Squat (Barbell)', 'quads', 'barbell', true, 5, 8),
  ex('Front Squat (Barbell)', 'quads', 'barbell', true, 5, 8),
  ex('Leg Press', 'quads', 'machine', true, 8, 12),
  ex('Hack Squat', 'quads', 'machine', true, 8, 12),
  ex('Leg Extension (Machine)', 'quads', 'machine', true, 10, 15),
  ex('Lunge (Dumbbell)', 'quads', 'dumbbell', true, 8, 12),
  ex('Bulgarian Split Squat', 'quads', 'dumbbell', true, 8, 12),
  ex('Goblet Squat (Kettlebell)', 'quads', 'kettlebell', true, 8, 15),
  ex('Romanian Deadlift (Barbell)', 'hamstrings', 'barbell', true, 6, 10),
  ex('Romanian Deadlift (Dumbbell)', 'hamstrings', 'dumbbell', true, 8, 12),
  ex('Seated Leg Curl (Machine)', 'hamstrings', 'machine', true, 10, 15),
  ex('Lying Leg Curl (Machine)', 'hamstrings', 'machine', true, 10, 15),
  ex('Hip Thrust (Barbell)', 'glutes', 'barbell', true, 8, 12),
  ex('Glute Kickback (Cable)', 'glutes', 'cable', true, 10, 15),
  ex('Hip Abductor (Machine)', 'glutes', 'machine', true, 12, 20),
  ex('Standing Calf Raise (Machine)', 'calves', 'machine', true, 10, 15),
  ex('Seated Calf Raise (Machine)', 'calves', 'machine', true, 10, 15),
  // Core
  ex('Crunch', 'core', 'bodyweight', false, 12, 25),
  ex('Hanging Leg Raise', 'core', 'bodyweight', false, 8, 15),
  ex('Cable Crunch', 'core', 'cable', false, 10, 15),
  ex('Ab Wheel', 'core', 'bodyweight', false, 8, 15),
  // Full body
  ex('Kettlebell Swing', 'fullbody', 'kettlebell', true, 12, 20),
  ex('Clean and Press (Barbell)', 'fullbody', 'barbell', true, 3, 6),
];

export const MUSCLE_LABELS: Record<Muscle, string> = {
  chest: 'Borst',
  back: 'Rug',
  shoulders: 'Schouders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Onderarmen',
  quads: 'Quadriceps',
  hamstrings: 'Hamstrings',
  glutes: 'Billen',
  calves: 'Kuiten',
  core: 'Core',
  fullbody: 'Full body',
  other: 'Overig',
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Halter (barbell)',
  dumbbell: 'Dumbbell',
  machine: 'Machine',
  cable: 'Kabel',
  bodyweight: 'Lichaamsgewicht',
  kettlebell: 'Kettlebell',
  other: 'Overig',
};

/** Standaard kleinste gewichtsstap per type uitrusting (kg). */
export const DEFAULT_INCREMENT: Record<Equipment, number> = {
  barbell: 2.5,
  dumbbell: 2,
  machine: 2.5,
  cable: 2.5,
  bodyweight: 2.5,
  kettlebell: 4,
  other: 2.5,
};

/** Probeert spiergroep en uitrusting af te leiden uit een onbekende Strong-naam. */
export function guessExercise(name: string): Pick<Exercise, 'muscle' | 'equipment' | 'lowerBody' | 'repMin' | 'repMax'> {
  const n = name.toLowerCase();
  const equipment: Equipment = n.includes('barbell') ? 'barbell'
    : n.includes('dumbbell') ? 'dumbbell'
    : n.includes('machine') || n.includes('smith') || n.includes('leg press') ? 'machine'
    : n.includes('cable') ? 'cable'
    : n.includes('kettlebell') ? 'kettlebell'
    : n.includes('band') || n.includes('assisted') || n.includes('bodyweight') ? 'bodyweight'
    : 'other';
  const rules: [RegExp, Muscle][] = [
    [/calf/, 'calves'],
    [/hip thrust|glute|abduct|kickback/, 'glutes'],
    [/leg curl|romanian|rdl|good morning|stiff/, 'hamstrings'],
    [/squat|leg press|lunge|leg extension|step up|split/, 'quads'],
    [/deadlift|row|pull ?up|chin ?up|pulldown|shrug|back extension|pullover/, 'back'],
    [/tricep|skull|pushdown/, 'triceps'],
    [/bench|chest|fly|push ?up|pec|dip/, 'chest'],
    [/overhead|shoulder|lateral|front raise|face pull|reverse fly|arnold|upright/, 'shoulders'],
    [/curl/, 'biceps'],
    [/extension|kickback/, 'triceps'],
    [/crunch|plank|ab |abs|sit up|leg raise|russian|core/, 'core'],
    [/clean|snatch|swing|thruster|burpee/, 'fullbody'],
  ];
  const muscle = rules.find(([re]) => re.test(n))?.[1] ?? 'other';
  const lowerBody = ['quads', 'hamstrings', 'glutes', 'calves'].includes(muscle) || /deadlift|swing|clean/.test(n);
  return { muscle, equipment, lowerBody, repMin: 8, repMax: 12 };
}
