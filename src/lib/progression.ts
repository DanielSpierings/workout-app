import type { Exercise } from '../types';
import { DEFAULT_INCREMENT } from '../data/exercises';
import { e1rm, type ExerciseSession } from './stats';

/*
 * Progressive overload-engine: dubbele progressie met RIR-autoregulatie.
 *
 * 1. Werk binnen een herhalingsbereik (bv. 8–12). Zolang je de bovengrens niet
 *    haalt, blijft het gewicht gelijk en probeer je per set één herhaling meer.
 *    Progressie in herhalingen levert vergelijkbare spier- en krachtwinst op als
 *    progressie in gewicht (Plotkin et al., 2022).
 * 2. Haal je op alle werksets de bovengrens zonder tot falen te gaan, dan gaat
 *    het gewicht omhoog met ~2,5% (bovenlichaam) of ~5% (onderlichaam), minimaal
 *    één gewichtsstap. Het doelaantal herhalingen op het nieuwe gewicht wordt
 *    geschat met de Epley-relatie (binnen het bereik). Dit volgt het ACSM
 *    position stand (2009): verhoog 2–10% zodra je 1–2 herhalingen boven het doel
 *    haalt.
 * 3. Ging het veel makkelijker dan gepland (2+ herhalingen boven de bovengrens),
 *    dan rekent de engine via de geschatte 1RM (Epley) terug naar een gewicht
 *    dat past bij de ondergrens + beoogde RIR, met een maximum van +10%.
 * 4. Inspanning wordt gemeten met RPE/RIR (Zourdos et al., 2016; Helms et al.,
 *    2016). Werksets rond 1–3 herhalingen in reserve geven een goede
 *    prikkel/vermoeidheid-verhouding; bij RPE ≥ 9,5 blijft de belasting gelijk.
 * 5. Geen vooruitgang in herhalingen over 3 sessies op hetzelfde gewicht, of
 *    twee sessies onder de ondergrens: deload van ~10% en daarna opnieuw opbouwen.
 * 6. Langer dan 4 weken niet gedaan: start op ~90% om weer in te komen.
 */

export type ProgressionAction = 'first' | 'increase' | 'reps' | 'hold' | 'deload' | 'return';

export interface SetTarget {
  weight: number | null;
  reps: number;
}

export interface Suggestion {
  action: ProgressionAction;
  targets: SetTarget[];
  explanation: string;
}

export interface ProgressionOptions {
  targetRir: number;
  /** Gewenst aantal werksets; standaard het aantal van de vorige keer. */
  sets?: number;
  repMin?: number;
  repMax?: number;
  now?: number;
}

const DAY = 86_400_000;
const LONG_BREAK_DAYS = 28;
const STALL_SESSIONS = 3;

export function roundTo(value: number, step: number): number {
  return Number((Math.round(value / step) * step).toFixed(2));
}

function fmt(kg: number): string {
  return `${Number(kg.toFixed(2)).toString().replace('.', ',')} kg`;
}

function same(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.01;
}

function repeat(n: number, t: SetTarget): SetTarget[] {
  return Array.from({ length: n }, () => ({ ...t }));
}

/** Gemiddelde RPE van sets waar RPE is ingevuld, anders null. */
function averageRpe(session: ExerciseSession, weight: number): number | null {
  const rpes = session.sets
    .filter((s) => same(s.weight ?? 0, weight) && s.rpe != null)
    .map((s) => s.rpe as number);
  return rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;
}

function topSets(session: ExerciseSession) {
  return session.sets.filter((s) => same(s.weight ?? 0, session.topWeight));
}

export function suggestProgression(
  exercise: Exercise,
  history: ExerciseSession[],
  opts: ProgressionOptions,
): Suggestion {
  const repMin = opts.repMin ?? exercise.repMin;
  const repMax = Math.max(opts.repMax ?? exercise.repMax, repMin);
  const rir = opts.targetRir;
  const targetRpe = 10 - rir;
  const now = opts.now ?? Date.now();
  const step = exercise.increment ?? DEFAULT_INCREMENT[exercise.equipment];
  const pct = exercise.lowerBody ? 0.05 : 0.025;

  const last = history[history.length - 1];
  if (!last) {
    return {
      action: 'first',
      targets: repeat(opts.sets ?? 3, { weight: null, reps: repMin }),
      explanation:
        `Eerste keer: kies een gewicht waarmee je ${repMin}–${repMax} herhalingen haalt ` +
        `met nog ~${rir} herhalingen in reserve (RPE ${targetRpe}). Begin liever iets te licht.`,
    };
  }

  const W = last.topWeight;
  const top = topSets(last);
  const setCount = opts.sets ?? Math.max(top.length, 1);
  const reps = top.map((s) => s.reps ?? 0);
  const minReps = Math.min(...reps);
  const rpe = averageRpe(last, W);
  const tooHard = rpe != null && rpe >= 9.5;
  const bodyweightOnly = W <= 0;

  // Terugkeer na een lange pauze.
  const daysSince = (now - last.date) / DAY;
  if (daysSince > LONG_BREAK_DAYS) {
    const weight = bodyweightOnly ? 0 : roundTo(W * 0.9, step);
    return {
      action: 'return',
      targets: repeat(setCount, { weight, reps: repMin }),
      explanation:
        `Je hebt deze oefening ${Math.round(daysSince)} dagen niet gedaan. Start op ~90%` +
        (bodyweightOnly ? '' : ` (${fmt(weight)})`) +
        ` en bouw de komende sessies weer op; kracht komt na een pauze snel terug.`,
    };
  }

  // Stagnatie of achteruitgang op hetzelfde gewicht → deload.
  const streak: ExerciseSession[] = [];
  for (let i = history.length - 1; i >= 0 && same(history[i].topWeight, W); i--) streak.unshift(history[i]);
  // Op gelijk gewicht is het gemiddelde aantal herhalingen per werkset de maat voor vooruitgang,
  // zodat ook winst in de latere sets (8,7,7 → 8,8,7) meetelt.
  const meanReps = (s: ExerciseSession) => {
    const r = topSets(s).map((x) => x.reps ?? 0);
    return r.reduce((a, b) => a + b, 0) / r.length;
  };
  const stalled =
    streak.length >= STALL_SESSIONS &&
    meanReps(streak[streak.length - 1]) <= Math.max(...streak.slice(-STALL_SESSIONS, -1).map(meanReps)) + 0.01 &&
    minReps < repMax;
  const failedTwice =
    streak.length >= 2 &&
    streak.slice(-2).every((s) => Math.min(...topSets(s).map((x) => x.reps ?? 0)) < repMin);

  if (!bodyweightOnly && (stalled || failedTwice)) {
    const weight = roundTo(W * 0.9, step);
    return {
      action: 'deload',
      targets: repeat(setCount, { weight, reps: Math.min(repMin + 2, repMax) }),
      explanation:
        (failedTwice
          ? `Twee sessies achter elkaar onder de ${repMin} herhalingen op ${fmt(W)}.`
          : `Geen vooruitgang in herhalingen over ${STALL_SESSIONS} sessies op ${fmt(W)}.`) +
        ` Deload naar ~90% (${fmt(weight)}) om vermoeidheid kwijt te raken, daarna weer opbouwen.`,
    };
  }

  // Bovengrens gehaald op alle werksets → gewicht omhoog.
  if (minReps >= repMax && !tooHard) {
    if (bodyweightOnly) {
      return {
        action: 'increase',
        targets: repeat(setCount, { weight: step, reps: repMin }),
        explanation:
          `Alle sets op ${repMax}+ herhalingen. Voeg gewicht toe (bv. ${fmt(step)} aan een dipriem) ` +
          `of kies een zwaardere variant, en begin weer bij ${repMin} herhalingen.`,
      };
    }
    let weight = roundTo(W + Math.max(step, W * pct), step);
    let why = `Alle werksets op ${repMax}+ herhalingen: +${fmt(weight - W)} (${exercise.lowerBody ? '~5%' : '~2,5%'}, minimaal één stap).`;
    const overshoot = minReps >= repMax + 2 && (rpe == null || rpe <= targetRpe);
    if (overshoot) {
      // Terugrekenen vanuit geschatte 1RM naar ondergrens + RIR, maximaal +10%.
      const est = Math.max(...top.map((s) => e1rm(W, s.reps ?? 0)));
      const fromE1rm = Math.min(est / (1 + (repMin + rir) / 30), W * 1.1);
      const jump = roundTo(fromE1rm, step);
      if (jump > weight) {
        weight = jump;
        why = `Ruim boven het bereik (${minReps}+ herhalingen): via je geschatte 1RM naar ${fmt(weight)} (max. +10%).`;
      }
    }
    // Doelherhalingen op het nieuwe gewicht schatten via Epley, binnen het bereik en met ruimte om te groeien.
    const est = Math.max(...top.map((s) => e1rm(W, s.reps ?? 0)));
    const predicted = Math.floor(30 * (est / weight - 1) + 1e-9);
    const targetReps = Math.max(repMin, Math.min(predicted, repMax - 1));
    return {
      action: 'increase',
      targets: repeat(setCount, { weight, reps: targetReps }),
      explanation: `${why} Doel: ${targetReps} herhalingen per set (geschat via je 1RM), daarna weer opbouwen richting ${repMax}.`,
    };
  }

  // Zwaar en onder de ondergrens → vasthouden.
  if (minReps < repMin) {
    return {
      action: 'hold',
      targets: repeat(setCount, { weight: W, reps: repMin }),
      explanation:
        `Vorige keer zakte je onder de ${repMin} herhalingen op ${fmt(W)}. Zelfde gewicht; ` +
        `probeer alle sets op minimaal ${repMin} te krijgen.`,
    };
  }

  // Binnen het bereik → herhalingen erbij.
  const targets: SetTarget[] = Array.from({ length: setCount }, (_, i) => {
    const prev = reps[Math.min(i, reps.length - 1)];
    return { weight: W, reps: tooHard ? prev : Math.min(prev + 1, repMax) };
  });
  return {
    action: tooHard ? 'hold' : 'reps',
    targets,
    explanation: tooHard
      ? `Vorige keer was zwaar (RPE ${rpe!.toFixed(1).replace('.', ',')}). Zelfde gewicht en herhalingen; ` +
        `mik op RPE ${targetRpe}.`
      : `Zelfde gewicht (${bodyweightOnly ? 'lichaamsgewicht' : fmt(W)}), één herhaling meer per set ` +
        `richting ${repMax}. Stop met ~${rir} herhalingen in reserve.`,
  };
}

export const REFERENCES = [
  {
    short: 'ACSM, 2009',
    title: 'Progression models in resistance training for healthy adults',
    source: 'Medicine & Science in Sports & Exercise, 41(3), 687–708',
    url: 'https://doi.org/10.1249/MSS.0b013e3181915670',
  },
  {
    short: 'Plotkin et al., 2022',
    title: 'Progressive overload without progressing load? The effects of load or repetition progression on muscular adaptations',
    source: 'PeerJ, 10, e14142',
    url: 'https://doi.org/10.7717/peerj.14142',
  },
  {
    short: 'Zourdos et al., 2016',
    title: 'Novel resistance training–specific rating of perceived exertion scale measuring repetitions in reserve',
    source: 'Journal of Strength and Conditioning Research, 30(1), 267–275',
    url: 'https://doi.org/10.1519/JSC.0000000000001049',
  },
  {
    short: 'Helms et al., 2016',
    title: 'Application of the repetitions in reserve-based rating of perceived exertion scale for resistance training',
    source: 'Strength and Conditioning Journal, 38(4), 42–49',
    url: 'https://doi.org/10.1519/SSC.0000000000000218',
  },
  {
    short: 'Schoenfeld et al., 2017',
    title: 'Dose-response relationship between weekly resistance training volume and increases in muscle mass',
    source: 'Journal of Sports Sciences, 35(11), 1073–1082',
    url: 'https://doi.org/10.1080/02640414.2016.1210197',
  },
];
