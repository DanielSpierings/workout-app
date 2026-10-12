import type { Exercise, WorkoutSet } from '../types';
import { DEFAULT_INCREMENT } from '../data/exercises';
import { formatNumber } from '../lib/format';
import { IconMinus, IconPlus } from './Icons';
import { NumInput } from './NumInput';
import { Sheet } from './Sheet';

const RPE_OPTIONS = [6, 7, 7.5, 8, 8.5, 9, 9.5, 10];

/** Grote stappers voor gewicht en herhalingen; wijzigingen worden direct opgeslagen. */
export function SetEditor({ exercise, label, set, previous, onChange, onToggleDone, onClose }: {
  exercise?: Exercise;
  label: string;
  set: WorkoutSet;
  previous?: WorkoutSet;
  onChange: (patch: Partial<WorkoutSet>) => void;
  onToggleDone: () => void;
  onClose: () => void;
}) {
  const step = exercise ? exercise.increment ?? DEFAULT_INCREMENT[exercise.equipment] : 2.5;
  const round = (n: number) => Number(Math.max(0, n).toFixed(2));
  return (
    <Sheet title={`${exercise?.name ?? 'Oefening'} · ${label}`} onClose={onClose}>
      {previous && (
        <p className="small muted" style={{ marginTop: 0 }}>
          Vorige keer: {formatNumber(previous.weight ?? 0, 2)} kg × {previous.reps}{previous.rpe ? ` @ RPE ${String(previous.rpe).replace('.', ',')}` : ''}
        </p>
      )}
      <label className="lbl">Gewicht (kg) · stap {formatNumber(step, 2)}</label>
      <div className="stepper">
        <button aria-label="Minder gewicht" onClick={() => onChange({ weight: round((set.weight ?? 0) - step) })}><IconMinus /></button>
        <NumInput aria-label="Gewicht" value={set.weight} onChange={(v) => onChange({ weight: v })} placeholder="0" />
        <button aria-label="Meer gewicht" onClick={() => onChange({ weight: round((set.weight ?? 0) + step) })}><IconPlus /></button>
      </div>
      <label className="lbl" style={{ marginTop: 16 }}>Herhalingen</label>
      <div className="stepper">
        <button aria-label="Minder herhalingen" onClick={() => onChange({ reps: Math.max(0, (set.reps ?? 0) - 1) })}><IconMinus /></button>
        <NumInput aria-label="Herhalingen" decimal={false} value={set.reps} onChange={(v) => onChange({ reps: v })} placeholder="0" />
        <button aria-label="Meer herhalingen" onClick={() => onChange({ reps: (set.reps ?? 0) + 1 })}><IconPlus /></button>
      </div>
      <label className="lbl" style={{ marginTop: 16 }}>RPE (optioneel)</label>
      <div className="chips wrap">
        <button className={`chip ${set.rpe == null ? 'on' : ''}`} onClick={() => onChange({ rpe: null })}>–</button>
        {RPE_OPTIONS.map((r) => (
          <button key={r} className={`chip ${set.rpe === r ? 'on' : ''}`} onClick={() => onChange({ rpe: r })}>{String(r).replace('.', ',')}</button>
        ))}
      </div>
      <div className="row" style={{ marginTop: 20 }}>
        <button className="btn grow" onClick={onClose}>Klaar</button>
        <button className={`btn grow ${set.done ? '' : 'good'}`} onClick={() => { onToggleDone(); onClose(); }}>
          {set.done ? 'Afvinken ongedaan maken' : 'Set afvinken'}
        </button>
      </div>
    </Sheet>
  );
}
