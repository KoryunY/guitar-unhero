/**
 * MusicXML importer (uncompressed, partwise).
 *
 * Reads divisions, pitch (with `<transpose>`), duration, `<chord/>`, rests, `<backup>` /
 * `<forward>`, ties, grace notes (skipped), `<technical><string>/<fret>`, hammer-on,
 * pull-off, slides/glissandos, bends, harmonics, taps, x noteheads (dead notes), staff
 * tuning and capo, `<sound tempo>` / metronome marks, time signatures, rehearsal marks and
 * section words, `<harmony>` chord symbols (with fret diagrams → fretsByString), and
 * repeats with 1st/2nd endings (expanded). Compressed `.mxl` (zip) and timewise scores are
 * rejected with a clear message. D.C./D.S./coda jumps are not followed (warned).
 */
import { parseChordName } from '../chords';
import {
  barLabel, decodeText, describeTuning, expandRepeats, failure, finalizeSong, guard, IMPORT_PPQ, ImportAbort, isValidMeter, listText,
  maxPolyphony, mod12, rangeWarnings, STANDARD_OPEN_BY_STRING, toBytes, type RepeatInfo,
} from './common';
import { sectionHeading } from './chordSheet';
import type { ImportedChord, ImportedNote, ImportFailure, ImportOutcome, ImportPartInfo, ImportStringNumber, Technique } from './types';
import { child, childrenNamed, numAt, parseXml, textAt, XmlError, type XmlNode } from './xml';

export const MAX_MUSICXML_CHARS = 16 * 1024 * 1024;

export interface MusicXmlPartInfo extends ImportPartInfo {
  id: string;
  /** Has tab data (string/fret on notes). */
  hasTab: boolean;
}

export interface MusicXmlInspection {
  title: string | null;
  parts: MusicXmlPartInfo[];
  defaultSelection: number[];
}

export type MusicXmlInspectOutcome = { ok: true; inspection: MusicXmlInspection } | ImportFailure;

const STEP_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const KIND_SUFFIX: Record<string, string | null> = {
  major: '', minor: 'm', augmented: 'aug', diminished: 'dim', dominant: '7', 'major-seventh': 'maj7', 'minor-seventh': 'm7',
  'diminished-seventh': 'dim7', 'augmented-seventh': '7#5', 'half-diminished': 'm7b5', 'major-minor': 'mmaj7', 'major-sixth': '6',
  'minor-sixth': 'm6', 'dominant-ninth': '9', 'major-ninth': 'maj9', 'minor-ninth': 'm9', 'dominant-11th': '11', 'major-11th': 'maj11',
  'minor-11th': 'm11', 'dominant-13th': '13', 'major-13th': 'maj13', 'minor-13th': 'm13', 'suspended-second': 'sus2',
  'suspended-fourth': 'sus4', power: '5', pedal: '5', none: null,
};

interface XNote {
  pos: number;
  dur: number;
  midi: number;
  string: number | null;
  fret: number | null;
  voice: string;
  tieStart: boolean;
  tieStop: boolean;
  techniques: Technique[];
  slideStop: boolean;
  velocity?: number;
}

interface XMeasure extends RepeatInfo {
  len: number;
  notes: XNote[];
  harmonies: { pos: number; name: string; frets?: (number | null)[] }[];
  tempos: { pos: number; bpm: number }[];
  sections: { pos: number; name: string }[];
  meter: [number, number] | null;
  jumps: boolean;
}

interface XPart {
  id: string;
  name: string;
  measures: XMeasure[];
  tuning: number[] | null;
  capo: number;
  stringCount: number;
  graceSkipped: number;
}

function ticks(dur: number, divisions: number): number {
  return (dur * IMPORT_PPQ) / divisions;
}

function pitchMidi(p: XmlNode | undefined): number | null {
  const step = textAt(p, 'step');
  const octave = numAt(p, 'octave');
  if (!step || octave === null || STEP_PC[step] === undefined) return null;
  return (octave + 1) * 12 + STEP_PC[step]! + Math.round(numAt(p, 'alter') ?? 0);
}

function harmonyName(h: XmlNode): string | null {
  const root = child(h, 'root');
  const step = textAt(root, 'root-step');
  if (!step || STEP_PC[step] === undefined) return null;
  const alter = Math.round(numAt(root, 'root-alter') ?? 0);
  const kindNode = child(h, 'kind');
  const kind = kindNode?.text.trim() ?? 'major';
  let suffix = KIND_SUFFIX[kind];
  if (suffix === null) return null;
  const textAttr = kindNode?.attrs['text'];
  if (suffix === undefined) suffix = textAttr ?? '';
  const bassNode = child(h, 'bass');
  const bassStep = textAt(bassNode, 'bass-step');
  const bassAlter = Math.round(numAt(bassNode, 'bass-alter') ?? 0);
  const acc = (a: number) => (a > 0 ? '#' : a < 0 ? 'b' : '');
  const raw = `${step}${acc(alter)}${suffix}${bassStep ? `/${bassStep}${acc(bassAlter)}` : ''}`;
  const parsed = parseChordName(raw) ?? (textAttr ? parseChordName(`${step}${acc(alter)}${textAttr}`) : null);
  return parsed ? parsed.display : raw.slice(0, 16);
}

function frameFrets(h: XmlNode): (number | null)[] | undefined {
  const frame = child(h, 'frame');
  if (!frame) return undefined;
  const strings = numAt(frame, 'frame-strings') ?? 6;
  if (strings !== 6) return undefined;
  const out: (number | null)[] = [null, null, null, null, null, null];
  for (const fn of childrenNamed(frame, 'frame-note')) {
    const s = numAt(fn, 'string');
    const f = numAt(fn, 'fret');
    if (s !== null && f !== null && s >= 1 && s <= 6 && f >= 0 && f <= 24) out[s - 1] = f;
  }
  return out;
}

function noteTechniques(note: XmlNode): { techniques: Technique[]; slideStop: boolean } {
  const techniques: Technique[] = [];
  const add = (t: Technique) => {
    if (!techniques.some((x) => x.kind === t.kind)) techniques.push(t);
  };
  let slideStop = false;
  for (const notations of childrenNamed(note, 'notations')) {
    for (const n of notations.children) {
      if ((n.name === 'slide' || n.name === 'glissando') && n.attrs['type'] === 'stop') slideStop = true;
      if (n.name === 'ornaments' && n.children.some((o) => o.name === 'wavy-line' || o.name === 'vibrato' || o.name === 'trill-mark')) add({ kind: 'vibrato' });
      if (n.name !== 'technical') continue;
      for (const t of n.children) {
        if (t.name === 'hammer-on' && t.attrs['type'] === 'stop') add({ kind: 'hammer_on' });
        else if (t.name === 'pull-off' && t.attrs['type'] === 'stop') add({ kind: 'pull_off' });
        else if (t.name === 'tap') add({ kind: 'tap' });
        else if (t.name === 'harmonic') add({ kind: 'harmonic' });
        else if (t.name === 'bend') {
          const alter = numAt(t, 'bend-alter');
          if (child(t, 'release')) {
            add({ kind: 'release' });
            if (child(t, 'pre-bend')) add(alter !== null ? { kind: 'bend', semitones: Math.abs(alter) } : { kind: 'bend' });
          } else add(alter !== null && alter > 0 ? { kind: 'bend', semitones: alter } : { kind: 'bend' });
        } else if (t.name === 'other-technical') {
          const txt = t.text.toLowerCase();
          if (/palm|p\.?\s?m\.?/.test(txt)) add({ kind: 'palm_mute' });
          else if (/let\s*ring/.test(txt)) add({ kind: 'let_ring' });
          else if (/dead|mute/.test(txt)) add({ kind: 'dead_note' });
        }
      }
    }
  }
  if (textAt(note, 'notehead') === 'x') add({ kind: 'dead_note' });
  return { techniques, slideStop };
}

function readPart(partNode: XmlNode, id: string, name: string): XPart {
  const part: XPart = { id, name, measures: [], tuning: null, capo: 0, stringCount: 6, graceSkipped: 0 };
  let divisions = 1;
  let transpose = 0;
  let meter: [number, number] = [4, 4];
  let endings: number[] = [];
  for (const m of childrenNamed(partNode, 'measure')) {
    const meas: XMeasure = { len: 0, notes: [], harmonies: [], tempos: [], sections: [], meter: null, jumps: false };
    let pos = 0;
    let maxPos = 0;
    let lastStart = 0;
    if (endings.length) meas.endings = [...endings];
    for (const el of m.children) {
      switch (el.name) {
        case 'attributes': {
          const d = numAt(el, 'divisions');
          if (d !== null && d > 0) divisions = d;
          const time = child(el, 'time');
          const beats = numAt(time, 'beats');
          const beatType = numAt(time, 'beat-type');
          if (beats !== null && beatType !== null && isValidMeter(beats, beatType)) {
            meter = [beats, beatType];
            meas.meter = meter;
          }
          const tr = child(el, 'transpose');
          if (tr) transpose = Math.round((numAt(tr, 'chromatic') ?? 0) + 12 * (numAt(tr, 'octave-change') ?? 0));
          const sd = child(el, 'staff-details');
          if (sd) {
            const lines = numAt(sd, 'staff-lines');
            const tunings = childrenNamed(sd, 'staff-tuning');
            if (tunings.length) {
              const count = Math.max(lines ?? 0, ...tunings.map((t) => Number(t.attrs['line'] ?? 0)));
              part.stringCount = count;
              const open = [...STANDARD_OPEN_BY_STRING];
              const byString: number[] = [];
              for (const t of tunings) {
                const line = Number(t.attrs['line']);
                const step = textAt(t, 'tuning-step');
                const oct = numAt(t, 'tuning-octave');
                if (!line || !step || oct === null || STEP_PC[step] === undefined) continue;
                const midi = (oct + 1) * 12 + STEP_PC[step]! + Math.round(numAt(t, 'tuning-alter') ?? 0);
                byString[count - line] = midi;
              }
              for (let k = 0; k < Math.min(6, count); k++) if (byString[k] !== undefined) open[k] = byString[k]!;
              part.tuning = count === 6 ? open : byString.slice(0, count).map((v, k) => v ?? open[k] ?? 40);
            }
            const capo = numAt(sd, 'capo');
            if (capo !== null && capo >= 0 && capo <= 12) part.capo = capo;
          }
          break;
        }
        case 'note': {
          if (child(el, 'grace')) {
            part.graceSkipped++;
            break;
          }
          if (child(el, 'cue')) break;
          const dur = ticks(numAt(el, 'duration') ?? 0, divisions);
          const isChord = !!child(el, 'chord');
          const start = isChord ? lastStart : pos;
          if (!isChord) {
            lastStart = pos;
            pos += dur;
            maxPos = Math.max(maxPos, pos);
          }
          if (child(el, 'rest')) break;
          const p = pitchMidi(child(el, 'pitch'));
          if (p === null) break; // unpitched (percussion) or broken
          const technical = childrenNamed(el, 'notations').map((n) => child(n, 'technical')).find(Boolean);
          const s = numAt(technical, 'string');
          const f = numAt(technical, 'fret');
          const ties = childrenNamed(el, 'tie').map((t) => t.attrs['type']);
          const tied = childrenNamed(el, 'notations').flatMap((n) => childrenNamed(n, 'tied')).map((t) => t.attrs['type']);
          const tech = noteTechniques(el);
          const dyn = Number(el.attrs['dynamics']);
          const note: XNote = {
            pos: start,
            dur,
            midi: p + transpose,
            string: s !== null && s >= 1 ? s : null,
            fret: f !== null && f >= 0 ? f : null,
            voice: textAt(el, 'voice') ?? '1',
            tieStart: ties.includes('start') || tied.includes('start'),
            tieStop: ties.includes('stop') || tied.includes('stop'),
            techniques: tech.techniques,
            slideStop: tech.slideStop,
          };
          if (Number.isFinite(dyn) && dyn > 0) note.velocity = Math.max(1, Math.min(127, Math.round((dyn / 100) * 90)));
          meas.notes.push(note);
          break;
        }
        case 'backup':
          pos = Math.max(0, pos - ticks(numAt(el, 'duration') ?? 0, divisions));
          break;
        case 'forward':
          pos += ticks(numAt(el, 'duration') ?? 0, divisions);
          maxPos = Math.max(maxPos, pos);
          break;
        case 'direction':
        case 'sound': {
          const sounds = el.name === 'sound' ? [el] : childrenNamed(el, 'sound');
          const offset = ticks(numAt(el, 'offset') ?? 0, divisions);
          for (const snd of sounds) {
            const tempo = Number(snd.attrs['tempo']);
            if (Number.isFinite(tempo) && tempo > 0) meas.tempos.push({ pos: pos + offset, bpm: tempo });
            if (snd.attrs['dacapo'] === 'yes' || snd.attrs['dalsegno'] || snd.attrs['tocoda'] || snd.attrs['fine']) meas.jumps = true;
          }
          for (const dt of childrenNamed(el, 'direction-type')) {
            const reh = textAt(dt, 'rehearsal');
            if (reh) meas.sections.push({ pos: pos + offset, name: reh });
            for (const w of childrenNamed(dt, 'words')) {
              const h = sectionHeading(w.text.trim());
              if (h) meas.sections.push({ pos: pos + offset, name: h });
            }
            const metro = child(dt, 'metronome');
            const pm = numAt(metro, 'per-minute');
            if (pm && !sounds.some((x) => x.attrs['tempo'])) {
              const unit = textAt(metro, 'beat-unit');
              const factor = (unit === 'half' ? 2 : unit === 'eighth' ? 0.5 : unit === 'whole' ? 4 : 1) * (child(metro, 'beat-unit-dot') ? 1.5 : 1);
              meas.tempos.push({ pos: pos + offset, bpm: pm * factor });
            }
          }
          break;
        }
        case 'harmony': {
          const name = harmonyName(el);
          if (name) {
            const frets = frameFrets(el);
            const h: XMeasure['harmonies'][number] = { pos: pos + ticks(numAt(el, 'offset') ?? 0, divisions), name };
            if (frets) h.frets = frets;
            meas.harmonies.push(h);
          }
          break;
        }
        case 'barline': {
          const rep = child(el, 'repeat');
          if (rep?.attrs['direction'] === 'forward') meas.repeatStart = true;
          if (rep?.attrs['direction'] === 'backward') meas.repeatEndTimes = Math.max(2, Number(rep.attrs['times'] ?? 2) || 2);
          const ending = child(el, 'ending');
          if (ending) {
            const nums = (ending.attrs['number'] ?? '').split(/[,\s]+/).map(Number).filter((x) => Number.isInteger(x) && x > 0);
            const type = ending.attrs['type'];
            if (type === 'start') {
              endings = nums;
              meas.endings = [...nums];
            } else if (type === 'stop' || type === 'discontinue') {
              if (!meas.endings?.length && nums.length) meas.endings = nums;
              endings = [];
            }
          }
          break;
        }
        default:
          break;
      }
    }
    const meterTicks = Math.round((meter[0] * IMPORT_PPQ * 4) / meter[1]);
    meas.len = maxPos > 0 ? Math.round(maxPos) : meterTicks;
    part.measures.push(meas);
  }
  return part;
}

interface ParsedScore {
  title: string | null;
  artist: string | null;
  parts: XPart[];
}

function parseScore(input: string | Uint8Array | ArrayBuffer): ParsedScore {
  let text: string;
  if (typeof input === 'string') text = input;
  else {
    const b = toBytes(input);
    if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) {
      throw new ImportAbort('compressed_musicxml', 'This is a compressed MusicXML file (.mxl). Export it again as uncompressed MusicXML (.musicxml or .xml) and import that.');
    }
    text = decodeText(b);
  }
  if (!text.trim()) throw new ImportAbort('empty', 'The file is empty.');
  if (text.length > MAX_MUSICXML_CHARS) throw new ImportAbort('too_large', 'This MusicXML file is too big to import (limit 16 MB).');
  if (text.startsWith('PK')) throw new ImportAbort('compressed_musicxml', 'This is a compressed MusicXML file (.mxl). Export it again as uncompressed MusicXML (.musicxml or .xml) and import that.');
  let root: XmlNode;
  try {
    root = parseXml(text);
  } catch (e) {
    if (e instanceof XmlError && /too many/.test(e.message)) throw new ImportAbort('too_complex', 'This MusicXML file is too big to import.');
    throw new ImportAbort('not_musicxml', "This isn't a MusicXML file.");
  }
  if (root.name === 'score-timewise') throw new ImportAbort('unsupported_format', 'This MusicXML file is "timewise", which is not supported. Export it again in the usual (partwise) layout.');
  if (root.name !== 'score-partwise') throw new ImportAbort('not_musicxml', "This isn't a MusicXML score.");
  const title = textAt(root, 'work', 'work-title') ?? textAt(root, 'movement-title');
  const creators = childrenNamed(child(root, 'identification'), 'creator');
  const artist = (creators.find((c) => c.attrs['type'] === 'composer') ?? creators.find((c) => c.attrs['type'] === 'artist') ?? creators[0])?.text.trim() || null;
  const names = new Map<string, string>();
  for (const sp of childrenNamed(child(root, 'part-list'), 'score-part')) {
    names.set(sp.attrs['id'] ?? '', textAt(sp, 'part-name') ?? textAt(sp, 'score-instrument', 'instrument-name') ?? '');
  }
  const parts = childrenNamed(root, 'part').map((p, k) => {
    const id = p.attrs['id'] ?? `P${k + 1}`;
    return readPart(p, id, names.get(id) || `Part ${k + 1}`);
  });
  if (!parts.length) throw new ImportAbort('no_notes', 'This MusicXML file has no parts.');
  return { title, artist, parts };
}

function describeParts(score: ParsedScore): MusicXmlPartInfo[] {
  return score.parts.map((p, index) => {
    const notes = p.measures.flatMap((m) => m.notes);
    const keys = notes.map((n) => n.midi);
    let offset = 0;
    const timed = p.measures.flatMap((m) => {
      const out = m.notes.map((n) => ({ startTick: offset + n.pos, durationTicks: n.dur }));
      offset += m.len;
      return out;
    });
    const hasTab = notes.some((n) => n.string !== null && n.fret !== null);
    const inRange = keys.filter((k) => k >= 40 && k <= 88).length;
    return {
      index,
      id: p.id,
      name: p.name,
      noteCount: notes.length,
      lowMidi: keys.length ? Math.min(...keys) : null,
      highMidi: keys.length ? Math.max(...keys) : null,
      maxPolyphony: maxPolyphony(timed),
      hasTab,
      guitarLikely: hasTab || /guitar|gtr|gitarre|guitare|chitarra/i.test(p.name) || (keys.length > 0 && inRange / keys.length >= 0.9 && !/bass|drum|perc|voice|vocal/i.test(p.name)),
    };
  });
}

function defaultParts(parts: MusicXmlPartInfo[]): number[] {
  const withNotes = parts.filter((p) => p.noteCount > 0);
  const pick = withNotes.find((p) => p.hasTab) ?? withNotes.find((p) => /guitar|gtr/i.test(p.name)) ?? withNotes.find((p) => p.guitarLikely) ?? withNotes[0];
  return pick ? [pick.index] : [];
}

/** List the parts of a MusicXML score. Never throws. */
export function inspectMusicXml(input: string | Uint8Array | ArrayBuffer): MusicXmlInspectOutcome {
  return guard(() => {
    const score = parseScore(input);
    const parts = describeParts(score);
    return { ok: true as const, inspection: { title: score.title, parts, defaultSelection: defaultParts(parts) } };
  });
}

/**
 * Convert chosen parts (default: the first part with tab, else a guitar part, else the first
 * part with notes) into an ImportedSong. Never throws.
 */
export function musicXmlToSong(input: string | Uint8Array | ArrayBuffer, partIndexes?: readonly number[]): ImportOutcome {
  return guard(() => {
    const score = parseScore(input);
    const infos = describeParts(score);
    const wanted = partIndexes && partIndexes.length ? [...new Set(partIndexes)] : defaultParts(infos);
    if (wanted.some((i) => !Number.isInteger(i) || i < 0 || i >= score.parts.length)) return failure('bad_selection', 'That part is not in this file.');
    if (!wanted.length) return failure('no_notes', 'This MusicXML file has no notes.');
    const warnings: string[] = [];
    const first = score.parts[0]!;
    const measureCount = Math.max(...score.parts.map((p) => p.measures.length));
    const lens = Array.from({ length: measureCount }, (_, k) => Math.max(...score.parts.map((p) => p.measures[k]?.len ?? 0)));
    // Repeat signs and endings can be written in any part; merge them per measure.
    const repeatInfo: RepeatInfo[] = Array.from({ length: measureCount }, (_, k) => {
      const ms = score.parts.map((p) => p.measures[k]).filter((m): m is XMeasure => !!m);
      return {
        repeatStart: ms.some((m) => m.repeatStart),
        repeatEndTimes: Math.max(0, ...ms.map((m) => m.repeatEndTimes ?? 0)),
        endings: ms.find((m) => m.endings?.length)?.endings ?? [],
      };
    });
    const { order, truncated } = expandRepeats(repeatInfo);
    if (truncated) warnings.push('The song was cut short because the repeats made it very long.');
    if (score.parts.some((p) => p.measures.some((m) => m.jumps))) warnings.push('This score has D.C./D.S./coda jumps, which were not followed; parts of the song may be missing.');
    const firstSelected = score.parts[wanted[0]!]!;
    const tuningOpen = firstSelected.tuning && firstSelected.stringCount === 6 ? firstSelected.tuning : [...STANDARD_OPEN_BY_STRING];
    if (firstSelected.stringCount !== 6) warnings.push(`This part is written for a ${firstSelected.stringCount}-string instrument; string and fret numbers were left out.`);
    const capo = firstSelected.capo;

    // Are frets counted from the capo (relative) or from the nut (absolute)? Pick what matches the pitches.
    let relHits = 0;
    let absHits = 0;
    for (const i of wanted) {
      for (const m of score.parts[i]!.measures) {
        for (const n of m.notes) {
          if (n.string === null || n.fret === null || n.string > 6) continue;
          const open = tuningOpen[n.string - 1]!;
          if (mod12(open + capo + n.fret - n.midi) === 0) relHits++;
          if (mod12(open + n.fret - n.midi) === 0) absHits++;
        }
      }
    }
    const fretsAbsolute = capo > 0 && absHits > relHits;

    const notes: ImportedNote[] = [];
    const chords: ImportedChord[] = [];
    const sections: { startTick: number; name: string }[] = [];
    const tempos: { tick: number; bpm: number }[] = [];
    const meters: { tick: number; meter: [number, number] }[] = [];
    let octaveFixes = 0;
    let fingeringDropped = 0;
    let tick = 0;
    const openTies = new Map<string, ImportedNote>();
    const lastOnString = new Map<string, ImportedNote>();
    const harmonySeen = new Set<string>();
    const sectionSeen = new Set<number>();
    for (const mi of order) {
      for (const p of score.parts) {
        const m = p.measures[mi];
        if (!m) continue;
        if (p === first && m.meter) meters.push({ tick, meter: m.meter });
        // Tempo and rehearsal marks may sit in any part; keep one of each per position.
        for (const t of m.tempos) {
          const tt = Math.round(tick + t.pos);
          if (!tempos.some((x) => x.tick === tt)) tempos.push({ tick: tt, bpm: t.bpm });
        }
        if (!sectionSeen.has(mi)) {
          for (const s of m.sections) {
            const st = Math.round(tick + s.pos);
            if (!sections.some((x) => x.startTick === st && x.name === s.name)) sections.push({ startTick: st, name: s.name });
          }
        }
        for (const h of m.harmonies) {
          const key = `${Math.round(tick + h.pos)}|${h.name}`;
          if (harmonySeen.has(key)) continue;
          harmonySeen.add(key);
          const c: ImportedChord = { startTick: Math.round(tick + h.pos), durationTicks: 0, name: h.name };
          if (h.frets) c.fretsByString = h.frets;
          chords.push(c);
        }
      }
      sectionSeen.add(mi);
      for (const i of wanted) {
        const m = score.parts[i]!.measures[mi];
        if (!m) continue;
        for (const n of [...m.notes].sort((a, b) => a.pos - b.pos)) {
          const start = Math.round(tick + n.pos);
          const dur = Math.max(1, Math.round(n.dur));
          let midi = n.midi;
          let string: number | null = n.string !== null && n.string <= 6 && firstSelected.stringCount === 6 ? n.string : null;
          let fret = n.fret;
          if (string !== null && fret !== null) {
            if (fretsAbsolute) fret -= capo;
            const expected = tuningOpen[string - 1]! + capo + fret;
            if (fret < 0) {
              string = null;
              fret = null;
              fingeringDropped++;
            } else if (expected !== midi && !n.techniques.some((t) => t.kind === 'harmonic' || t.kind === 'dead_note')) {
              if ((expected - midi) % 12 === 0) {
                midi = expected;
                octaveFixes++;
              } else {
                string = null;
                fret = null;
                fingeringDropped++;
              }
            }
          }
          const tieKey = `${i}|${n.voice}|${midi}`;
          const open = openTies.get(tieKey);
          if (n.tieStop && open && Math.abs(open.startTick + open.durationTicks - start) <= 2) {
            open.durationTicks = start + dur - open.startTick;
            if (!n.tieStart) openTies.delete(tieKey);
            continue;
          }
          const note: ImportedNote = { startTick: start, durationTicks: dur, midi };
          if (string !== null && fret !== null) {
            note.string = string as ImportStringNumber;
            note.fret = fret;
          }
          if (n.velocity) note.velocity = n.velocity;
          const techniques = n.techniques.map((t) => ({ ...t }));
          const lineKey = `${i}|${string ?? n.voice}`;
          if (n.slideStop) {
            const prev = lastOnString.get(lineKey);
            if (prev && prev.midi !== midi) techniques.push({ kind: midi > prev.midi ? 'slide_up' : 'slide_down' });
            else techniques.push({ kind: 'slide_into' });
          }
          if (techniques.length) note.techniques = techniques;
          notes.push(note);
          lastOnString.set(lineKey, note);
          if (n.tieStart) openTies.set(tieKey, note);
        }
      }
      tick += lens[mi] ?? 0;
    }
    if (!notes.length) return failure('no_notes', 'The chosen part has no notes.');
    tempos.sort((a, b) => a.tick - b.tick);
    const meter = meters[0]?.meter ?? [4, 4];
    const bpm = tempos[0]?.bpm ?? 120;
    if (!tempos.length) warnings.push('No tempo was given, so 120 BPM is used. Change it to match the song.');
    const tempoChanges = tempos.filter((t, k) => k > 0 && Math.abs(t.bpm - tempos[k - 1]!.bpm) >= 0.5);
    if (tempoChanges.length) {
      warnings.push(`The tempo changes during the song (${listText(tempoChanges.map((t) => `${Math.round(t.bpm)} BPM at ${barLabel(t.tick, meter[0], meter[1])}`), 3)}). The app plays the whole song at ${Math.round(bpm)} BPM.`);
    }
    if (meters.some((x, k) => k > 0 && (x.meter[0] !== meters[k - 1]!.meter[0] || x.meter[1] !== meters[k - 1]!.meter[1]))) {
      warnings.push(`The time signature changes during the song; ${meter[0]}/${meter[1]} is used for bar numbers, so some bar lines may be off.`);
    }
    const grace = wanted.reduce((a, i) => a + score.parts[i]!.graceSkipped, 0);
    if (grace) warnings.push(`${grace} grace note${grace === 1 ? ' was' : 's were'} left out.`);
    if (octaveFixes) warnings.push(`${octaveFixes} note${octaveFixes === 1 ? '' : 's'} were written an octave away from their tab position; the tab position was used.`);
    if (fingeringDropped) warnings.push(`${fingeringDropped} tab position${fingeringDropped === 1 ? '' : 's'} didn't match the written note and ${fingeringDropped === 1 ? 'was' : 'were'} left out.`);
    if (wanted.length > 1) warnings.push(`You picked ${wanted.length} parts; their notes are combined into one.`);
    const poly = maxPolyphony(notes);
    if (poly > 6) warnings.push(`Up to ${poly} notes sound at once in places, but a guitar can play at most 6.`);
    const tuning = describeTuning(tuningOpen);
    warnings.push(...rangeWarnings(notes, tuning, capo));
    return finalizeSong({
      source: 'musicxml',
      title: score.title,
      artist: score.artist,
      bpm,
      beatsPerBar: meter[0],
      beatUnit: meter[1],
      notes,
      chords,
      sections,
      tuning,
      capo,
      warnings,
      minDurationTicks: tick,
    });
  });
}
