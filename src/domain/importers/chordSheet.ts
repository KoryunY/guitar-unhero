/**
 * Chord-sheet importer: "chords over lyrics", bar notation (`| Em . G . | D |`) and
 * ChordPro (`[Em]words`, `{title: …}`, `{start_of_chorus}`).
 *
 * Only chords, sections, title/artist, capo, tempo and meter are kept. Lyrics are dropped
 * (rights reasons) and never appear in the output or in warnings.
 *
 * Timing heuristic (chord sheets carry no rhythm):
 * - Bar notation: each `|…|` is one bar; the chords and beat marks (`.` `/` `-`) inside a bar
 *   share it equally, and a chord lasts until the next chord. `%` repeats the previous bar.
 * - A chord line with beat slashes (`G / / / C / / /`): every token is one beat.
 * - A chord line over a lyric line (or a ChordPro line): the line gets one bar per chord,
 *   and the chords are spread over those bars by their column position, rounded to beats.
 * - A chord-only line: one bar per chord.
 * - `x2`, `(x3)`, `2x` on a chord/bar line repeats that line; `|: … :|` repeats inside a line.
 */
import { parseChordName, type ParsedChord } from '../chords';
import {
  checkTextInput, DEFAULT_BPM, expandRepeats, failure, finalizeSong, guard, IMPORT_PPQ, isValidMeter, listText, MAX_CHORDS, standardTuning,
  ticksPerBar, type RepeatInfo,
} from './common';
import type { ImportedChord, ImportOutcome } from './types';

export interface ChordSheetOptions {
  /** Override the meter (default: from the sheet, else 4/4). */
  beatsPerBar?: number;
  beatUnit?: number;
  /** Override the tempo (default: from the sheet, else 90 BPM). */
  bpm?: number;
}

const SECTION_KEYWORDS =
  '(?:intro|verse|pre[- ]?chorus|post[- ]?chorus|chorus|refrain|bridge|middle ?8|outro|solo|guitar solo|interlude|instrumental|coda|hook|break|breakdown|riff|tag|ending|link|turnaround|vamp)';
/** A whole line (or label) that names a section: "Chorus", "Verse 2", "Intro x2", "Pre-Chorus (x2)". */
const SECTION_LINE = new RegExp(`^${SECTION_KEYWORDS}(?:\\s*\\d{1,2})?(?:\\s*\\(?\\s*(?:x\\s?\\d{1,2}|\\d{1,2}\\s?x)\\s*\\)?)?$`, 'i');
const REPEAT_IN_TEXT = /\(?\s*(x\s?\d{1,2}|\d{1,2}\s?x)\s*\)?/gi;

const REPEAT_TOKEN = /^\(?(?:[x×]\s?(\d{1,2})|(\d{1,2})\s?[x×])\)?$/i;
const NO_CHORD = /^\(?n\.?\s?c\.?\)?$/i;
const BEAT_MARK = /^[./\-–]$/;
const SYMBOL = /^(\|+:?|:?\|+|%|\*|\.\.\.|→|->)$/;

export type Token = { text: string; col: number };

export function tokenize(line: string): Token[] {
  const out: Token[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) out.push({ text: m[0], col: m.index });
  return out;
}

export function expandTabs(line: string): string {
  if (!line.includes('\t')) return line;
  let out = '';
  for (const ch of line) out += ch === '\t' ? ' '.repeat(8 - (out.length % 8)) : ch;
  return out;
}

export function repeatCount(text: string): number | null {
  const m = REPEAT_TOKEN.exec(text.trim());
  if (!m) return null;
  const n = Number(m[1] ?? m[2]);
  return n >= 1 && n <= 16 ? n : null;
}

type TokenKind = 'chord' | 'nc' | 'beat' | 'repeat' | 'symbol' | 'word';

function classify(text: string): TokenKind {
  if (NO_CHORD.test(text)) return 'nc';
  if (BEAT_MARK.test(text)) return 'beat';
  if (repeatCount(text) !== null) return 'repeat';
  if (SYMBOL.test(text)) return 'symbol';
  return parseChordName(text) ? 'chord' : 'word';
}

/** `{key: value}` / `{key}` on its own line (ChordPro directive), parsed without regex backtracking. */
export function parseDirective(line: string): { key: string; value: string } | null {
  const t = line.trim();
  if (t.length < 3 || t.length > 400 || !t.startsWith('{') || !t.endsWith('}')) return null;
  const inner = t.slice(1, -1);
  const colon = inner.indexOf(':');
  const key = (colon < 0 ? inner : inner.slice(0, colon)).trim().toLowerCase();
  if (!/^[a-z_]{1,32}$/.test(key)) return null;
  return { key, value: colon < 0 ? '' : inner.slice(colon + 1).trim() };
}

/** Section-heading test, only on short text so the pattern stays cheap. */
function isSectionText(text: string): boolean {
  return text.length <= 80 && SECTION_LINE.test(text);
}

/** True when a line is made (mostly) of chord symbols. */
export function isChordLine(line: string): boolean {
  // "Tuning: Eb Ab Db Gb Bb Eb" / "Capo: 2" / "Key: Bb" are settings, not chords.
  if (/^\s*(tuning|capo|key|tempo|bpm)\b/i.test(line)) return false;
  const tokens = tokenize(line);
  if (!tokens.length) return false;
  let chordish = 0;
  let chords = 0;
  for (const t of tokens) {
    const k = classify(t.text);
    if (k === 'chord') chords++;
    if (k !== 'word') chordish++;
  }
  return chords >= 1 && chordish / tokens.length >= 0.6;
}

const CHORDPRO_KEYS = /^(t|title|st|subtitle|artist|soc|sov|sob|eoc|eov|eob|c|comment|key|capo|tempo|time|start_of_\w+|end_of_\w+)$/;

/** True when the text uses ChordPro directives or inline [Chord]lyric markup. */
export function looksLikeChordPro(text: string): boolean {
  let inline = 0;
  for (const line of text.split('\n')) {
    const d = parseDirective(line);
    if (d && CHORDPRO_KEYS.test(d.key)) return true;
    const m = /\[([^\]\s]{1,12})\][^\s[]/.exec(line);
    if (m && parseChordName(m[1]!)) inline++;
    if (inline >= 2) return true;
  }
  return false;
}

export interface SheetMeta {
  title: string | null;
  artist: string | null;
  capo: number;
  bpm: number | null;
  meter: [number, number] | null;
}

export function readSheetMeta(lines: string[]): SheetMeta {
  const meta: SheetMeta = { title: null, artist: null, capo: 0, bpm: null, meter: null };
  let subtitle: string | null = null;
  for (const raw of lines) {
    if (raw.length > 400) continue;
    const line = raw.trim();
    const d = parseDirective(line);
    const key = d ? d.key : null;
    const val = d ? d.value : '';
    if (key === 'title' || key === 't') meta.title ??= val || null;
    else if (key === 'artist' || key === 'composer') meta.artist ??= val || null;
    else if (key === 'subtitle' || key === 'st') subtitle ??= val || null;
    else if (key === 'capo') meta.capo = Number(/\d+/.exec(val)?.[0] ?? 0);
    else if (key === 'tempo') meta.bpm ??= Number(/\d+(\.\d+)?/.exec(val)?.[0] ?? NaN) || null;
    else if (key === 'time') meta.meter ??= parseMeter(val);
    if (d) continue;
    let m: RegExpExecArray | null;
    if ((m = /^title\s*[:=]\s*(.+)$/i.exec(line))) meta.title ??= m[1]!.trim();
    else if ((m = /^(?:artist|band|by|composer)\s*[:=]\s*(.+)$/i.exec(line))) meta.artist ??= m[1]!.trim();
    else if ((m = /^capo\b[\s:=-]*(?:on\s+)?(?:the\s+)?(?:fret\s+)?(\d{1,2})(?:st|nd|rd|th)?\b/i.exec(line))) meta.capo = Number(m[1]);
    else if (/^no\s+capo\b/i.test(line)) meta.capo = 0;
    else if ((m = /^(?:tempo|bpm)[\s:=]*(\d{2,3}(?:\.\d+)?)\b/i.exec(line)) || (m = /^(\d{2,3})\s*bpm\b/i.exec(line))) meta.bpm ??= Number(m[1]);
    else if ((m = /^(?:time|time signature|meter)[\s:=]*(\d{1,2}\s?\/\s?\d{1,2})$/i.exec(line))) meta.meter ??= parseMeter(m[1]!);
  }
  meta.artist ??= subtitle;
  if (!(meta.capo >= 0 && meta.capo <= 12)) meta.capo = 0;
  return meta;
}

function parseMeter(text: string): [number, number] | null {
  const m = /^(\d{1,2})\s*\/\s*(\d{1,2})$/.exec(text.trim());
  if (!m) return null;
  const n = Number(m[1]);
  const d = Number(m[2]);
  return isValidMeter(n, d) ? [n, d] : null;
}

export function isMetaLine(line: string): boolean {
  return /^\s*(title|artist|band|by|composer|capo|no\s+capo|tempo|bpm|time|time signature|meter|key|tuning)\b\s*[:=]?/i.test(line) && !isChordLine(line);
}

function sectionName(text: string): string {
  return text.replace(/[[\]{}:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}

/**
 * The section name when a whole line is a heading — `[Intro]`, `[Verse 1]`, `Chorus`,
 * `Verse 2:`, `Solo x2` — else null. Bracketed chord names are not headings.
 */
export function sectionHeading(line: string): string | null {
  if (line.length > 120) return null;
  const t = line.trim();
  const bracket = /^\[([^\]]{1,60})\]$/.exec(t);
  if (bracket) return parseChordName(bracket[1]!.trim()) ? null : sectionName(bracket[1]!.replace(REPEAT_IN_TEXT, '')) || null;
  const label = /^(.{1,30}?)\s*:$/.exec(t);
  const body = label ? label[1]!.trim() : t;
  if (isSectionText(body) || (label && /^(riff|part|section|lick|fill)\b/i.test(body))) return sectionName(body.replace(REPEAT_IN_TEXT, '')) || null;
  return null;
}

/** One timed chord slot inside a bar or line, in ticks relative to the bar/line start. */
type Slot = { at: number; chord: ParsedChord | null };

interface Bar extends RepeatInfo {
  slots: Slot[];
  section?: string;
}

class Builder {
  bars: Bar[] = [];
  pendingSection: string | null = null;
  unknown = new Set<string>();
  constructor(readonly barTicks: number, readonly beatTicks: number) {}

  section(name: string): void {
    const n = sectionName(name);
    if (n) this.pendingSection = n;
  }

  /** Append bars; the pending section attaches to the first one. */
  push(bars: Bar[]): void {
    if (!bars.length) return;
    if (this.pendingSection) {
      bars[0]!.section = this.pendingSection;
      this.pendingSection = null;
    }
    this.bars.push(...bars);
  }

  chord(text: string): ParsedChord | null {
    const c = parseChordName(text);
    if (!c) this.unknown.add(text.slice(0, 16));
    return c;
  }
}

/** `| Em . G . | D | x2` → bars. */
function barLine(line: string, b: Builder): Bar[] {
  const parts = line.split('|');
  const bars: Bar[] = [];
  let times: number | null = null;
  let pendingStart = false;
  parts.forEach((rawPart, idx) => {
    let part = rawPart;
    const startsRepeat = part.startsWith(':');
    const endsRepeat = part.endsWith(':') && idx < parts.length - 1;
    if (startsRepeat) part = part.slice(1);
    if (endsRepeat) part = part.slice(0, -1);
    const toks = tokenize(part);
    const rep = toks.map((t) => repeatCount(t.text)).find((n) => n !== null);
    if (rep != null) times = rep;
    const music = toks.filter((t) => t.text === '%' || (repeatCount(t.text) === null && !SYMBOL.test(t.text)));
    if (startsRepeat) pendingStart = true;
    if (!music.length) {
      if (endsRepeat && bars.length) bars[bars.length - 1]!.repeatEndTimes = 2;
      return;
    }
    if (music.length === 1 && music[0]!.text === '%') {
      const prev = bars[bars.length - 1] ?? b.bars[b.bars.length - 1];
      bars.push({ slots: prev ? prev.slots.map((s) => ({ ...s })) : [] });
    } else {
      const n = music.length;
      const slots: Slot[] = [];
      music.forEach((t, i) => {
        const at = Math.round((i * b.barTicks) / n);
        const kind = classify(t.text);
        if (kind === 'chord') slots.push({ at, chord: b.chord(t.text) });
        else if (kind === 'nc') slots.push({ at, chord: null });
        else if (kind === 'word') {
          b.chord(t.text);
          slots.push({ at, chord: null });
        }
      });
      bars.push({ slots });
    }
    const bar = bars[bars.length - 1]!;
    if (pendingStart) {
      bar.repeatStart = true;
      pendingStart = false;
    }
    if (endsRepeat) bar.repeatEndTimes = 2;
  });
  if (times !== null) {
    const ends = bars.filter((x) => (x.repeatEndTimes ?? 0) > 1);
    if (ends.length) ends[ends.length - 1]!.repeatEndTimes = times;
    else if (bars.length && times > 1) return repeatBars(bars, times);
  }
  return bars;
}

function repeatBars(bars: Bar[], times: number): Bar[] {
  const out: Bar[] = [];
  for (let i = 0; i < times; i++) out.push(...bars.map((x) => ({ slots: x.slots.map((s) => ({ ...s })) })));
  return out;
}

/** Chord line → bars. `widthCols` (lyric width) enables spreading by column. */
function chordLine(tokens: Token[], b: Builder, widthCols: number | null): Bar[] {
  let times = 1;
  const items: { col: number; chord: ParsedChord | null; kind: TokenKind }[] = [];
  for (const t of tokens) {
    const kind = classify(t.text);
    if (kind === 'repeat') times = repeatCount(t.text) ?? 1;
    else if (kind === 'chord') items.push({ col: t.col, chord: b.chord(t.text), kind });
    else if (kind === 'nc' || kind === 'beat') items.push({ col: t.col, chord: null, kind });
    else if (t.text === '%') items.push({ col: t.col, chord: null, kind: 'symbol' });
    else if (/^[A-H][^\s]{0,8}$/.test(t.text)) b.chord(t.text); // chord-like but unreadable: reported, skipped
  }
  if (!items.length) return [];
  let bars: Bar[];
  if (items.some((i) => i.kind === 'beat')) {
    // Beat notation: every token is one beat.
    const beatsPerBar = Math.round(b.barTicks / b.beatTicks);
    bars = [];
    items.forEach((it, i) => {
      const barIdx = Math.floor(i / beatsPerBar);
      while (bars.length <= barIdx) bars.push({ slots: [] });
      if (it.kind !== 'beat') bars[barIdx]!.slots.push({ at: (i % beatsPerBar) * b.beatTicks, chord: it.chord });
    });
  } else {
    const k = items.length;
    const total = k * b.barTicks;
    const c0 = items[0]!.col;
    const last = items[k - 1]!.col;
    const span = Math.max(1, widthCols === null ? 0 : widthCols - c0, last - c0 + 1);
    const beats = Math.round(total / b.beatTicks);
    const at: number[] = [];
    items.forEach((it, i) => {
      let beat = widthCols === null ? i * Math.round(b.barTicks / b.beatTicks) : Math.round(((it.col - c0) / span) * beats);
      const min = i === 0 ? 0 : at[i - 1]! + 1;
      const max = beats - (k - i);
      beat = i === 0 ? 0 : Math.max(min, Math.min(max, beat));
      at.push(beat);
    });
    bars = Array.from({ length: k }, () => ({ slots: [] as Slot[] }));
    items.forEach((it, i) => {
      const tick = at[i]! * b.beatTicks;
      const barIdx = Math.min(k - 1, Math.floor(tick / b.barTicks));
      if (it.kind === 'symbol') {
        const prev = items.slice(0, i).reverse().find((p) => p.chord)?.chord ?? null;
        bars[barIdx]!.slots.push({ at: tick - barIdx * b.barTicks, chord: prev });
      } else {
        bars[barIdx]!.slots.push({ at: tick - barIdx * b.barTicks, chord: it.chord });
      }
    });
  }
  return times > 1 ? repeatBars(bars, times) : bars;
}

/** ChordPro inline line: "[G]some words [C]more" → chord tokens at lyric columns. */
function inlineLine(line: string, b: Builder): Bar[] | null {
  const tokens: Token[] = [];
  let lyric = '';
  let found = false;
  const re = /\[([^\]]*)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    lyric += line.slice(last, m.index);
    last = m.index + m[0].length;
    const inner = m[1]!.trim();
    if (!inner) continue;
    // Anything else in brackets (e.g. [*Riff]) is an annotation and is ignored.
    if (classify(inner) === 'chord' || classify(inner) === 'nc') {
      found = true;
      tokens.push({ text: inner, col: lyric.length });
    }
  }
  lyric += line.slice(last);
  if (!found) return null;
  const hasWords = /\S/.test(lyric);
  return chordLine(tokens, b, hasWords ? lyric.trimEnd().length : null);
}

function isTabLine(line: string): boolean {
  return line.length <= 4000 && /^[A-Ga-g]?[#b]?\s?[|:]?[-0-9|hpbr/\\~x()<>.]{6,}/.test(line.trimStart()) && (line.match(/-/g)?.length ?? 0) >= 6;
}

/**
 * Import a chord sheet (chords over lyrics, bar notation or ChordPro). Never throws.
 */
export function chordSheetToSong(text: string, options: ChordSheetOptions = {}): ImportOutcome {
  return guard(() => {
    const src = checkTextInput(text).replace(/\[\/?(ch|tab)\]/gi, '');
    const lines = src.split('\n').map(expandTabs);
    const meta = readSheetMeta(lines);
    const meter: [number, number] = options.beatsPerBar && options.beatUnit && isValidMeter(options.beatsPerBar, options.beatUnit)
      ? [options.beatsPerBar, options.beatUnit]
      : meta.meter ?? [4, 4];
    const barTicks = ticksPerBar(meter[0], meter[1]);
    const beatTicks = Math.round((IMPORT_PPQ * 4) / meter[1]);
    const b = new Builder(barTicks, beatTicks);
    const chordPro = looksLikeChordPro(src);
    let lyricLines = 0;
    let tabLines = 0;
    let skippedTabBlock = false;
    let sectionRepeats = 0;
    let inTab = false;

    const lineKind = (line: string): 'blank' | 'directive' | 'lyric' | 'other' => {
      const t = line.trim();
      if (!t) return 'blank';
      if (t.startsWith('{') && t.endsWith('}')) return 'directive';
      if ((t.startsWith('[') && t.endsWith(']')) || isChordLine(line) || isMetaLine(line) || isTabLine(line)) return 'other';
      if (/\[[^\]]+\]/.test(line) && chordPro) return 'other';
      if (isSectionText(t)) return 'other';
      return 'lyric';
    };

    const handleMusic = (line: string, next: string | undefined): boolean => {
      if (line.includes('|') && isChordLine(line.replace(/:?\|+:?/g, ' '))) {
        b.push(barLine(line, b));
        return true;
      }
      if (chordPro || /\[[^\]]+\][^\s]/.test(line)) {
        const bars = inlineLine(line, b);
        if (bars) {
          b.push(bars);
          return true;
        }
      }
      if (isChordLine(line)) {
        const width = next !== undefined && lineKind(next) === 'lyric' ? Math.max(next.trimEnd().length, line.trimEnd().length) : null;
        b.push(chordLine(tokenize(line), b, width));
        return true;
      }
      return false;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const trimmed = line.trim();
      if (!trimmed) continue;
      const directive = parseDirective(trimmed);
      if (directive) {
        const key = directive.key;
        const val = directive.value;
        if (key === 'start_of_tab' || key === 'sot') {
          inTab = true;
          skippedTabBlock = true;
        } else if (key === 'end_of_tab' || key === 'eot') inTab = false;
        else if (key.startsWith('start_of_') || key === 'soc' || key === 'sov' || key === 'sob') {
          const kind = key === 'soc' ? 'Chorus' : key === 'sov' ? 'Verse' : key === 'sob' ? 'Bridge' : key.slice(9).replace(/_/g, ' ');
          b.section(val || kind.charAt(0).toUpperCase() + kind.slice(1));
        } else if ((key === 'c' || key === 'comment' || key === 'ci' || key === 'cb') && isSectionText(val)) b.section(val.replace(REPEAT_IN_TEXT, ''));
        else if (key === 'chorus') b.section(val || 'Chorus');
        continue;
      }
      if (inTab) continue;
      if (chordPro && trimmed.startsWith('#')) continue;
      if (isMetaLine(line)) continue;
      const bracketOnly = trimmed.length <= 80 ? /^\[([^\]]+)\]$/.exec(trimmed) : null;
      if (bracketOnly) {
        const inner = bracketOnly[1]!.trim();
        if (chordPro && parseChordName(inner)) {
          b.push(chordLine([{ text: inner, col: 0 }], b, null));
        } else {
          if (/\bx\s?\d|\d\s?x\b/i.test(inner)) sectionRepeats++;
          b.section(inner.replace(REPEAT_IN_TEXT, ''));
        }
        continue;
      }
      const labelled = /^([A-Za-z][A-Za-z0-9 '-]{0,24}?)\s*:\s*(.*)$/.exec(trimmed);
      if (labelled && isSectionText(labelled[1]!.trim())) {
        if (/\bx\s?\d|\d\s?x\b/i.test(labelled[1]!)) sectionRepeats++;
        b.section(labelled[1]!.replace(REPEAT_IN_TEXT, ''));
        const restText = labelled[2]!;
        if (restText.trim()) handleMusic(restText, lines[i + 1]);
        continue;
      }
      if (isSectionText(trimmed)) {
        if (/\bx\s?\d|\d\s?x\b/i.test(trimmed)) sectionRepeats++;
        b.section(trimmed.replace(REPEAT_IN_TEXT, ''));
        continue;
      }
      if (isTabLine(line)) {
        tabLines++;
        continue;
      }
      if (handleMusic(line, lines[i + 1])) continue;
      lyricLines++;
    }

    const { order, truncated } = expandRepeats(b.bars);
    const chords: ImportedChord[] = [];
    const sections: { startTick: number; name: string }[] = [];
    const seenSectionBars = new Set<number>();
    // A section label is placed once, at the first time its bar is played.
    let current: { chord: ParsedChord | null; start: number } | null = null;
    const flush = (endTick: number) => {
      if (current?.chord && endTick > current.start) chords.push({ startTick: current.start, durationTicks: endTick - current.start, name: current.chord.display });
    };
    order.forEach((barIdx, k) => {
      const bar = b.bars[barIdx]!;
      const start = k * barTicks;
      if (bar.section && !seenSectionBars.has(barIdx)) {
        seenSectionBars.add(barIdx);
        sections.push({ startTick: start, name: bar.section });
      }
      for (const s of [...bar.slots].sort((x, y) => x.at - y.at)) {
        flush(start + s.at);
        current = { chord: s.chord, start: start + s.at };
      }
    });
    const end = order.length * barTicks;
    flush(end);
    // Merge back-to-back repeats of the same chord into one longer chord.
    const merged: ImportedChord[] = [];
    for (const c of chords) {
      const prev = merged[merged.length - 1];
      if (prev && prev.name === c.name && prev.startTick + prev.durationTicks === c.startTick && c.startTick % barTicks !== 0) prev.durationTicks += c.durationTicks;
      else merged.push({ ...c });
    }
    if (!merged.length) {
      return failure('no_chords', 'No chords were found. Chord names should be on their own line above the words, in [brackets] (ChordPro), or between bar lines like | G | C |.');
    }
    if (merged.length > MAX_CHORDS) return failure('too_complex', 'This chord sheet is too long to import.');
    const warnings: string[] = [
      'Chord sheets don\'t store rhythm. Each chord was given about one bar, spread by where it sits over the words — adjust the timing while you listen.',
    ];
    if (lyricLines) warnings.push('Only the chords were imported; the words were left out.');
    if (b.unknown.size) warnings.push(`Some chord names couldn't be read and were skipped: ${listText([...b.unknown])}.`);
    if (meta.capo > 0) warnings.push(`The chord names are the shapes you play with the capo on fret ${meta.capo}; they sound ${meta.capo} semitone${meta.capo === 1 ? '' : 's'} higher.`);
    if (tabLines || skippedTabBlock) warnings.push('Some tab lines were skipped. Import them as tab to get those notes.');
    if (sectionRepeats) warnings.push('Instructions like "Chorus x2" were not expanded; the chords are listed once, as written.');
    if (truncated) warnings.push('The song was cut short because the repeats made it very long.');
    const bpm = options.bpm ?? meta.bpm ?? DEFAULT_BPM;
    if (!options.bpm && !meta.bpm) warnings.push(`No tempo was given, so ${DEFAULT_BPM} BPM is used. Change it to match the song.`);
    return finalizeSong({
      source: 'chord_sheet',
      title: meta.title,
      artist: meta.artist,
      bpm,
      beatsPerBar: meter[0],
      beatUnit: meter[1],
      notes: [],
      chords: merged,
      sections,
      tuning: standardTuning(),
      capo: meta.capo,
      warnings,
      minDurationTicks: end,
    });
  });
}
