/**
 * Standard MIDI File importer (format 0 and 1; RIFF/RMID wrapper accepted).
 *
 * Parses variable-length quantities, running status, sysex and meta events, tempo (the
 * first tempo is used; later changes are listed in warnings), time signature, track and
 * instrument names, markers (→ sections), program changes and note on/off (a note-on with
 * velocity 0 is a note-off). Channel 10 is drums and is never imported.
 *
 * Each (track, channel) pair with notes is one selectable part, so format-0 files (all
 * channels in one track) can still be split by instrument. Ticks are converted to PPQ 960.
 * Notes keep their pitch only — string/fret are left for the fingering planner.
 */
import {
  barLabel, failure, finalizeSong, guard, IMPORT_PPQ, ImportAbort, listText, maxPolyphony, rangeWarnings, standardTuning, toBytes,
} from './common';
import type { ImportedNote, ImportFailure, ImportOutcome, ImportPartInfo } from './types';

export const MAX_MIDI_BYTES = 4 * 1024 * 1024;
export const MAX_MIDI_EVENTS = 1_000_000;
export const MAX_MIDI_TRACKS = 256;

/** General MIDI program names (0-based). */
export const GM_PROGRAMS: readonly string[] = [
  'Acoustic Grand Piano', 'Bright Acoustic Piano', 'Electric Grand Piano', 'Honky-tonk Piano', 'Electric Piano 1', 'Electric Piano 2', 'Harpsichord', 'Clavinet',
  'Celesta', 'Glockenspiel', 'Music Box', 'Vibraphone', 'Marimba', 'Xylophone', 'Tubular Bells', 'Dulcimer',
  'Drawbar Organ', 'Percussive Organ', 'Rock Organ', 'Church Organ', 'Reed Organ', 'Accordion', 'Harmonica', 'Tango Accordion',
  'Acoustic Guitar (nylon)', 'Acoustic Guitar (steel)', 'Electric Guitar (jazz)', 'Electric Guitar (clean)', 'Electric Guitar (muted)', 'Overdriven Guitar', 'Distortion Guitar', 'Guitar Harmonics',
  'Acoustic Bass', 'Electric Bass (finger)', 'Electric Bass (pick)', 'Fretless Bass', 'Slap Bass 1', 'Slap Bass 2', 'Synth Bass 1', 'Synth Bass 2',
  'Violin', 'Viola', 'Cello', 'Contrabass', 'Tremolo Strings', 'Pizzicato Strings', 'Orchestral Harp', 'Timpani',
  'String Ensemble 1', 'String Ensemble 2', 'Synth Strings 1', 'Synth Strings 2', 'Choir Aahs', 'Voice Oohs', 'Synth Voice', 'Orchestra Hit',
  'Trumpet', 'Trombone', 'Tuba', 'Muted Trumpet', 'French Horn', 'Brass Section', 'Synth Brass 1', 'Synth Brass 2',
  'Soprano Sax', 'Alto Sax', 'Tenor Sax', 'Baritone Sax', 'Oboe', 'English Horn', 'Bassoon', 'Clarinet',
  'Piccolo', 'Flute', 'Recorder', 'Pan Flute', 'Blown Bottle', 'Shakuhachi', 'Whistle', 'Ocarina',
  'Lead 1 (square)', 'Lead 2 (sawtooth)', 'Lead 3 (calliope)', 'Lead 4 (chiff)', 'Lead 5 (charang)', 'Lead 6 (voice)', 'Lead 7 (fifths)', 'Lead 8 (bass + lead)',
  'Pad 1 (new age)', 'Pad 2 (warm)', 'Pad 3 (polysynth)', 'Pad 4 (choir)', 'Pad 5 (bowed)', 'Pad 6 (metallic)', 'Pad 7 (halo)', 'Pad 8 (sweep)',
  'FX 1 (rain)', 'FX 2 (soundtrack)', 'FX 3 (crystal)', 'FX 4 (atmosphere)', 'FX 5 (brightness)', 'FX 6 (goblins)', 'FX 7 (echoes)', 'FX 8 (sci-fi)',
  'Sitar', 'Banjo', 'Shamisen', 'Koto', 'Kalimba', 'Bagpipe', 'Fiddle', 'Shanai',
  'Tinkle Bell', 'Agogo', 'Steel Drums', 'Woodblock', 'Taiko Drum', 'Melodic Tom', 'Synth Drum', 'Reverse Cymbal',
  'Guitar Fret Noise', 'Breath Noise', 'Seashore', 'Bird Tweet', 'Telephone Ring', 'Helicopter', 'Applause', 'Gunshot',
];

export interface MidiTrackInfo extends ImportPartInfo {
  /** MTrk chunk index (0-based). */
  trackNumber: number;
  /** MIDI channel 1–16 (10 = drums). */
  channel: number;
  /** General MIDI program 0–127, or null when the file sets none. */
  program: number | null;
  programName: string | null;
  isDrums: boolean;
}

export interface MidiInspection {
  format: 0 | 1;
  /** Ticks per quarter note in the file (null for SMPTE time). */
  ticksPerQuarter: number | null;
  title: string | null;
  bpm: number;
  tracks: MidiTrackInfo[];
  /** Suggested part(s) to import: a GM guitar part, else the busiest part in guitar range. */
  defaultSelection: number[];
  warnings: string[];
}

export type MidiInspectOutcome = { ok: true; inspection: MidiInspection } | ImportFailure;

interface RawNote {
  tick: number;
  end: number;
  key: number;
  velocity: number;
}

interface Part {
  trackNumber: number;
  channel: number;
  notes: RawNote[];
}

interface ParsedMidi {
  format: 0 | 1;
  division: number;
  smpte: { fps: number; tpf: number } | null;
  parts: Part[];
  trackNames: (string | null)[];
  instrumentNames: (string | null)[];
  /** program by track and channel, and by channel across the file */
  programByTrack: Map<string, number>;
  programByChannel: Map<number, number>;
  tempos: { tick: number; usPerQuarter: number }[];
  meters: { tick: number; num: number; den: number }[];
  markers: { tick: number; text: string }[];
  warnings: string[];
  maxTick: number;
}

const decoder = new TextDecoder('utf-8');

function text(bytes: Uint8Array): string {
  return decoder.decode(bytes).replace(/[\u0000-\u001f\u007f�]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
}

function fourCC(b: Uint8Array, at: number): string {
  return String.fromCharCode(b[at] ?? 0, b[at + 1] ?? 0, b[at + 2] ?? 0, b[at + 3] ?? 0);
}

function u32(b: Uint8Array, at: number): number {
  return ((b[at]! << 24) >>> 0) + (b[at + 1]! << 16) + (b[at + 2]! << 8) + b[at + 3]!;
}

function u16(b: Uint8Array, at: number): number {
  return (b[at]! << 8) + b[at + 1]!;
}

/** Locate the SMF header, unwrapping a RIFF RMID container. */
function findHeader(b: Uint8Array): number {
  if (fourCC(b, 0) === 'MThd') return 0;
  if (fourCC(b, 0) === 'RIFF' && fourCC(b, 8) === 'RMID') {
    for (let i = 12; i + 4 <= Math.min(b.length, 4096); i++) if (fourCC(b, i) === 'MThd') return i;
  }
  return -1;
}

function parse(input: Uint8Array | ArrayBuffer): ParsedMidi {
  const b = toBytes(input);
  if (b.length === 0) throw new ImportAbort('empty', 'The file is empty.');
  if (b.length > MAX_MIDI_BYTES) throw new ImportAbort('too_large', 'This MIDI file is too big to import (limit 4 MB).');
  const h = findHeader(b);
  if (h < 0 || b.length < h + 14) throw new ImportAbort('not_midi', "This isn't a MIDI file.");
  const headerLen = u32(b, h + 4);
  if (headerLen < 6) throw new ImportAbort('not_midi', "This isn't a valid MIDI file.");
  const format = u16(b, h + 8);
  const ntrks = u16(b, h + 10);
  const divRaw = u16(b, h + 12);
  if (format === 2) throw new ImportAbort('unsupported_format', 'This MIDI file uses format 2 (separate patterns), which is not supported.');
  if (format !== 0 && format !== 1) throw new ImportAbort('not_midi', "This isn't a valid MIDI file.");
  if (ntrks > MAX_MIDI_TRACKS) throw new ImportAbort('too_complex', 'This MIDI file has too many tracks to import.');
  let division = divRaw;
  let smpte: ParsedMidi['smpte'] = null;
  if (divRaw & 0x8000) {
    const fps = 256 - (divRaw >> 8);
    const tpf = divRaw & 0xff;
    if (!fps || !tpf) throw new ImportAbort('malformed', 'This MIDI file has an invalid timing header.');
    smpte = { fps, tpf };
    division = fps * tpf;
  }
  if (division <= 0) throw new ImportAbort('malformed', 'This MIDI file has an invalid timing header.');

  const out: ParsedMidi = {
    format, division, smpte, parts: [], trackNames: [], instrumentNames: [], programByTrack: new Map(), programByChannel: new Map(),
    tempos: [], meters: [], markers: [], warnings: [], maxTick: 0,
  };
  let pos = h + 8 + headerLen;
  let events = 0;
  let track = 0;
  let truncated = false;
  let badTracks = 0;
  let strayOffs = 0;
  let unclosed = 0;
  while (track < ntrks && pos + 8 <= b.length) {
    const id = fourCC(b, pos);
    const len = u32(b, pos + 4);
    const start = pos + 8;
    let end = start + len;
    if (end > b.length) {
      end = b.length;
      truncated = true;
    }
    pos = start + len;
    if (id !== 'MTrk') continue; // unknown chunk: skip
    const t = track++;
    out.trackNames[t] = null;
    out.instrumentNames[t] = null;
    const open = new Map<number, { tick: number; velocity: number }[]>();
    const partsByChannel = new Map<number, Part>();
    let p = start;
    let tick = 0;
    let status = 0;
    const vlq = (): number => {
      let v = 0;
      for (let k = 0; k < 4; k++) {
        if (p >= end) throw new RangeError('eot');
        const byte = b[p++]!;
        v = (v << 7) | (byte & 0x7f);
        if (!(byte & 0x80)) return v;
      }
      throw new RangeError('vlq');
    };
    try {
      while (p < end) {
        if (++events > MAX_MIDI_EVENTS) throw new ImportAbort('too_complex', 'This MIDI file has too many events to import.');
        tick += vlq();
        if (p >= end) break;
        let s = b[p]!;
        if (s & 0x80) {
          p++;
        } else {
          if (!status) throw new RangeError('running status without status');
          s = status;
        }
        if (s === 0xff) {
          status = 0;
          const type = b[p++]!;
          const l = vlq();
          if (p + l > end) throw new RangeError('meta overrun');
          const data = b.subarray(p, p + l);
          p += l;
          if (type === 0x2f) break;
          if (type === 0x51 && l >= 3) out.tempos.push({ tick, usPerQuarter: (data[0]! << 16) | (data[1]! << 8) | data[2]! });
          else if (type === 0x58 && l >= 2) out.meters.push({ tick, num: data[0]!, den: 2 ** data[1]! });
          else if (type === 0x03 && out.trackNames[t] === null) out.trackNames[t] = text(data) || null;
          else if (type === 0x04 && out.instrumentNames[t] === null) out.instrumentNames[t] = text(data) || null;
          else if (type === 0x06) {
            const m = text(data);
            if (m) out.markers.push({ tick, text: m });
          }
          continue;
        }
        if (s === 0xf0 || s === 0xf7) {
          status = 0;
          const l = vlq();
          p += l;
          if (p > end) throw new RangeError('sysex overrun');
          continue;
        }
        if (s >= 0xf1) {
          // System common / real-time bytes don't belong in a file; skip their data.
          p += s === 0xf2 ? 2 : s === 0xf1 || s === 0xf3 ? 1 : 0;
          continue;
        }
        status = s;
        const kind = s & 0xf0;
        const ch = s & 0x0f;
        const d1 = b[p++];
        const d2 = kind === 0xc0 || kind === 0xd0 ? 0 : b[p++];
        if (d1 === undefined || d2 === undefined || p > end) throw new RangeError('data overrun');
        if (kind === 0x90 && d2 > 0) {
          const key = (ch << 8) | d1;
          const list = open.get(key) ?? [];
          list.push({ tick, velocity: d2 });
          open.set(key, list);
        } else if (kind === 0x80 || kind === 0x90) {
          const key = (ch << 8) | d1;
          const on = open.get(key)?.shift();
          if (!on) {
            strayOffs++;
            continue;
          }
          let part = partsByChannel.get(ch);
          if (!part) {
            part = { trackNumber: t, channel: ch, notes: [] };
            partsByChannel.set(ch, part);
          }
          part.notes.push({ tick: on.tick, end: tick, key: d1, velocity: on.velocity });
        } else if (kind === 0xc0) {
          if (!out.programByTrack.has(`${t}:${ch}`)) out.programByTrack.set(`${t}:${ch}`, d1);
          if (!out.programByChannel.has(ch)) out.programByChannel.set(ch, d1);
        }
      }
    } catch (e) {
      if (e instanceof ImportAbort) throw e;
      badTracks++;
    }
    // Close notes still sounding at the end of the track.
    for (const [key, list] of open) {
      for (const on of list) {
        unclosed++;
        const ch = key >> 8;
        let part = partsByChannel.get(ch);
        if (!part) {
          part = { trackNumber: t, channel: ch, notes: [] };
          partsByChannel.set(ch, part);
        }
        part.notes.push({ tick: on.tick, end: Math.max(tick, on.tick + 1), key: key & 0xff, velocity: on.velocity });
      }
    }
    out.maxTick = Math.max(out.maxTick, tick);
    for (const part of [...partsByChannel.values()].sort((a, c) => a.channel - c.channel)) {
      part.notes.sort((a, c) => a.tick - c.tick || a.key - c.key);
      out.parts.push(part);
    }
  }
  if (track === 0) throw new ImportAbort('not_midi', "This MIDI file has no tracks.");
  if (truncated) out.warnings.push('The file seems to be cut short; the end of the song may be missing.');
  if (badTracks) out.warnings.push(`${badTracks} track${badTracks === 1 ? ' was' : 's were'} damaged; the notes before the damage were kept.`);
  if (unclosed) out.warnings.push(`${unclosed} note${unclosed === 1 ? '' : 's'} never ended in the file and were stopped at the end of the track.`);
  if (strayOffs > 50) out.warnings.push('The file has many note-off messages without matching notes; some timing may be off.');
  out.tempos.sort((a, c) => a.tick - c.tick);
  out.meters.sort((a, c) => a.tick - c.tick);
  return out;
}

function toTick(m: ParsedMidi, raw: number): number {
  if (m.smpte) return Math.round((raw / m.division) * 2 * IMPORT_PPQ); // seconds at 120 BPM
  return Math.round((raw * IMPORT_PPQ) / m.division);
}

function bpmOf(m: ParsedMidi): number {
  if (m.smpte) return 120;
  const first = m.tempos[0];
  return first ? Math.round((60_000_000 / first.usPerQuarter) * 100) / 100 : 120;
}

function partName(m: ParsedMidi, part: Part, multiChannel: boolean): string {
  const base = m.trackNames[part.trackNumber] ?? m.instrumentNames[part.trackNumber] ?? programOf(m, part).name ?? `Track ${part.trackNumber + 1}`;
  return multiChannel ? `${base} (channel ${part.channel + 1})` : base;
}

function programOf(m: ParsedMidi, part: Part): { program: number | null; name: string | null } {
  const program = m.programByTrack.get(`${part.trackNumber}:${part.channel}`) ?? m.programByChannel.get(part.channel) ?? null;
  return { program, name: part.channel === 9 ? 'Drums' : program === null ? null : GM_PROGRAMS[program] ?? null };
}

function describe(m: ParsedMidi): MidiTrackInfo[] {
  const channelsPerTrack = new Map<number, number>();
  for (const p of m.parts) channelsPerTrack.set(p.trackNumber, (channelsPerTrack.get(p.trackNumber) ?? 0) + 1);
  return m.parts.map((part, index) => {
    const { program, name } = programOf(m, part);
    const isDrums = part.channel === 9;
    const keys = part.notes.map((n) => n.key);
    const inRange = keys.filter((k) => k >= 40 && k <= 88).length;
    const poly = maxPolyphony(part.notes.map((n) => ({ startTick: n.tick, durationTicks: n.end - n.tick })));
    const guitarProgram = program !== null && program >= 24 && program <= 31;
    const bass = program !== null && program >= 32 && program <= 39;
    const guitarLikely = !isDrums && (guitarProgram || (!bass && keys.length > 0 && inRange / keys.length >= 0.9 && poly <= 6));
    return {
      index,
      trackNumber: part.trackNumber,
      channel: part.channel + 1,
      name: partName(m, part, (channelsPerTrack.get(part.trackNumber) ?? 0) > 1),
      program,
      programName: name,
      isDrums,
      noteCount: part.notes.length,
      lowMidi: keys.length ? Math.min(...keys) : null,
      highMidi: keys.length ? Math.max(...keys) : null,
      maxPolyphony: poly,
      guitarLikely,
    };
  });
}

/** GM guitar programs (24–31) first, else the busiest non-drum part mostly within MIDI 40–88. */
export function defaultMidiSelection(tracks: readonly MidiTrackInfo[], parsedNotes?: readonly number[][]): number[] {
  const melodic = tracks.filter((t) => !t.isDrums && t.noteCount > 0);
  const guitar = melodic.filter((t) => t.program !== null && t.program >= 24 && t.program <= 31);
  const busiest = (list: MidiTrackInfo[]) => [...list].sort((a, b) => b.noteCount - a.noteCount || a.index - b.index)[0];
  if (guitar.length) return [busiest(guitar)!.index];
  const mostlyInRange = melodic.filter((t) => {
    const keys = parsedNotes?.[t.index];
    if (keys) return keys.filter((k) => k >= 40 && k <= 88).length / Math.max(1, keys.length) >= 0.7;
    return t.lowMidi !== null && t.highMidi !== null && t.lowMidi >= 36 && t.highMidi <= 92;
  });
  const pick = busiest(mostlyInRange) ?? busiest(melodic);
  return pick ? [pick.index] : [];
}

function inspectParsed(m: ParsedMidi): MidiInspection {
  const tracks = describe(m);
  const title = m.format === 1 || m.parts.length === 0 ? m.trackNames[0] ?? null : m.trackNames[0] ?? null;
  return {
    format: m.format,
    ticksPerQuarter: m.smpte ? null : m.division,
    title,
    bpm: bpmOf(m),
    tracks,
    defaultSelection: defaultMidiSelection(tracks, m.parts.map((p) => p.notes.map((n) => n.key))),
    warnings: [...m.warnings],
  };
}

/** List the parts in a MIDI file so the learner can choose. Never throws. */
export function inspectMidi(bytes: Uint8Array | ArrayBuffer): MidiInspectOutcome {
  return guard(() => ({ ok: true as const, inspection: inspectParsed(parse(bytes)) }));
}

/**
 * Convert chosen parts (indexes from `inspectMidi`, default = `defaultSelection`) into an
 * ImportedSong at PPQ 960. Drum parts are always left out. Never throws.
 */
export function midiToSong(bytes: Uint8Array | ArrayBuffer, trackIndexes?: readonly number[]): ImportOutcome {
  return guard(() => {
    const m = parse(bytes);
    const info = inspectParsed(m);
    const wanted = trackIndexes && trackIndexes.length ? [...new Set(trackIndexes)] : info.defaultSelection;
    if (!info.tracks.length) return failure('no_notes', 'This MIDI file has no notes.');
    const bad = wanted.filter((i) => !Number.isInteger(i) || i < 0 || i >= info.tracks.length);
    if (bad.length) return failure('bad_selection', 'That track is not in this file.');
    const warnings = [...m.warnings];
    const chosen = wanted.filter((i) => !info.tracks[i]!.isDrums);
    if (chosen.length < wanted.length) warnings.push('Drum parts (channel 10) were left out; they have no notes to play on guitar.');
    if (!chosen.length) return failure('no_notes', 'Only drum parts were chosen. Pick a melodic part.');
    if (chosen.length > 1) warnings.push(`You picked ${chosen.length} parts; their notes are combined into one.`);
    const notes: ImportedNote[] = [];
    for (const i of chosen) {
      for (const n of m.parts[i]!.notes) {
        const start = toTick(m, n.tick);
        notes.push({ startTick: start, durationTicks: Math.max(1, toTick(m, n.end) - start), midi: n.key, velocity: n.velocity });
      }
    }
    if (!notes.length) return failure('no_notes', 'The chosen part has no notes.');
    const meter = m.meters[0];
    const beatsPerBar = meter && meter.num >= 1 ? meter.num : 4;
    const beatUnit = meter && [1, 2, 4, 8, 16, 32].includes(meter.den) ? meter.den : 4;
    const bpm = bpmOf(m);
    if (m.smpte) warnings.push('This MIDI file counts time in seconds rather than beats, so it is shown at 120 BPM and the bars may not line up with the music.');
    const changes = m.smpte ? [] : m.tempos.filter((t, k) => k > 0 && t.usPerQuarter !== m.tempos[k - 1]!.usPerQuarter);
    if (changes.length) {
      const list = changes.map((t) => `${Math.round(60_000_000 / t.usPerQuarter)} BPM at ${barLabel(toTick(m, t.tick), beatsPerBar, beatUnit)}`);
      warnings.push(`The tempo changes during the song (${listText(list, 3)}). The app plays the whole song at ${Math.round(bpm)} BPM, so it may drift from a recording.`);
    }
    if (m.tempos[0] && m.tempos[0].tick > 0 && !m.smpte) warnings.push('The first tempo mark comes after the start; it is used for the whole song.');
    const meterChanges = m.meters.filter((t, k) => k > 0 && (t.num !== m.meters[k - 1]!.num || t.den !== m.meters[k - 1]!.den));
    if (meterChanges.length) warnings.push(`The time signature changes during the song; ${beatsPerBar}/${beatUnit} is used throughout, so some bar lines may be off.`);
    const poly = maxPolyphony(notes);
    if (poly > 6) warnings.push(`Up to ${poly} notes sound at once in places, but a guitar can play at most 6.`);
    const tuning = standardTuning();
    warnings.push(...rangeWarnings(notes, tuning, 0));
    const names = chosen.map((i) => info.tracks[i]!.name);
    return finalizeSong({
      source: 'midi',
      title: info.title ?? (chosen.length === 1 ? names[0]! : null),
      artist: null,
      bpm,
      beatsPerBar,
      beatUnit,
      notes,
      chords: [],
      sections: m.markers.map((mk) => ({ startTick: toTick(m, mk.tick), name: mk.text })),
      tuning,
      capo: 0,
      warnings,
    });
  });
}
