import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { db } from '../db';
import { MUSCLE_LABELS } from '../data/exercises';
import type { Muscle, Workout } from '../types';
import { formatDate, formatDuration, formatMonth, formatNumber, formatTime } from '../lib/format';
import { isWorkingSet, setsPerMuscle, workoutVolume } from '../lib/stats';
import { go } from '../router';

// Schoenfeld et al. (2017): ~10+ werksets per spiergroep per week geeft meer spiergroei dan minder.
const WEEKLY_TARGET = 10;

export function HistoryPage() {
  const workouts = useLiveQuery(() => db.workouts.orderBy('startedAt').reverse().filter((w) => !!w.endedAt).toArray(), []);
  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  const byId = useMemo(() => new Map((exercises ?? []).map((e) => [e.id, e])), [exercises]);
  const [limit, setLimit] = useState(30);

  const weekly = useMemo(
    () => setsPerMuscle(workouts ?? [], (id) => byId.get(id)?.muscle),
    [workouts, byId],
  );

  if (!workouts) return null;

  const groups: { month: string; items: Workout[] }[] = [];
  for (const w of workouts.slice(0, limit)) {
    const month = formatMonth(w.startedAt);
    if (groups[groups.length - 1]?.month !== month) groups.push({ month, items: [] });
    groups[groups.length - 1].items.push(w);
  }
  const weeklyEntries = Object.entries(weekly).filter(([m]) => m !== 'other').sort((a, b) => b[1] - a[1]);

  return (
    <>
      <header className="page"><h1>Geschiedenis</h1></header>
      {weeklyEntries.length > 0 && (
        <div className="card">
          <div className="spread"><h3>Sets per spiergroep (7 dagen)</h3><span className="small muted">doel ≥ {WEEKLY_TARGET}</span></div>
          <div className="volume-bars" style={{ marginTop: 8 }}>
            {weeklyEntries.map(([m, n]) => (
              <div key={m} className="vb">
                <span className="truncate">{MUSCLE_LABELS[m as Muscle] ?? m}</span>
                <div className="track"><div className={`fill ${n >= WEEKLY_TARGET ? 'ok' : ''}`} style={{ width: `${Math.min(100, (n / (WEEKLY_TARGET * 2)) * 100)}%` }} /></div>
                <span className="small" style={{ textAlign: 'right' }}>{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {!workouts.length && <div className="empty">Nog geen workouts. Start er een, of importeer je Strong-geschiedenis via Instellingen.</div>}
      {groups.map((g) => (
        <section key={g.month}>
          <h2 style={{ textTransform: 'capitalize' }}>{g.month} <span className="muted small">({g.items.length})</span></h2>
          <div className="stack">
            {g.items.map((w) => (
              <div key={w.id} className="card clickable" onClick={() => go(`history/${w.id}`)}>
                <div className="spread">
                  <h3 className="truncate">{w.name}</h3>
                  <span className="small muted">{formatDate(w.startedAt)}</span>
                </div>
                <div className="small muted" style={{ margin: '2px 0 8px' }}>
                  {formatTime(w.startedAt)} · {formatDuration(w.endedAt! - w.startedAt)} · {formatNumber(workoutVolume(w), 0)} kg
                </div>
                {w.exercises.slice(0, 6).map((e, i) => (
                  <div key={i} className="small truncate">
                    {e.sets.filter(isWorkingSet).length} × {byId.get(e.exerciseId)?.name ?? e.exerciseId}
                  </div>
                ))}
                {w.exercises.length > 6 && <div className="small muted">+{w.exercises.length - 6} meer</div>}
              </div>
            ))}
          </div>
        </section>
      ))}
      {workouts.length > limit && (
        <button className="btn block" style={{ marginTop: 16 }} onClick={() => setLimit((l) => l + 50)}>Meer laden ({workouts.length - limit})</button>
      )}
    </>
  );
}
