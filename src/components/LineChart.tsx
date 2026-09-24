import { formatNumber } from '../lib/format';

export interface Point { x: number; y: number }

/** Eenvoudige SVG-lijngrafiek met min/max-labels; geen externe bibliotheek nodig. */
export function LineChart({ points, unit = 'kg' }: { points: Point[]; unit?: string }) {
  if (points.length < 2) return <div className="empty small">Nog te weinig data voor een grafiek.</div>;
  const W = 340, H = 160, px = 8, py = 18;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const pad = (Math.max(...ys) - Math.min(...ys)) * 0.1 || 1;
  const y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad;
  const sx = (x: number) => px + ((x - x0) / (x1 - x0 || 1)) * (W - 2 * px);
  const sy = (y: number) => H - py - ((y - y0) / (y1 - y0)) * (H - 2 * py);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  const best = points.reduce((a, b) => (b.y > a.y ? b : a));
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Voortgangsgrafiek">
        <path d={`${d} L${sx(last.x)},${H - py} L${sx(points[0].x)},${H - py} Z`} fill="var(--accent-soft)" />
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
        {points.length <= 40 && points.map((p, i) => <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="2.5" fill="var(--accent)" />)}
        <circle cx={sx(best.x)} cy={sy(best.y)} r="4.5" fill="var(--good)" />
        <text x={W - px} y={12} textAnchor="end" fontSize="11" fill="var(--muted)">max {formatNumber(best.y)} {unit}</text>
        <text x={px} y={H - 3} fontSize="11" fill="var(--muted)">{new Date(x0).toLocaleDateString('nl-NL', { month: 'short', year: '2-digit' })}</text>
        <text x={W - px} y={H - 3} textAnchor="end" fontSize="11" fill="var(--muted)">{new Date(x1).toLocaleDateString('nl-NL', { month: 'short', year: '2-digit' })}</text>
      </svg>
    </div>
  );
}
