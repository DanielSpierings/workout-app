import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { SoundKind } from '../types';
import { formatClock } from '../lib/format';
import { playSound } from '../lib/sound';
import { IconSkip } from './Icons';

export interface RestState {
  endsAt: number;
  total: number;
}

const R = 38;
const CIRC = 2 * Math.PI * R;

/** Werkt met een eindtijdstip, zodat de timer klopt als de app even op de achtergrond was. */
export function RestTimer({ rest, onChange, sound, soundKind, next }: {
  rest: RestState;
  onChange: (r: RestState | null) => void;
  sound: boolean;
  soundKind: SoundKind;
  next?: ReactNode;
}) {
  const [now, setNow] = useState(Date.now());
  const fired = useRef(false);
  useEffect(() => {
    fired.current = false;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [rest.endsAt]);

  const left = (rest.endsAt - now) / 1000;
  useEffect(() => {
    if (left <= 0 && !fired.current) {
      fired.current = true;
      if (sound) playSound(soundKind);
      const t = setTimeout(() => onChange(null), 2500);
      return () => clearTimeout(t);
    }
  }, [left, sound, soundKind, onChange]);

  const adjust = (d: number) => onChange({ endsAt: rest.endsAt + d * 1000, total: Math.max(rest.total + d, 1) });
  const fraction = Math.max(0, Math.min(1, left / rest.total));

  return (
    <div className={`rest ${left <= 0 ? 'over' : ''}`} role="timer" aria-live="off">
      <div className="ring">
        <svg width="84" height="84" viewBox="0 0 84 84">
          <circle className="track" cx="42" cy="42" r={R} fill="none" strokeWidth="6" />
          <circle className="arc" cx="42" cy="42" r={R} fill="none" strokeWidth="6" strokeLinecap="round"
            strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - fraction)} />
        </svg>
        <div className="clock">{left > 0 ? formatClock(left) : '0:00'}</div>
      </div>
      <div className="grow">
        <div className="next truncate">{left > 0 ? next ?? 'Rust' : 'Rust voorbij'}</div>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn small" onClick={() => adjust(-15)}>−15 s</button>
          <button className="btn small" onClick={() => adjust(15)}>+15 s</button>
          <button className="btn small primary grow" onClick={() => onChange(null)} aria-label="Rust overslaan"><IconSkip size={18} /> Verder</button>
        </div>
      </div>
    </div>
  );
}
