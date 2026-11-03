/**
 * Tuner presets. Lessons, scores and assessment use standard tuning; these
 * presets only change what the tuner aims for. Index 0 = string 1 (thinnest).
 */
import type { TuningChoice } from '../storage/types';
import type { StringNumber } from './score';

export interface TuningPreset {
  id: TuningChoice;
  name: string;
  /** Sounding open-string MIDI pitches, index 0 = string 1 … 5 = string 6. */
  openMidi: [number, number, number, number, number, number];
  blurb: string;
}

export const TUNINGS: readonly TuningPreset[] = [
  { id: 'standard', name: 'Standard (E A D G B E)', openMidi: [64, 59, 55, 50, 45, 40], blurb: 'What every lesson in this app uses.' },
  { id: 'drop_d', name: 'Drop D (D A D G B E)', openMidi: [64, 59, 55, 50, 45, 38], blurb: 'Only string 6 goes down a whole step. One-finger power chords, instant heaviness.' },
  { id: 'half_step_down', name: 'Half-step down (E♭ A♭ D♭ G♭ B♭ E♭)', openMidi: [63, 58, 54, 49, 44, 39], blurb: 'Every string a semitone lower: slinkier bends, the classic blues-rock trick.' },
  { id: 'd_standard', name: 'D standard (D G C F A D)', openMidi: [62, 57, 53, 48, 43, 38], blurb: 'Every string a whole step lower. Dark and heavy.' },
  { id: 'open_g', name: 'Open G (D G D G B D)', openMidi: [62, 59, 55, 50, 43, 38], blurb: 'Strum the open strings and you get a G chord. Slide-guitar heaven.' },
  { id: 'open_d', name: 'Open D (D A D F♯ A D)', openMidi: [62, 57, 54, 50, 45, 38], blurb: 'Open strings ring a D chord. Big and droney.' },
  { id: 'dadgad', name: 'DADGAD', openMidi: [62, 57, 55, 50, 45, 38], blurb: 'Neither major nor minor: folky, Celtic, mysterious.' },
];

export function tuningPreset(id: TuningChoice): TuningPreset {
  return TUNINGS.find((t) => t.id === id) ?? TUNINGS[0]!;
}

export function presetOpenMidi(id: TuningChoice, s: StringNumber): number {
  return tuningPreset(id).openMidi[s - 1]!;
}
