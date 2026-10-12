import type { SoundKind } from '../types';

/*
 * Geluid aan het einde van de rust.
 *
 * De geluiden worden hier gesynthetiseerd (som van uitstervende sinustonen) en als
 * WAV via een <audio>-element afgespeeld. Met de Audio Session API (Safari 16.4+)
 * melden we het als kort meldingsgeluid ('transient'), zodat iOS muziek van andere
 * apps tijdelijk zachter zet. Na afloop gaat de sessie terug naar 'auto' en komt de
 * muziek weer op volume.
 */

declare global {
  interface Navigator {
    audioSession?: { type: string };
  }
}

const SAMPLE_RATE = 44_100;

interface Tone {
  freq: number;
  amp: number;
  /** Tijdconstante van het uitsterven in seconden. */
  decay: number;
}

interface Strike {
  at: number;
  partials: Tone[];
  attack: number;
}

const bellPartials = (f: number): Tone[] => [
  { freq: f, amp: 1, decay: 1.2 },
  { freq: f * 2, amp: 0.55, decay: 0.9 },
  { freq: f * 2.76, amp: 0.4, decay: 0.6 },
  { freq: f * 4.07, amp: 0.22, decay: 0.4 },
  { freq: f * 5.4, amp: 0.12, decay: 0.25 },
];

const RECIPES: Record<SoundKind, { duration: number; strikes: Strike[] }> = {
  // Kleine bel, twee keer aangeslagen zodat hij boven muziek uitkomt.
  bell: {
    duration: 2.4,
    strikes: [
      { at: 0, attack: 0.003, partials: bellPartials(830) },
      { at: 0.6, attack: 0.003, partials: bellPartials(830) },
    ],
  },
  // Klankschaal: zachte aanzet, lange galm met een licht zwevende toon.
  bowl: {
    duration: 3.2,
    strikes: [{
      at: 0,
      attack: 0.03,
      partials: [
        { freq: 528, amp: 1, decay: 2.4 },
        { freq: 531.5, amp: 0.7, decay: 2.4 },
        { freq: 528 * 2.71, amp: 0.45, decay: 1.4 },
        { freq: 528 * 4.9, amp: 0.18, decay: 0.8 },
      ],
    }],
  },
  // Ding-dong: twee heldere tonen na elkaar.
  chime: {
    duration: 1.8,
    strikes: [
      { at: 0, attack: 0.004, partials: [{ freq: 1318.5, amp: 1, decay: 0.55 }, { freq: 2637, amp: 0.25, decay: 0.3 }] },
      { at: 0.38, attack: 0.004, partials: [{ freq: 1046.5, amp: 1, decay: 0.7 }, { freq: 2093, amp: 0.25, decay: 0.35 }] },
    ],
  },
};

export const SOUND_LABELS: Record<SoundKind, string> = {
  bell: 'Bel',
  bowl: 'Klankschaal',
  chime: 'Ding-dong',
};

/** Rekent het geluid uit als samples tussen -1 en 1 (piek 0,9). */
export function synthesize(kind: SoundKind): Float32Array {
  const { duration, strikes } = RECIPES[kind];
  const out = new Float32Array(Math.round(duration * SAMPLE_RATE));
  for (const strike of strikes) {
    const start = Math.round(strike.at * SAMPLE_RATE);
    for (let i = start; i < out.length; i++) {
      const t = (i - start) / SAMPLE_RATE;
      const env = Math.min(1, t / strike.attack);
      let v = 0;
      for (const p of strike.partials) v += p.amp * Math.exp(-t / p.decay) * Math.sin(2 * Math.PI * p.freq * t);
      out[i] += env * v;
    }
  }
  // Laatste 50 ms uitfaden tegen klikjes, daarna normaliseren.
  const fade = Math.round(0.05 * SAMPLE_RATE);
  for (let i = 0; i < fade; i++) out[out.length - 1 - i] *= i / fade;
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] = (out[i] / peak) * 0.9;
  return out;
}

/** 16-bit mono PCM WAV. */
export function encodeWav(samples: Float32Array, sampleRate = SAMPLE_RATE): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const text = (offset: number, s: string) => [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((v, i) => view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 0x7fff, true));
  return buffer;
}

const urls = new Map<SoundKind | 'silence', string>();

function urlFor(kind: SoundKind | 'silence'): string {
  let url = urls.get(kind);
  if (!url) {
    const samples = kind === 'silence' ? new Float32Array(SAMPLE_RATE / 10) : synthesize(kind);
    url = URL.createObjectURL(new Blob([encodeWav(samples)], { type: 'audio/wav' }));
    urls.set(kind, url);
  }
  return url;
}

let player: HTMLAudioElement | null = null;
let unlocked = false;

function setSession(type: 'transient' | 'ambient' | 'auto'): void {
  try {
    if (navigator.audioSession) navigator.audioSession.type = type;
  } catch {
    /* niet ondersteund */
  }
}

function getPlayer(): HTMLAudioElement {
  if (!player) {
    player = new Audio();
    player.preload = 'auto';
    player.addEventListener('ended', () => setSession('auto'));
  }
  return player;
}

/**
 * iOS speelt pas geluid af na een tik van de gebruiker. Roep dit aan vanuit een klik
 * (bijvoorbeeld bij het afvinken van een set): het speelt stilte af als 'ambient',
 * zodat je muziek daarbij niet wordt onderbroken.
 */
export function unlockAudio(): void {
  if (unlocked) return;
  try {
    const p = getPlayer();
    setSession('ambient');
    p.src = urlFor('silence');
    p.muted = true;
    void p.play().then(() => {
      p.pause();
      p.muted = false;
      unlocked = true;
      setSession('auto');
    }).catch(() => { p.muted = false; });
  } catch {
    /* geen audio beschikbaar */
  }
}

/** Speelt het geluid af en zet andere audio (muziek) tijdelijk zachter. */
export function playSound(kind: SoundKind): void {
  try {
    const p = getPlayer();
    setSession('transient');
    p.muted = false;
    p.src = urlFor(kind);
    p.currentTime = 0;
    void p.play().catch(() => setSession('auto'));
  } catch {
    setSession('auto');
  }
}
