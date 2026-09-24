const dateFmt = new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit' });
const monthFmt = new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric' });

export const formatDate = (ms: number) => dateFmt.format(ms);
export const formatTime = (ms: number) => timeFmt.format(ms);
export const formatMonth = (ms: number) => monthFmt.format(ms);

export function formatNumber(n: number, digits = 1): string {
  return n.toLocaleString('nl-NL', { maximumFractionDigits: digits });
}

export function formatKg(n: number | null | undefined): string {
  return n == null ? '–' : `${formatNumber(n, 2)} kg`;
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return h ? `${h}u ${m}m` : `${m}m`;
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  return `${h ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}
