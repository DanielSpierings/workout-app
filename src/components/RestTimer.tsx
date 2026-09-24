import { useEffect, useRef, useState } from 'react';
import { formatClock } from '../lib/format';

let audioCtx: AudioContext | null = null;

/** iOS staat geluid pas toe na een tik van de gebruiker; roep dit aan vanuit een klik. */
export function unlockAudio(): void {
  try {
    audioCtx ??= new AudioContext();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
  } catch {
    /* geen audio beschikbaar */
  }
}

function beep(): void {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  for (const [i, f] of [880, 880, 1320].entries()) {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t + i * 0.25);
    g.gain.exponentialRampToValueAtTime(0.3, t + i * 0.25 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.25 + 0.2);
    o.connect(g).connect(audioCtx.destination);
    o.start(t + i * 0.25);
    o.stop(t + i * 0.25 + 0.22);
  }
  navigator.vibrate?.([200, 100, 200]);
}

export interface RestState {
  endsAt: number;
  total: number;
}

/** Werkt met een eindtijdstip, zodat de timer klopt als de app even op de achtergrond was. */
export function RestTimer({ rest, onChange, sound }: { rest: RestState; onChange: (r: RestState | null) => void; sound: boolean }) {
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
      if (sound) beep();
      const t = setTimeout(() => onChange(null), 1500);
      return () => clearTimeout(t);
    }
  }, [left, sound, onChange]);

  const adjust = (d: number) => onChange({ endsAt: rest.endsAt + d * 1000, total: Math.max(rest.total + d, 1) });

  return (
    <div className="rest">
      <div className="bar" style={{ width: `${Math.max(0, Math.min(100, (left / rest.total) * 100))}%` }} />
      <div className="row">
        <div className="grow">
          <div className="small muted">Rust</div>
          <div className="clock">{left > 0 ? formatClock(left) : 'Klaar!'}</div>
        </div>
        <button className="btn small" onClick={() => adjust(-15)}>−15</button>
        <button className="btn small" onClick={() => adjust(15)}>+15</button>
        <button className="btn small primary" onClick={() => onChange(null)}>Stop</button>
      </div>
    </div>
  );
}
