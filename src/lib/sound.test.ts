import { describe, expect, it } from 'vitest';
import { encodeWav, synthesize } from './sound';

describe('geluid', () => {
  it.each(['bell', 'bowl', 'chime'] as const)('%s is genormaliseerd en loopt stil uit', (kind) => {
    const s = synthesize(kind);
    expect(s.length).toBeGreaterThan(44_100);
    const peak = s.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    expect(peak).toBeCloseTo(0.9, 2);
    expect(Math.abs(s[s.length - 1])).toBeLessThan(0.001);
  });

  it('schrijft een geldige WAV-kop', () => {
    const buf = encodeWav(new Float32Array([0, 0.5, -0.5]));
    const v = new DataView(buf);
    const str = (o: number) => String.fromCharCode(...new Uint8Array(buf, o, 4));
    expect(str(0)).toBe('RIFF');
    expect(str(8)).toBe('WAVE');
    expect(v.getUint32(24, true)).toBe(44_100);
    expect(v.getUint32(40, true)).toBe(6);
    expect(v.getInt16(46, true)).toBe(Math.trunc(0.5 * 0x7fff));
  });
});
