/**
 * Guitar Pro importer (GP3, GP4, GP5, GPX/GP6, GP7+) built on alphaTab's file readers
 * (@coderline/alphatab, MPL-2.0). alphaTab is loaded lazily with a dynamic import() the
 * first time a Guitar Pro file is opened, so it never weighs down the app's start-up; it
 * makes no network requests and nothing here renders or plays audio.
 *
 * Converted: tracks (choose by index), beats/notes with string and fret (alphaTab counts
 * strings from the lowest; converted to 1 = high E), tied notes (merged), hammer-ons /
 * pull-offs, slides, bends and releases, vibrato, palm mutes, let ring, dead notes,
 * harmonics, taps, ghost notes (softer), dynamics → velocity, tuning and capo, tempo
 * (first used; changes warned), time signature, sections/markers, chord diagrams
 * (→ fretsByString) and repeats with alternate endings (expanded). Lyrics are never read.
 */
import type { model } from '@coderline/alphatab';
import {
  barLabel, describeTuning, expandRepeats, failure, finalizeSong, ImportAbort, abortToFailure, listText, maxPolyphony, rangeWarnings,
  toBytes,
} from './common';
import type { ImportedChord, ImportedNote, ImportFailure, ImportOutcome, ImportPartInfo, ImportStringNumber, Technique } from './types';

export const MAX_GUITAR_PRO_BYTES = 8 * 1024 * 1024;

type AlphaTabModule = typeof import('@coderline/alphatab');

let loading: Promise<AlphaTabModule> | null = null;

/** Load alphaTab once (lazy chunk). */
function loadAlphaTab(): Promise<AlphaTabModule> {
  loading ??= import('@coderline/alphatab').catch((e: unknown) => {
    loading = null;
    throw e;
  });
  return loading;
}

export type GuitarProKind = 'gp3-5' | 'gpx' | 'gp7';

function ascii(b: Uint8Array, from: number, len: number): string {
  let s = '';
  for (let i = from; i < Math.min(b.length, from + len); i++) s += String.fromCharCode(b[i]!);
  return s;
}

function contains(b: Uint8Array, needle: string): boolean {
  const n = [...needle].map((c) => c.charCodeAt(0));
  outer: for (let i = 0; i + n.length <= b.length; i++) {
    for (let k = 0; k < n.length; k++) if (b[i + k] !== n[k]) continue outer;
    return true;
  }
  return false;
}

/** Sniff Guitar Pro bytes without loading alphaTab. */
export function detectGuitarPro(input: Uint8Array | ArrayBuffer): GuitarProKind | null {
  const b = toBytes(input);
  if (b.length < 8) return null;
  const len = b[0]!;
  if (len >= 10 && len <= 40 && /^FICHIER GUITARE? PRO/i.test(ascii(b, 1, len))) return 'gp3-5';
  if (ascii(b, 0, 4) === 'BCFZ' || ascii(b, 0, 4) === 'BCFS') return 'gpx';
  if (ascii(b, 0, 4) === 'PK\u0003\u0004' && contains(b, 'Content/score.gpif')) return 'gp7';
  return null;
}

export interface GuitarProTrackInfo extends ImportPartInfo {
  isPercussion: boolean;
  stringCount: number;
  tuningName: string;
  capo: number;
  /** General MIDI program, if known. */
  program: number | null;
}

export interface GuitarProInspection {
  title: string | null;
  artist: string | null;
  tracks: GuitarProTrackInfo[];
  defaultSelection: number[];
}

export type GuitarProInspectOutcome = { ok: true; inspection: GuitarProInspection } | ImportFailure;

async function loadScore(input: Uint8Array | ArrayBuffer): Promise<{ at: AlphaTabModule; score: model.Score }> {
  const b = toBytes(input);
  if (b.length === 0) throw new ImportAbort('empty', 'The file is empty.');
  if (b.length > MAX_GUITAR_PRO_BYTES) throw new ImportAbort('too_large', 'This Guitar Pro file is too big to import (limit 8 MB).');
  if (!detectGuitarPro(b)) throw new ImportAbort('not_guitar_pro', "This isn't a Guitar Pro file (.gp3, .gp4, .gp5, .gpx or .gp).");
  let at: AlphaTabModule;
  try {
    at = await loadAlphaTab();
  } catch {
    throw new ImportAbort('importer_unavailable', "The Guitar Pro reader couldn't be loaded. Reload the app and try again.");
  }
  const settings = new at.Settings();
  settings.core.logLevel = at.LogLevel.None;
  try {
    return { at, score: at.importer.ScoreLoader.loadScoreFromBytes(b, settings) };
  } catch {
    throw new ImportAbort('malformed', 'This Guitar Pro file looks damaged or uses a version the reader does not understand.');
  }
}

function trackNotes(track: model.Track): model.Note[] {
  const out: model.Note[] = [];
  for (const staff of track.staves) for (const bar of staff.bars) for (const voice of bar.voices) for (const beat of voice.beats) if (!beat.isRest) out.push(...beat.notes);
  return out;
}

function describeTracks(score: model.Score): GuitarProTrackInfo[] {
  return score.tracks.map((track, index) => {
    const staff = track.staves[0];
    const notes = trackNotes(track).filter((n) => !n.isTieDestination);
    const keys = notes.map((n) => n.realValue);
    const timed = notes.map((n) => ({ startTick: n.beat.absolutePlaybackStart, durationTicks: n.beat.playbackDuration }));
    const isPercussion = staff?.isPercussion ?? false;
    const stringCount = staff?.tuning.length ?? 0;
    const program = Number.isFinite(track.playbackInfo?.program) ? track.playbackInfo.program : null;
    const inRange = keys.filter((k) => k >= 40 && k <= 88).length;
    return {
      index,
      name: (track.name || track.shortName || `Track ${index + 1}`).slice(0, 80),
      noteCount: notes.length,
      lowMidi: keys.length ? Math.min(...keys) : null,
      highMidi: keys.length ? Math.max(...keys) : null,
      maxPolyphony: maxPolyphony(timed),
      guitarLikely: !isPercussion && stringCount === 6 && (program === null || (program >= 24 && program <= 31) || (keys.length > 0 && inRange / keys.length >= 0.9)),
      isPercussion,
      stringCount,
      tuningName: stringCount ? describeTuning(staff!.tuning).name : 'None',
      capo: staff?.capo ?? 0,
      program,
    };
  });
}

function defaultTracks(tracks: GuitarProTrackInfo[]): number[] {
  const playable = tracks.filter((t) => !t.isPercussion && t.noteCount > 0);
  const pick = playable.find((t) => t.stringCount === 6 && t.program !== null && t.program >= 24 && t.program <= 31)
    ?? playable.find((t) => t.stringCount === 6)
    ?? playable[0];
  return pick ? [pick.index] : [];
}

/** List the tracks of a Guitar Pro file. Never rejects. */
export async function inspectGuitarPro(input: Uint8Array | ArrayBuffer): Promise<GuitarProInspectOutcome> {
  try {
    const { score } = await loadScore(input);
    const tracks = describeTracks(score);
    return { ok: true, inspection: { title: score.title || null, artist: score.artist || null, tracks, defaultSelection: defaultTracks(tracks) } };
  } catch (e) {
    return abortToFailure(e);
  }
}

const DYNAMIC_VELOCITY: Record<string, number> = {
  PPPPPP: 10, PPPPP: 18, PPPP: 26, PPP: 34, PP: 44, P: 54, MP: 64, MF: 76, F: 88, FF: 100, FFF: 112, FFFF: 120, FFFFF: 124, FFFFFF: 127,
};

/**
 * Convert chosen tracks (default: the first guitar track) into an ImportedSong.
 * Percussion tracks are left out. Never rejects.
 */
export async function guitarProToSong(input: Uint8Array | ArrayBuffer, trackIndexes?: readonly number[]): Promise<ImportOutcome> {
  try {
    const { at, score } = await loadScore(input);
    return convert(at, score, trackIndexes);
  } catch (e) {
    return abortToFailure(e);
  }
}

function convert(at: AlphaTabModule, score: model.Score, trackIndexes?: readonly number[]): ImportOutcome {
  const M = at.model;
  const infos = describeTracks(score);
  const wanted = trackIndexes && trackIndexes.length ? [...new Set(trackIndexes)] : defaultTracks(infos);
  if (wanted.some((i) => !Number.isInteger(i) || i < 0 || i >= score.tracks.length)) return failure('bad_selection', 'That track is not in this file.');
  const warnings: string[] = [];
  const chosen = wanted.filter((i) => !infos[i]!.isPercussion);
  if (chosen.length < wanted.length) warnings.push('Drum tracks were left out; they have no notes to play on guitar.');
  if (!chosen.length) return failure('no_notes', 'Only drum tracks were chosen. Pick a guitar track.');
  if (chosen.length > 1) warnings.push(`You picked ${chosen.length} tracks; their notes are combined into one.`);
  const firstTrack = score.tracks[chosen[0]!]!;
  const firstStaff = firstTrack.staves[0]!;
  const sixStrings = firstStaff.tuning.length === 6;
  if (!sixStrings) warnings.push(`This track is for a ${firstStaff.tuning.length}-string instrument; string and fret numbers were left out.`);
  const tuning = sixStrings ? describeTuning(firstStaff.tuning) : describeTuning([64, 59, 55, 50, 45, 40]);
  const capo = sixStrings ? firstStaff.capo : 0;

  const masterBars = score.masterBars;
  const repeatInfo = masterBars.map((mb) => {
    const endings: number[] = [];
    for (let bit = 0; bit < 8; bit++) if (mb.alternateEndings & (1 << bit)) endings.push(bit + 1);
    return { repeatStart: mb.isRepeatStart, repeatEndTimes: mb.repeatCount > 1 ? mb.repeatCount : 0, endings };
  });
  const { order, truncated } = expandRepeats(repeatInfo);
  if (truncated) warnings.push('The song was cut short because the repeats made it very long.');
  if (masterBars.some((mb) => mb.directions && mb.directions.size > 0)) warnings.push('This file has D.C./D.S./coda jumps, which were not followed; parts of the song may be missing.');

  const notes: ImportedNote[] = [];
  const chords: ImportedChord[] = [];
  const sections: { startTick: number; name: string }[] = [];
  const tempos: { tick: number; bpm: number }[] = [{ tick: 0, bpm: score.tempo }];
  const imported = new Map<model.Note, ImportedNote>();
  const sectionDone = new Set<number>();
  const chordDone = new Set<string>();
  let tick = 0;
  let ghostCount = 0;
  for (const bi of order) {
    const mb = masterBars[bi]!;
    const barLen = mb.calculateDuration();
    if (mb.section && !sectionDone.has(bi)) {
      sectionDone.add(bi);
      const name = mb.section.text || mb.section.marker;
      if (name) sections.push({ startTick: tick, name });
    }
    for (const a of mb.tempoAutomations ?? []) {
      if (bi === 0 && a.ratioPosition === 0) continue;
      tempos.push({ tick: tick + Math.round(a.ratioPosition * barLen), bpm: a.value });
    }
    for (const ti of chosen) {
      const track = score.tracks[ti]!;
      for (const staff of track.staves) {
        if (staff.isPercussion) continue;
        const bar = staff.bars[bi];
        if (!bar) continue;
        const strings = staff.tuning.length;
        for (const voice of bar.voices) {
          for (const beat of voice.beats) {
            const start = tick + beat.playbackStart;
            if (beat.chordId && staff.chords?.has(beat.chordId)) {
              const ch = staff.chords.get(beat.chordId)!;
              const key = `${start}|${ch.name}`;
              if (ch.name && !chordDone.has(key)) {
                chordDone.add(key);
                const c: ImportedChord = { startTick: start, durationTicks: 0, name: ch.name.slice(0, 24) };
                if (strings === 6 && ch.strings.length === 6) c.fretsByString = ch.strings.map((f) => (f < 0 ? null : f));
                chords.push(c);
              }
            }
            if (beat.isRest) continue;
            for (const n of beat.notes) {
              const dur = Math.max(1, beat.playbackDuration);
              if (n.isTieDestination && n.tieOrigin) {
                const origin = imported.get(n.tieOrigin);
                if (origin && origin.startTick + origin.durationTicks <= start + 1) {
                  origin.durationTicks = start + dur - origin.startTick;
                  imported.set(n, origin);
                  continue;
                }
              }
              const note: ImportedNote = { startTick: start, durationTicks: dur, midi: n.realValue };
              if (strings === 6 && n.string >= 1 && n.string <= 6) {
                note.string = (strings - n.string + 1) as ImportStringNumber;
                note.fret = n.fret;
              }
              const techniques: Technique[] = [];
              const add = (t: Technique) => {
                if (!techniques.some((x) => x.kind === t.kind)) techniques.push(t);
              };
              const ho = n.hammerPullOrigin;
              if (ho) add({ kind: n.fret >= ho.fret ? 'hammer_on' : 'pull_off' });
              const so = n.slideOrigin;
              if (so && (so.slideOutType === M.SlideOutType.Shift || so.slideOutType === M.SlideOutType.Legato) && so.fret !== n.fret) {
                add({ kind: n.fret > so.fret ? 'slide_up' : 'slide_down' });
              }
              if (n.slideInType === M.SlideInType.IntoFromBelow || n.slideInType === M.SlideInType.IntoFromAbove) add({ kind: 'slide_into' });
              if (n.bendType !== M.BendType.None) {
                const peak = Math.max(0, ...(n.bendPoints ?? []).map((p) => p.value));
                const semis = Math.round((peak / 2) * 2) / 2;
                const bend: Technique = semis > 0 ? { kind: 'bend', semitones: semis } : { kind: 'bend' };
                if (n.bendType === M.BendType.Release) add({ kind: 'release' });
                else {
                  add(bend);
                  if (n.bendType === M.BendType.BendRelease || n.bendType === M.BendType.PrebendRelease) add({ kind: 'release' });
                }
              }
              if (n.vibrato !== M.VibratoType.None || beat.vibrato !== M.VibratoType.None) add({ kind: 'vibrato' });
              if (n.isPalmMute) add({ kind: 'palm_mute' });
              if (n.isLetRing) add({ kind: 'let_ring' });
              if (n.isDead) add({ kind: 'dead_note' });
              if (n.harmonicType !== M.HarmonicType.None) add({ kind: 'harmonic' });
              if (beat.tap || n.isLeftHandTapped) add({ kind: 'tap' });
              if (techniques.length) note.techniques = techniques;
              const dyn = DYNAMIC_VELOCITY[M.DynamicValue[n.dynamics] ?? ''] ?? 88;
              note.velocity = n.isGhost ? Math.max(1, Math.round(dyn * 0.55)) : dyn;
              if (n.isGhost) ghostCount++;
              notes.push(note);
              imported.set(n, note);
            }
          }
        }
      }
    }
    tick += barLen;
  }
  if (!notes.length) return failure('no_notes', 'The chosen track has no notes.');
  const first = masterBars[0];
  const beatsPerBar = first?.timeSignatureNumerator ?? 4;
  const beatUnit = first?.timeSignatureDenominator ?? 4;
  const bpm = score.tempo;
  const changes = tempos.filter((t, k) => k > 0 && Math.abs(t.bpm - tempos[k - 1]!.bpm) >= 0.5);
  if (changes.length) warnings.push(`The tempo changes during the song (${listText(changes.map((t) => `${Math.round(t.bpm)} BPM at ${barLabel(t.tick, beatsPerBar, beatUnit)}`), 3)}). The app plays the whole song at ${Math.round(bpm)} BPM.`);
  if (masterBars.some((mb, k) => k > 0 && (mb.timeSignatureNumerator !== masterBars[k - 1]!.timeSignatureNumerator || mb.timeSignatureDenominator !== masterBars[k - 1]!.timeSignatureDenominator))) {
    warnings.push(`The time signature changes during the song; ${beatsPerBar}/${beatUnit} is used for bar numbers, so some bar lines may be off.`);
  }
  if (ghostCount) warnings.push(`${ghostCount} ghost note${ghostCount === 1 ? ' is' : 's are'} marked to be played softly.`);
  const poly = maxPolyphony(notes);
  if (poly > 6) warnings.push(`Up to ${poly} notes sound at once in places, but a guitar can play at most 6.`);
  warnings.push(...rangeWarnings(notes, tuning, capo));
  return finalizeSong({
    source: 'guitar_pro',
    title: score.title || null,
    artist: score.artist || null,
    bpm,
    beatsPerBar,
    beatUnit,
    notes,
    chords,
    sections,
    tuning,
    capo,
    warnings,
    minDurationTicks: tick,
  });
}
