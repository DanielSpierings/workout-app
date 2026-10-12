import { useState } from 'react';
import { formatClock } from '../lib/format';
import { Sheet } from './Sheet';

const OPTIONS = [30, 45, 60, 90, 120, 150, 180, 240];

/** Rusttijd voor één oefening kiezen, optioneel ook voor de template. */
export function RestSheet({ title, kind, seconds, canSaveToTemplate, onSave, onClose }: {
  title: string;
  kind: 'normal' | 'between' | 'round';
  seconds: number;
  canSaveToTemplate: boolean;
  onSave: (seconds: number, saveToTemplate: boolean) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(seconds);
  const [toTemplate, setToTemplate] = useState(false);
  const label = kind === 'between' ? 'Rust tussen de oefeningen van de superset'
    : kind === 'round' ? 'Rust na de laatste oefening van de superset-ronde'
    : 'Rust na elke werkset';
  return (
    <Sheet title={title} onClose={onClose}>
      <p className="small muted" style={{ marginTop: 0 }}>{label}</p>
      <div className="chips wrap">
        {OPTIONS.map((s) => (
          <button key={s} className={`chip ${value === s ? 'on' : ''}`} onClick={() => setValue(s)}>{formatClock(s)}</button>
        ))}
      </div>
      {canSaveToTemplate && (
        <label className="row small" style={{ marginTop: 16 }}>
          <input type="checkbox" checked={toTemplate} onChange={(e) => setToTemplate(e.target.checked)} />
          Ook opslaan in de template
        </label>
      )}
      <button className="btn primary block" style={{ marginTop: 20 }} onClick={() => { onSave(value, toTemplate); onClose(); }}>
        Rust instellen op {formatClock(value)}
      </button>
    </Sheet>
  );
}
