/**
 * Imported notation (tab, chord sheet, MIDI, MusicXML, Guitar Pro) → SongSource.
 * Notes struck together on two or more strings become chord shapes (shown and
 * strummed by the app, never assessed); single notes form the melody/riff line.
 */
import type { ImportedSong } from './importers/types';
import { PPQ, type Rights } from './score';
import type { SongSource, SourceChord, SourceNote } from './songArrange';

export function importedToSource(song: ImportedSong, base: { arrangementId: string; title: string; rights: Rights; createdBy: string }): { source: SongSource; warnings: string[] } {
  const warnings = [...song.warnings];
  if (!song.tuning.standard) warnings.push(`This was written for ${song.tuning.name} tuning. The app shows it in standard tuning, so some notes may sit on different strings.`);
  const byTick = new Map<number, ImportedSong['notes']>();
  for (const n of song.notes) {
    const g = byTick.get(n.startTick);
    if (g) g.push(n);
    else byTick.set(n.startTick, [n]);
  }
  const ticks = [...byTick.keys()].sort((a, b) => a - b);
  const notes: SourceNote[] = [];
  const shapes: SourceChord[] = [];
  ticks.forEach((t, i) => {
    const g = byTick.get(t)!;
    const nextT = ticks[i + 1] ?? song.durationTicks;
    const fretted = g.filter((n) => n.string && n.fret !== undefined);
    if (g.length >= 2 && fretted.length === g.length && song.capo === 0) {
      const frets: (number | null)[] = [null, null, null, null, null, null];
      for (const n of fretted) frets[n.string! - 1] = n.fret!;
      shapes.push({ startTick: t, durationTicks: Math.max(PPQ / 4, Math.min(Math.max(...g.map((n) => n.durationTicks)), nextT - t)), name: null, fretsByString: frets });
      return;
    }
    for (const n of g) {
      const sn: SourceNote = { startTick: n.startTick, durationTicks: n.durationTicks, midi: n.midi };
      if (n.string && n.fret !== undefined && song.capo === 0 && song.tuning.standard) {
        sn.string = n.string;
        sn.fret = n.fret;
      }
      if (n.techniques?.length) sn.techniques = n.techniques.map((x) => ({ kind: x.kind, ...(x.semitones ? { semitones: Math.min(3, Math.max(0.25, x.semitones)) } : {}) }));
      notes.push(sn);
    }
  });
  const named: SourceChord[] = song.chords.map((c) => ({ startTick: c.startTick, durationTicks: c.durationTicks, name: c.name, ...(c.fretsByString ? { fretsByString: c.fretsByString } : {}) }));
  // Named chords (chord sheets, MusicXML harmony) win; tab shapes fill the gaps.
  const chords = named.length ? named : shapes;
  if (named.length && shapes.length) warnings.push('Both chord names and chord shapes were found; the chord names are used.');
  return {
    source: {
      arrangementId: base.arrangementId,
      title: base.title,
      bpm: Math.round(Math.min(300, Math.max(20, song.bpm)) * 100) / 100,
      durationTicks: Math.max(song.durationTicks, 4 * PPQ),
      notes,
      chords,
      sections: song.sections.map((s) => ({ startTick: s.startTick, name: s.name })),
      rights: base.rights,
      method: 'imported',
      createdBy: base.createdBy,
    },
    warnings,
  };
}
