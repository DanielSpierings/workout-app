import type { ExercisePlan } from '../types';
import { formatClock } from './format';

const rpe = (n: number) => String(n).replace('.', ',');

/** Korte samenvatting van een planning, bv. "3 × 6–8 · RPE 7 → 8 · rust 2:00". */
export function describePlan(
  plan: ExercisePlan,
  fallback?: { repMin: number; repMax: number },
  show: { rest?: boolean; warmup?: boolean } = {},
): string {
  const parts: string[] = [];
  const min = plan.repMin ?? fallback?.repMin;
  const max = plan.repMax ?? fallback?.repMax;
  parts.push(min != null ? `${plan.sets} × ${min}${max != null && max !== min ? `–${max}` : ''}` : `${plan.sets} sets`);
  if (plan.rpe != null) {
    parts.push(plan.lastSetRpe != null && plan.lastSetRpe !== plan.rpe ? `RPE ${rpe(plan.rpe)} → ${rpe(plan.lastSetRpe)}` : `RPE ${rpe(plan.rpe)}`);
  }
  if (show.rest !== false && plan.restSeconds) {
    parts.push(`rust ${formatClock(plan.restSeconds)}${plan.roundRestSeconds ? `, na ronde ${formatClock(plan.roundRestSeconds)}` : ''}`);
  }
  if (show.warmup !== false && plan.warmupSets) parts.push('opwarmset');
  return parts.join(' · ');
}

/** Letter voor een supersetgroep: 1 → A, 2 → B. */
export function supersetLabel(group: number): string {
  return String.fromCharCode(64 + Math.max(1, Math.min(group, 26)));
}
