/**
 * Synthetic band-like songs for the full-song analysis tests (original,
 * generated at test time; they cannot certify real recordings). Pitched parts
 * are wavetable additive tones with envelopes: chord "keys" (decaying), a
 * plucked bass, a vibrato lead "voice"; drums are noise bursts plus a pitched
 * kick sweep. Ground truth (beats, chords per beat, notes) is returned with
 * the audio.
 */
import { mulberry32, reverb } from './signals';

export type Quality = 'maj' | 'min' | '7' | 'min7' | 'maj7' | '5';
const IV: Record<Quality, number[]> = { maj: [0, 4, 7], min: [0, 3, 7], '7': [0, 4, 7, 10], min7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], '5': [0, 7] };
const PC: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };

export interface ChordSpec {
  root: number;
  quality: Quality;
}

/** 'Am' → {root 9, min}; 'E7' → {root 4, '7'}; 'C' → {root 0, maj}. */
export function chord(name: string): ChordSpec {
  const m = /^([A-G][#b]?)(m7|maj7|m|7|5)?$/.exec(name);
  if (!m) throw new Error(`bad chord ${name}`);
  const q: Quality = m[2] === 'm' ? 'min' : m[2] === 'm7' ? 'min7' : m[2] === '7' ? '7' : m[2] === 'maj7' ? 'maj7' : m[2] === '5' ? '5' : 'maj';
  return { root: PC[m[1]!]!, quality: q };
}

export interface RefNote {
  startSec: number;
  endSec: number;
  midi: number;
}

export interface SynthSong {
  sr: number;
  pcm: Float32Array;
  beats: number[];
  /** Chord sounding during beat i (null = none). */
  beatChords: (ChordSpec | null)[];
  melody: RefNote[];
  bass: RefNote[];
  /** Index of the first bar's beat 1 in `beats`. */
  downbeatIndex: number;
}

type Timbre = 'keys' | 'keys2' | 'bass' | 'voice';
const HARM: Record<Timbre, number[]> = {
  keys: [1, 0.5, 0.33, 0.25, 0.2, 0.12, 0.08, 0.05],
  keys2: [1, 0.15, 0.4, 0.05, 0.2, 0.03, 0.1],
  bass: [1, 0.7, 0.4, 0.25, 0.15, 0.1, 0.05],
  voice: [1, 0.8, 0.6, 0.45, 0.3, 0.22, 0.15, 0.1, 0.07, 0.05],
};

const TABLE = 2048;
const tableCache = new Map<string, Float32Array>();
function wavetable(t: Timbre, hz: number, sr: number): Float32Array {
  const maxH = Math.max(1, Math.floor(sr / 2.2 / hz));
  const key = `${t}:${Math.min(maxH, HARM[t].length)}`;
  let w = tableCache.get(key);
  if (w) return w;
  w = new Float32Array(TABLE + 1);
  HARM[t].forEach((a, i) => {
    if (i + 1 > maxH) return;
    for (let n = 0; n <= TABLE; n++) w![n]! += a * Math.sin((2 * Math.PI * (i + 1) * n) / TABLE + i * 0.9);
  });
  tableCache.set(key, w);
  return w;
}

export class Mixer {
  readonly sr: number;
  readonly out: Float32Array;
  private readonly rnd: () => number;
  constructor(sr: number, seconds: number, seed = 11) {
    this.sr = sr;
    this.out = new Float32Array(Math.round(sr * seconds));
    this.rnd = mulberry32(seed);
  }

  tone(t: Timbre, midi: number, at: number, dur: number, amp: number, o: { detuneCents?: number; vibratoCents?: number; decaySec?: number } = {}) {
    const sr = this.sr;
    const hz = 440 * 2 ** ((midi - 69 + (o.detuneCents ?? 0) / 100) / 12);
    const w = wavetable(t, hz, sr);
    const start = Math.round(at * sr);
    const len = Math.round(dur * sr);
    const rel = Math.round(0.03 * sr);
    const att = Math.round((t === 'voice' ? 0.02 : 0.004) * sr);
    const decay = o.decaySec ?? (t === 'voice' ? 4 : t === 'bass' ? 1.2 : 1.8);
    const vib = o.vibratoCents ?? 0;
    let phase = this.rnd();
    for (let i = 0; i < len + rel && start + i < this.out.length; i++) {
      const tt = i / sr;
      let env = Math.exp(-tt / decay) * Math.min(1, i / att);
      if (i >= len) env *= 1 - (i - len) / rel;
      const v = vib && tt > 0.12 ? 2 ** ((vib * Math.sin(2 * Math.PI * 5.5 * tt)) / 1200) : 1;
      phase += (hz * v) / sr;
      phase -= Math.floor(phase);
      const x = phase * TABLE;
      const k = Math.floor(x);
      const s = w[k]! + (w[k + 1]! - w[k]!) * (x - k);
      if (start + i >= 0) this.out[start + i]! += amp * env * s;
    }
  }

  drum(kind: 'kick' | 'snare' | 'hat' | 'click', at: number, amp = 1) {
    const sr = this.sr;
    const start = Math.round(at * sr);
    const len = Math.round((kind === 'hat' || kind === 'click' ? 0.06 : 0.25) * sr);
    let ph = 0;
    let prev = 0;
    for (let i = 0; i < len && start + i < this.out.length; i++) {
      const t = i / sr;
      let x = 0;
      if (kind === 'kick') {
        const f = 50 + 100 * Math.exp(-t / 0.03);
        ph += (2 * Math.PI * f) / sr;
        x = 0.9 * Math.sin(ph) * Math.exp(-t / 0.12) + 0.2 * (this.rnd() * 2 - 1) * Math.exp(-t / 0.005);
      } else if (kind === 'snare') {
        ph += (2 * Math.PI * 190) / sr;
        x = 0.5 * (this.rnd() * 2 - 1) * Math.exp(-t / 0.1) + 0.3 * Math.sin(ph) * Math.exp(-t / 0.06);
      } else if (kind === 'hat') {
        const n = this.rnd() * 2 - 1;
        x = 0.5 * (n - prev) * Math.exp(-t / 0.025);
        prev = n;
      } else {
        ph += (2 * Math.PI * 1500) / sr;
        x = Math.sin(ph) * Math.exp(-t / 0.01);
      }
      if (start + i >= 0) this.out[start + i]! += amp * x;
    }
  }

  noise(amp: number) {
    for (let i = 0; i < this.out.length; i++) this.out[i]! += amp * (this.rnd() * 2 - 1);
  }

  normalize(peak = 0.9): Float32Array {
    let m = 0;
    for (const x of this.out) m = Math.max(m, Math.abs(x));
    if (m > 0) for (let i = 0; i < this.out.length; i++) this.out[i]! *= peak / m;
    return this.out;
  }
}

/** Beat times for a tempo curve bpm(t), starting at `lead` seconds. */
export function beatTimes(bpmAt: (t: number) => number, count: number, lead: number): number[] {
  const out: number[] = [];
  let t = lead;
  for (let i = 0; i < count; i++) {
    out.push(t);
    // Integrate one beat with small steps.
    let phase = 0;
    while (phase < 1) {
      const dt = 0.001;
      phase += (bpmAt(t) / 60) * dt;
      t += dt;
    }
  }
  return out;
}

export interface SongOptions {
  sr?: number;
  bpm?: number | ((t: number) => number);
  /** One entry per bar (4 beats), repeated `repeats` times. */
  progression: string[];
  repeats?: number;
  lead?: number;
  drums?: boolean;
  clicksOnly?: boolean;
  chordsOn?: boolean;
  bassOn?: boolean;
  /** Melody pattern per bar: [beatOffset, beats, semitone offset from chord root + 12] or null rests. */
  melody?: boolean;
  detuneCents?: number;
  noise?: number;
  seed?: number;
  keysTimbre?: 'keys' | 'keys2';
  /** Register shift for chords (semitones). */
  chordOctave?: number;
  hatsOn?: boolean;
  /** Drum-only beats before the first bar (so the first downbeat is not beat 0). */
  pickupBeats?: number;
  /** Close-voiced chords (inversions) instead of root position. */
  inversions?: boolean;
  /** Room reverb mix (0 = dry). */
  reverb?: number;
  /** Drum level multiplier. */
  drumGain?: number;
}

/** Scale-degree melody figures (offsets in semitones from the chord root, one bar each). */
const FIGURES: [number, number, number][][] = [
  // [startBeat, lengthBeats, interval above root in the chord's key context]
  [[0, 1, 7], [1, 0.5, 4], [1.5, 0.5, 4], [2, 1.5, 0], [3.5, 0.5, 2]],
  [[0, 1.5, 4], [1.5, 0.5, 7], [2, 1, 12], [3, 1, 7]],
  [[0, 0.5, 0], [0.5, 0.5, 2], [1, 1, 4], [2.5, 1.5, 7]],
  [[0, 2, 12], [2, 1, 11], [3, 1, 7]],
];

/** Render a progression song with ground truth. Chords change every bar on beat 1. */
export function renderSong(o: SongOptions): SynthSong {
  const sr = o.sr ?? 22050;
  const bpmAt = typeof o.bpm === 'function' ? o.bpm : () => (o.bpm as number | undefined) ?? 100;
  const repeats = o.repeats ?? 2;
  const lead = o.lead ?? 0.5;
  const bars = o.progression.length * repeats;
  const pickup = o.pickupBeats ?? 0;
  const beats = beatTimes(bpmAt, pickup + bars * 4 + 1, lead);
  const endSec = beats[beats.length - 1]! + 1.5;
  const mx = new Mixer(sr, endSec, o.seed ?? 11);
  const det = o.detuneCents ?? 0;
  const beatChords: (ChordSpec | null)[] = [];
  const melody: RefNote[] = [];
  const bass: RefNote[] = [];
  const chordsOn = o.chordsOn ?? true;
  const bassOn = o.bassOn ?? true;
  const drums = o.drums ?? true;
  const rnd = mulberry32((o.seed ?? 11) + 99);
  const g = o.drumGain ?? 1;
  const drumBeat = (i: number, pos: number, next: number) => {
    const t = beats[i]!;
    if (o.clicksOnly) mx.drum('click', t, pos === 0 ? 0.8 : 0.5);
    else {
      mx.drum(pos % 2 === 0 ? 'kick' : 'snare', t, g * (pos % 2 === 0 ? 0.7 : 0.45));
      if (o.hatsOn ?? true) {
        mx.drum('hat', t, g * 0.15);
        mx.drum('hat', (t + next) / 2, g * 0.1);
      }
    }
  };
  // Pickup: drums only, continuing the bar pattern into the first bar.
  for (let i = 0; i < pickup; i++) {
    beatChords.push(null);
    if (drums) drumBeat(i, (((i - pickup) % 4) + 4) % 4, beats[i + 1]!);
  }
  for (let bar = 0; bar < bars; bar++) {
    const c = chord(o.progression[bar % o.progression.length]!);
    const first = pickup + bar * 4;
    const at = (beat: number) => {
      const i = Math.floor(beat);
      const f = beat - i;
      const t0 = beats[first + i]!;
      const t1 = beats[first + i + 1] ?? t0 + 0.6;
      return t0 + f * (t1 - t0);
    };
    for (let k = 0; k < 4; k++) beatChords.push(chordsOn ? c : null);
    if (chordsOn) {
      const base = 48 + (o.chordOctave ?? 0) + c.root;
      const root = base > 59 + (o.chordOctave ?? 0) ? base - 12 : base;
      // Close voicing (inversions): every chord tone folded into one octave window, like a keyboard player.
      const lo = 52 + (o.chordOctave ?? 0);
      const pitches = IV[c.quality].map((iv) => (o.inversions ? lo + ((((root + iv - lo) % 12) + 12) % 12) : root + iv));
      // Two strums per bar (beats 1 and 3) of the full chord.
      for (const sb of [0, 2]) {
        pitches.forEach((m, k) => mx.tone(o.keysTimbre ?? 'keys', m, at(sb) + 0.004 * k, at(sb + 2) - at(sb), 0.11, { detuneCents: det }));
      }
    }
    if (bassOn && chordsOn) {
      const r = 36 + c.root;
      const bm = r > 45 ? r - 12 : r;
      for (const sb of [0, 2]) {
        const s = at(sb);
        const e = at(sb + 2) - 0.05;
        mx.tone('bass', bm, s, e - s, 0.3, { detuneCents: det });
        bass.push({ startSec: s, endSec: e, midi: bm });
      }
    }
    if (o.melody && chordsOn) {
      const fig = FIGURES[bar % FIGURES.length]!;
      for (const [sb, len, iv] of fig) {
        let m = 60 + c.root + iv;
        while (m > 79) m -= 12;
        while (m < 62) m += 12;
        // Keep minor chords' thirds minor.
        if (c.quality === 'min' || c.quality === 'min7') {
          if ((m - c.root) % 12 === 4) m -= 1;
          if ((m - c.root) % 12 === 11) m -= 1;
        }
        if (rnd() < 0.08) continue; // occasional rest
        const s = at(sb);
        const e = at(sb + len) - 0.04;
        mx.tone('voice', m, s, e - s, 0.32, { detuneCents: det, vibratoCents: 20 });
        melody.push({ startSec: s, endSec: e, midi: m });
      }
    }
    if (drums) for (let k = 0; k < 4; k++) drumBeat(first + k, k, at(k + 1));
  }
  mx.noise(o.noise ?? 0.002);
  let pcm = mx.normalize();
  if (o.reverb) {
    pcm = reverb(pcm, sr, o.reverb);
    let m = 0;
    for (const x of pcm) m = Math.max(m, Math.abs(x));
    for (let i = 0; i < pcm.length; i++) pcm[i]! *= 0.9 / m;
  }
  return { sr, pcm, beats: beats.slice(0, pickup + bars * 4), beatChords, melody, bass, downbeatIndex: pickup };
}
