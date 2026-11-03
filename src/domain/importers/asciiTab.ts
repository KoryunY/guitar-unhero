/**
 * ASCII guitar tab importer (six-line staves pasted from the web).
 *
 * Reads: string names (`e|`, `E|`, `B|`, `D|` …, upper or lower case, or none), tuning from
 * the names (e.g. drop D) or a "Tuning:" line, multi-digit frets, bar lines, several staves
 * stacked through a long text (lyrics/junk between them ignored), `[Intro]`-style headings,
 * chord names written above a staff, techniques `h p / \ s b r ~ x t PM ( )` and `<12>`
 * harmonics, `|: … :|` repeats and `x2` repeat marks (expanded).
 *
 * Rhythm heuristic — ASCII tab has no real rhythm, so timing is approximate:
 * 1. Notes whose characters overlap in a column (across strings) form one onset (a chord).
 * 2. Each bar (between bar lines) is one bar of the meter (default 4/4). Onsets are placed
 *    in proportion to their column within the bar. A short run of leading dashes (no longer
 *    than the usual gap between notes) is treated as padding, so the first note lands on
 *    beat 1; a longer one is a rest. When a bar has three or more onsets, its width is
 *    rounded to a whole number of typical gaps (the median column distance between notes in
 *    the staff), which absorbs uneven padding at the end of a bar.
 * 3. Positions are rounded to 16ths (falling back to 32nds, then finer, if two onsets would
 *    collide), so gaps between note columns become durations normalised per bar.
 * 4. A staff without inner bar lines is timed by its median gap between notes = one 8th.
 * 5. Each note lasts until the next onset (the last one until the end of its bar).
 */
import {
  checkTextInput, DEFAULT_BPM, describeTuning, expandRepeats, finalizeSong, guard, IMPORT_PPQ, ImportAbort, isValidMeter, naturalHarmonicOffset,
  noteNamePc, rangeWarnings, STANDARD_OPEN_BY_STRING, ticksPerBar, type RepeatInfo,
} from './common';
import { expandTabs, isChordLine, readSheetMeta, repeatCount, sectionHeading, tokenize } from './chordSheet';
import { parseChordName } from '../chords';
import type { ImportedChord, ImportedNote, ImportOutcome, ImportStringNumber, Technique } from './types';

export interface TabOptions {
  bpm?: number;
  beatsPerBar?: number;
  beatUnit?: number;
}

/** Longer lines are never read as tab (keeps every per-line pattern cheap). */
const MAX_TAB_LINE = 4000;
const BODY_CHARS = /^[-–—0-9|:hHpPbrRsSxX~/\\()<>[\].*=^tTvgo!+ ]*$/;
const TRAILING_REPEAT = /\s+(\(?\s*(?:x\s?\d{1,2}|\d{1,2}\s?x)\s*\)?|repeat\s*\d{1,2}\s*(?:x|times)?)\s*$/i;

interface StringLine {
  /** Index of the text line. */
  lineNo: number;
  name: string | null;
  /** Column of the first body character in the original line. */
  offset: number;
  body: string;
  trailing: string;
}

/** Parse one line as a tab string line, or null. */
export function parseStringLine(raw: string, lineNo = 0): StringLine | null {
  if (raw.length > MAX_TAB_LINE) return null;
  const line = expandTabs(raw).trimEnd();
  // Prefix: [spaces] [string name] [spaces] ( '|' | ':' | a dash ). Parsed by hand (no backtracking).
  const isSpace = (ch: string | undefined) => ch !== undefined && /\s/.test(ch);
  let i = 0;
  while (isSpace(line[i])) i++;
  let name: string | null = null;
  const nm = /^[A-Ga-g][#b♯♭]?/.exec(line.slice(i, i + 2));
  if (nm) {
    const after = line[i + nm[0].length];
    // "Bb|" is B flat; "b|" or "B|" alone is the B string.
    name = nm[0];
    i += nm[0].length;
    if (after === undefined) return null;
  }
  while (isSpace(line[i])) i++;
  const c = line[i];
  let offset: number;
  if (c === '|' || c === ':') offset = i + 1;
  else if (c === '-' || c === '–' || c === '—') offset = i;
  else return null;
  let body = line.slice(offset);
  let trailing = '';
  const tail = body.slice(-32);
  const rep = TRAILING_REPEAT.exec(tail);
  if (rep) {
    trailing = rep[1]!;
    body = body.slice(0, body.length - tail.length + rep.index);
  }
  const lastBar = body.lastIndexOf('|');
  if (lastBar >= 0) {
    const after = body.slice(lastBar + 1);
    if (/\S/.test(after) && !/[-–—]/.test(after)) {
      trailing = `${after.trim()} ${trailing}`.trim();
      body = body.slice(0, lastBar + 1);
    }
  }
  body = body.replace(/[–—]/g, '-');
  if (body.length < 4 || !BODY_CHARS.test(body)) return null;
  const dashes = body.match(/-/g)?.length ?? 0;
  const nonSpace = body.replace(/\s/g, '').length;
  if (dashes < 3 || dashes / Math.max(1, nonSpace) < 0.4 || !body.includes('--')) return null;
  return { lineNo, name, offset, body, trailing };
}

interface TabNote {
  line: number;
  col: number;
  end: number;
  fret: number | null;
  techniques: Technique[];
  harmonic: boolean;
  ghost: boolean;
}

function isDigit(c: string | undefined): boolean {
  return c !== undefined && c >= '0' && c <= '9';
}

function readNumber(s: string, i: number): { value: number; len: number } | null {
  if (!isDigit(s[i])) return null;
  if (isDigit(s[i + 1])) {
    const v = Number(s.slice(i, i + 2));
    if (v <= 24) return { value: v, len: 2 };
  }
  return { value: Number(s[i]), len: 1 };
}

function addTech(n: TabNote, t: Technique): void {
  if (!n.techniques.some((x) => x.kind === t.kind)) n.techniques.push(t);
}

/** Bend/release/vibrato written right after a note: `7b9r7~`. Returns the next index. */
function readSuffix(s: string, i: number, note: TabNote): number {
  for (;;) {
    const c = s[i];
    if (c === 'b') {
      i++;
      let target: number | null = null;
      const paren = /^\((\d{1,2})\)/.exec(s.slice(i));
      if (paren) {
        target = Number(paren[1]);
        i += paren[0].length;
      } else {
        const n = readNumber(s, i);
        if (n) {
          target = n.value;
          i += n.len;
        }
      }
      const semis = target !== null && note.fret !== null ? target - note.fret : null;
      addTech(note, semis !== null && semis > 0 && semis <= 5 ? { kind: 'bend', semitones: semis } : { kind: 'bend' });
      continue;
    }
    if (c === 'r' || c === 'R') {
      i++;
      const paren = /^\((\d{1,2})\)/.exec(s.slice(i));
      if (paren) i += paren[0].length;
      else {
        const n = readNumber(s, i);
        if (n) i += n.len;
      }
      addTech(note, { kind: 'release' });
      continue;
    }
    if (c === '~') {
      while (s[i] === '~') i++;
      addTech(note, { kind: 'vibrato' });
      continue;
    }
    return i;
  }
}

type Pending = { kind: 'hammer_on' | 'pull_off' | 'tap' | 'slide'; at: number; from: TabNote | null };

/** Notes on one string line (bar lines and repeat dots are skipped here). */
function readLine(body: string, line: number): TabNote[] {
  const notes: TabNote[] = [];
  let pending: Pending | null = null;
  let last: TabNote | null = null;
  const add = (n: TabNote) => {
    if (pending && n.col - pending.at <= 2) {
      if (pending.kind === 'slide') {
        const from = pending.from;
        if (from && from.fret !== null && n.fret !== null && from.fret !== n.fret) addTech(n, { kind: n.fret > from.fret ? 'slide_up' : 'slide_down' });
        else if (!from) addTech(n, { kind: 'slide_into' });
      } else {
        addTech(n, { kind: pending.kind });
      }
    }
    pending = null;
    notes.push(n);
    last = n;
  };
  let i = 0;
  while (i < body.length) {
    const c = body[i]!;
    if (isDigit(c)) {
      const n = readNumber(body, i)!;
      const note: TabNote = { line, col: i, end: i + n.len - 1, fret: n.value, techniques: [], harmonic: false, ghost: false };
      add(note);
      i = readSuffix(body, i + n.len, note);
      continue;
    }
    const rest = body.slice(i);
    const ghost = /^\((\d{1,2})\)/.exec(rest);
    if (ghost) {
      const note: TabNote = { line, col: i + 1, end: i + ghost[0].length - 1, fret: Number(ghost[1]), techniques: [], harmonic: false, ghost: true };
      add(note);
      i = readSuffix(body, i + ghost[0].length, note);
      continue;
    }
    const harm = /^[<[](\d{1,2})[>\]]/.exec(rest);
    if (harm) {
      const note: TabNote = { line, col: i + 1, end: i + harm[0].length - 1, fret: Number(harm[1]), techniques: [{ kind: 'harmonic' }], harmonic: true, ghost: false };
      add(note);
      i = readSuffix(body, i + harm[0].length, note);
      continue;
    }
    if (c === 'x' || c === 'X') {
      add({ line, col: i, end: i, fret: null, techniques: [{ kind: 'dead_note' }], harmonic: false, ghost: false });
      i++;
      continue;
    }
    const lastNote = last as TabNote | null;
    if (c === 'h' || c === 'H') pending = { kind: 'hammer_on', at: i, from: lastNote };
    else if (c === 'p' || c === 'P') pending = { kind: 'pull_off', at: i, from: lastNote };
    else if (c === 't' || c === 'T') pending = { kind: 'tap', at: i, from: lastNote };
    else if (c === '/' || c === '\\' || c === 's' || c === 'S') pending = { kind: 'slide', at: i, from: lastNote && lastNote.end >= i - 1 ? lastNote : null };
    else if (c === '~' && lastNote && i - lastNote.end <= 3) addTech(lastNote, { kind: 'vibrato' });
    else if (c === '|') last = null;
    i++;
  }
  return notes;
}

interface Onset {
  col: number;
  notes: TabNote[];
}

function groupOnsets(notes: TabNote[]): Onset[] {
  const sorted = [...notes].sort((a, b) => a.col - b.col || a.line - b.line);
  const out: (Onset & { end: number })[] = [];
  for (const n of sorted) {
    const cur = out[out.length - 1];
    if (cur && n.col <= cur.end && !cur.notes.some((x) => x.line === n.line)) {
      cur.notes.push(n);
      cur.end = Math.max(cur.end, n.end);
    } else {
      out.push({ col: n.col, end: n.end, notes: [n] });
    }
  }
  return out.map(({ col, notes: ns }) => ({ col, notes: ns }));
}

/** Round raw positions to the coarsest grid that keeps them strictly increasing inside the bar. */
function quantize(raw: number[], barTicks: number): number[] {
  for (const grid of [240, 120, 60, 30]) {
    const q = raw.map((t) => Math.round(t / grid) * grid);
    if (q.every((t, i) => t >= 0 && t < barTicks && (i === 0 || t > q[i - 1]!))) return q;
  }
  const out: number[] = [];
  raw.forEach((t, i) => out.push(Math.max(Math.round(t), i ? out[i - 1]! + 1 : 0)));
  return out;
}

function median(xs: number[]): number {
  if (!xs.length) return 2;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

interface TabBar extends RepeatInfo {
  ticks: number;
  events: { tick: number; notes: TabNote[] }[];
  chords: { tick: number; name: string }[];
  section?: string;
}

/** Tuning keywords on a "Tuning:" line, index 0 = string 1. */
function tuningFromText(text: string): number[] | null {
  const t = text.toLowerCase();
  if (/drop\s*d\b/.test(t)) return [64, 59, 55, 50, 45, 38];
  if (/drop\s*c#|drop\s*c♯|drop\s*db/.test(t)) return [63, 58, 54, 49, 44, 37];
  if (/drop\s*c\b/.test(t)) return [62, 57, 53, 48, 43, 36];
  if (/half\s*step\s*down|e\s*flat|\beb\s*standard|\be♭/.test(t)) return [63, 58, 54, 49, 44, 39];
  if (/(whole|full)\s*step\s*down|\bd\s*standard/.test(t)) return [62, 57, 53, 48, 43, 38];
  if (/open\s*g\b/.test(t)) return [62, 59, 55, 50, 43, 38];
  if (/open\s*d\b/.test(t)) return [62, 57, 54, 50, 45, 38];
  if (/open\s*e\b/.test(t)) return [64, 59, 56, 52, 47, 40];
  if (/dadgad/.test(t)) return [62, 57, 55, 50, 45, 38];
  if (/standard|e\s*a\s*d\s*g\s*b\s*e/.test(t)) return [...STANDARD_OPEN_BY_STRING];
  const names = text.replace(/^.*?:/, '').match(/[A-Ga-g][#b♯♭]?/g);
  if (names && names.length === 6) {
    const pcs = names.map((n) => noteNamePc(n));
    if (pcs.every((p) => p !== null)) return resolveNames([...pcs].reverse() as number[]);
  }
  return null;
}

/** Pitch classes for strings 1..6 → MIDI nearest to standard tuning (ties go lower). */
function resolveNames(pcs: number[]): number[] {
  return pcs.map((pc, i) => {
    const std = STANDARD_OPEN_BY_STRING[i]!;
    let best = std;
    let bestD = Infinity;
    for (let m = std - 12; m <= std + 12; m++) {
      if (((m % 12) + 12) % 12 !== pc) continue;
      const d = Math.abs(m - std);
      if (d < bestD || (d === bestD && m < best)) {
        best = m;
        bestD = d;
      }
    }
    return best;
  });
}

/** Tuning from string names written top → bottom. Returns null if they don't make sense. */
function tuningFromNames(names: (string | null)[]): { open: number[]; flipped: boolean } | null {
  if (names.filter(Boolean).length < 5) return null;
  const pcs = names.map((n, i) => (n ? noteNamePc(n) : STANDARD_OPEN_BY_STRING[i]! % 12));
  if (pcs.some((p) => p === null)) return null;
  const asIs = resolveNames(pcs as number[]);
  const flippedPcs = [...(pcs as number[])].reverse();
  const flipped = resolveNames(flippedPcs);
  const dev = (o: number[]) => o.reduce((acc, m, i) => acc + Math.abs(m - STANDARD_OPEN_BY_STRING[i]!), 0);
  const useFlip = dev(flipped) < dev(asIs);
  const open = useFlip ? flipped : asIs;
  for (let i = 1; i < 6; i++) if (open[i]! >= open[i - 1]!) return null;
  return { open, flipped: useFlip };
}

/** Number of six-line tab staves in a text (for format detection). */
export function countTabStaves(text: string): number {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let run = 0;
  let staves = 0;
  for (const l of lines) {
    if (parseStringLine(l)) run++;
    else {
      staves += Math.floor(run / 6);
      run = 0;
    }
  }
  return staves + Math.floor(run / 6);
}

const ANNOTATION = /(P\.?\s?M\.?|let\s*ring|l\.\s?r\.)/gi;

/** Columns (body coordinates) covered by PM / let ring marks on an annotation line. */
function annotationRanges(line: string, offset: number): { kind: 'palm_mute' | 'let_ring'; from: number; to: number }[] {
  const out: { kind: 'palm_mute' | 'let_ring'; from: number; to: number }[] = [];
  if (line.length > MAX_TAB_LINE) return out;
  const text = expandTabs(line);
  if (parseStringLine(text)) return out;
  if (!/^[\s.\-_=|~:*]*$/.test(text.replace(ANNOTATION, ''))) return out;
  ANNOTATION.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ANNOTATION.exec(text))) {
    const from = m.index;
    let to = m.index + m[0].length - 1;
    const run = /^[-._=|~ ]*[-._=|~]/.exec(text.slice(to + 1));
    if (run) to += run[0].length;
    out.push({ kind: /p/i.test(m[0][0]!) ? 'palm_mute' : 'let_ring', from: from - offset, to: to - offset });
  }
  return out;
}

function lineRepeat(line: string | undefined): number | null {
  if (line === undefined || line.length > 60) return null;
  const t = line.trim();
  const m = /^(?:repeat|play)?\s*(\(?\s*(?:x\s?\d{1,2}|\d{1,2}\s?x)\s*\)?)\s*(?:times)?$/i.exec(t) ?? /^repeat\s*(\d{1,2})\s*(?:x|times)$/i.exec(t);
  if (!m) return null;
  const n = repeatCount(m[1]!) ?? Number(m[1]);
  return n >= 1 && n <= 16 ? n : null;
}

/**
 * Import ASCII tab. Never throws; rhythm is approximate (see the module comment).
 */
export function asciiTabToSong(text: string, options: TabOptions = {}): ImportOutcome {
  return guard(() => {
    const src = checkTextInput(text).replace(/\[\/?(ch|tab)\]/gi, '');
    const lines = src.split('\n').map(expandTabs);
    const meta = readSheetMeta(lines);
    const meter: [number, number] = options.beatsPerBar && options.beatUnit && isValidMeter(options.beatsPerBar, options.beatUnit)
      ? [options.beatsPerBar, options.beatUnit]
      : meta.meter ?? [4, 4];
    const barTicks = ticksPerBar(meter[0], meter[1]);
    const beatTicks = Math.round((IMPORT_PPQ * 4) / meter[1]);
    const warnings: string[] = [];
    let headerTuning: number[] | null = null;
    for (const raw of lines) {
      if (raw.length > 200) continue;
      const l = raw.trim();
      const m = /^tuning\b[\s:=-]*(.+)$/i.exec(l);
      const text = m ? m[1]! : /tuning/i.test(l) && /^(drop\s?[a-g]#?|open\s?[a-g]|dadgad|half\s?step\s?down|e\s?flat)\b/i.test(l) ? l : null;
      if (text) {
        headerTuning = tuningFromText(text);
        if (headerTuning) break;
      }
    }

    // 1. Find staves: runs of consecutive string lines, split into groups of six.
    const parsed = lines.map((l, i) => parseStringLine(l, i));
    const staves: StringLine[][] = [];
    const odd: number[] = [];
    for (let i = 0; i < lines.length; ) {
      if (!parsed[i]) {
        i++;
        continue;
      }
      let j = i;
      while (j < lines.length && parsed[j]) j++;
      const run = parsed.slice(i, j) as StringLine[];
      if (run.length % 6 === 0) for (let k = 0; k < run.length; k += 6) staves.push(run.slice(k, k + 6));
      else if (run.length >= 4) odd.push(run.length);
      i = j;
    }
    if (!staves.length) {
      throw new ImportAbort('no_tab', 'No guitar tab was found. Tab needs six lines, one per string, like e|---0---|.');
    }
    if (odd.length) warnings.push(`Skipped ${odd.length} block${odd.length === 1 ? '' : 's'} that didn't have exactly six string lines (bass or 7-string tab isn't supported).`);

    // 2. Tuning from the first staff with names, else a "Tuning:" line, else standard.
    let open = headerTuning ?? [...STANDARD_OPEN_BY_STRING];
    let flipped = false;
    let tuningFixed = false;
    let namesUnreadable = false;
    let pendingSection: string | null = null;
    const bars: TabBar[] = [];
    let lastLineUsed = -1;
    const used = new Set<number>();
    staves.forEach((s) => s.forEach((l) => used.add(l.lineNo)));

    for (const staffRaw of staves) {
      const first = staffRaw[0]!.lineNo;
      const lastLine = staffRaw[5]!.lineNo;
      // Headings and chord lines between the previous staff and this one.
      let chordLineNo: number | null = null;
      for (let k = lastLineUsed + 1; k < first; k++) {
        const h = sectionHeading(lines[k]!);
        if (h) pendingSection = h;
      }
      for (let k = first - 1; k > lastLineUsed && k >= first - 3; k--) {
        const l = lines[k]!;
        if (!l.trim()) continue;
        if (annotationRanges(l, 0).length) continue;
        if (isChordLine(l) && !sectionHeading(l)) chordLineNo = k;
        break;
      }
      lastLineUsed = lastLine;

      let staff = staffRaw;
      const names = staff.map((l) => l.name);
      if (!tuningFixed && names.some(Boolean)) {
        const t = tuningFromNames(names);
        if (t) {
          open = t.open;
          flipped = t.flipped;
        } else namesUnreadable = true;
        tuningFixed = true;
      } else if (!tuningFixed) tuningFixed = true;
      if (flipped) staff = [...staff].reverse();

      // Columns are measured from each line's own body start.
      const width = Math.max(...staff.map((l) => l.body.length));
      const bodies = staff.map((l) => l.body.padEnd(width, ' '));
      const barAt = (c: number) => bodies.filter((b) => b[c] === '|').length >= 4;
      const dotAt = (c: number) => bodies.filter((b) => b[c] === ':' || b[c] === '*').length >= 2;
      const boundaries: { from: number; to: number; startRepeat: boolean; endRepeat: boolean }[] = [];
      for (let c = 0; c < width; c++) {
        if (!barAt(c)) continue;
        let to = c;
        while (to + 1 < width && barAt(to + 1)) to++;
        const endRepeat = c > 0 && dotAt(c - 1);
        const startRepeat = to + 1 < width && dotAt(to + 1);
        boundaries.push({ from: c, to, startRepeat, endRepeat });
        c = to;
      }

      // Notes per string, then onsets.
      const notes = bodies.flatMap((b, idx) => readLine(b, idx));
      // PM / let ring lines right above or below the staff.
      for (const k of [first - 1, first - 2, lastLine + 1, lastLine + 2]) {
        if (k < 0 || k >= lines.length || used.has(k)) continue;
        const ref = k < first ? staffRaw[0]! : staffRaw[5]!;
        for (const r of annotationRanges(lines[k]!, ref.offset)) {
          for (const n of notes) if (n.col >= r.from && n.col <= r.to) addTech(n, { kind: r.kind });
        }
      }
      const onsets = groupOnsets(notes);

      // Bar segments.
      const segs: { from: number; to: number; startRepeat: boolean; endRepeat: boolean }[] = [];
      // A repeat sign right at the start ("e|:--") has no bar line of its own in the body.
      let startRep = dotAt(0) && !barAt(0);
      let segStart = 0;
      for (const bd of boundaries) {
        segs.push({ from: segStart + (startRep ? 1 : 0), to: bd.from - (bd.endRepeat ? 1 : 0), startRepeat: startRep, endRepeat: bd.endRepeat });
        segStart = bd.to + 1;
        startRep = bd.startRepeat;
      }
      segs.push({ from: segStart + (startRep ? 1 : 0), to: width, startRepeat: startRep, endRepeat: false });
      const gaps: number[] = [];
      for (const sg of segs) {
        const cols = onsets.filter((o) => o.col >= sg.from && o.col < sg.to).map((o) => o.col);
        for (let k = 1; k < cols.length; k++) gaps.push(cols[k]! - cols[k - 1]!);
      }
      const typicalGap = Math.max(1, median(gaps));

      const staffBars: TabBar[] = [];
      const colToTick: { from: number; to: number; barIdx: number; origin: number; span: number }[] = [];
      const realSegs = segs.filter((sg, k) => {
        const has = onsets.some((o) => o.col >= sg.from && o.col < sg.to);
        const inner = k > 0 && k < segs.length - 1;
        return has || (inner && sg.to - sg.from >= 3);
      });
      if (boundaries.length === 0 || realSegs.length === 0) {
        // No bar lines: median gap = one 8th note.
        const eighth = IMPORT_PPQ / 2;
        const c0 = onsets[0]?.col ?? 0;
        const ticks = onsets.map((o) => Math.round(((o.col - c0) / typicalGap) * 2) * (eighth / 2));
        const lastTick = ticks.length ? ticks[ticks.length - 1]! + eighth : barTicks;
        const nBars = Math.max(1, Math.ceil(lastTick / barTicks));
        for (let k = 0; k < nBars; k++) staffBars.push({ ticks: barTicks, events: [], chords: [] });
        onsets.forEach((o, k) => {
          const t = ticks[k]!;
          const bi = Math.min(nBars - 1, Math.floor(t / barTicks));
          staffBars[bi]!.events.push({ tick: t - bi * barTicks, notes: o.notes });
        });
        colToTick.push({ from: -Infinity, to: Infinity, barIdx: 0, origin: c0, span: (typicalGap * nBars * barTicks) / eighth });
      } else {
        for (const sg of realSegs) {
          const inBar = onsets.filter((o) => o.col >= sg.from && o.col < sg.to);
          const lead = inBar.length ? inBar[0]!.col - sg.from : 0;
          const origin = inBar.length && lead <= typicalGap ? inBar[0]!.col : sg.from;
          // Snap the bar width to a whole number of typical gaps, so a short trailing pad
          // after the last note ("|--0---3---5---7--|") still gives even quarters.
          const lastRel = inBar.length ? inBar[inBar.length - 1]!.col - origin : 0;
          const width = Math.max(1, sg.to - origin);
          const span = inBar.length >= 3 ? Math.max(lastRel + 1, typicalGap * Math.max(1, Math.round(width / typicalGap))) : Math.max(lastRel + 1, width);
          const raw = inBar.map((o) => ((o.col - origin) / span) * barTicks);
          const q = quantize(raw, barTicks);
          const bar: TabBar = { ticks: barTicks, events: inBar.map((o, k) => ({ tick: q[k]!, notes: o.notes })), chords: [] };
          if (sg.startRepeat) bar.repeatStart = true;
          if (sg.endRepeat) bar.repeatEndTimes = 2;
          colToTick.push({ from: sg.from, to: sg.to, barIdx: staffBars.length, origin, span });
          staffBars.push(bar);
        }
      }

      // Chord names written above the staff.
      if (chordLineNo !== null) {
        const offset = staffRaw[0]!.offset;
        for (const t of tokenize(lines[chordLineNo]!)) {
          const chord = parseChordName(t.text);
          if (!chord) continue;
          const c = t.col - offset;
          const seg = colToTick.find((x) => c < x.to) ?? colToTick[colToTick.length - 1];
          if (!seg) continue;
          const frac = Math.max(0, Math.min(0.999, (c - seg.origin) / seg.span));
          if (seg.from === -Infinity) {
            const tick = Math.round((frac * staffBars.length * barTicks) / beatTicks) * beatTicks;
            const bi = Math.min(staffBars.length - 1, Math.floor(tick / barTicks));
            staffBars[bi]!.chords.push({ tick: tick - bi * barTicks, name: chord.display });
          } else {
            const tick = Math.min(barTicks - beatTicks, Math.round((frac * barTicks) / beatTicks) * beatTicks);
            staffBars[seg.barIdx]!.chords.push({ tick, name: chord.display });
          }
        }
      }

      // xN repeat marks: trailing text on a string line, or a line just below/above the staff.
      let times: number | null = null;
      for (const l of staffRaw) {
        const n = l.trailing ? repeatCount(l.trailing.replace(/^repeat\s*/i, '').replace(/\s*times$/i, '')) ?? lineRepeat(l.trailing) : null;
        if (n) times = n;
      }
      times ??= lineRepeat(lines[lastLine + 1]) ?? (first > 0 && !used.has(first - 1) ? lineRepeat(lines[first - 1]) : null);
      if (times && times > 1 && staffBars.length) {
        const ends = staffBars.filter((b) => (b.repeatEndTimes ?? 0) > 1);
        if (ends.length) ends[ends.length - 1]!.repeatEndTimes = times;
        else {
          staffBars[0]!.repeatStart = true;
          staffBars[staffBars.length - 1]!.repeatEndTimes = times;
        }
      }
      if (pendingSection && staffBars.length) {
        staffBars[0]!.section = pendingSection;
        pendingSection = null;
      }
      bars.push(...staffBars);
    }

    // 3. Expand repeats and emit.
    const { order, truncated } = expandRepeats(bars);
    const tuning = describeTuning(open);
    const capo = meta.capo;
    const notesOut: ImportedNote[] = [];
    const chords: ImportedChord[] = [];
    const sections: { startTick: number; name: string }[] = [];
    const onsetTicks: number[] = [];
    const sectionDone = new Set<number>();
    let tick = 0;
    for (const bi of order) {
      const bar = bars[bi]!;
      if (bar.section && !sectionDone.has(bi)) {
        sectionDone.add(bi);
        sections.push({ startTick: tick, name: bar.section });
      }
      for (const c of bar.chords) chords.push({ startTick: tick + c.tick, durationTicks: 0, name: c.name });
      for (const ev of bar.events) {
        onsetTicks.push(tick + ev.tick);
        for (const n of ev.notes) {
          const string = (n.line + 1) as ImportStringNumber;
          const openMidi = open[n.line]! + capo;
          let midi: number;
          if (n.fret === null) midi = openMidi;
          else if (n.harmonic) midi = openMidi + (naturalHarmonicOffset(n.fret) ?? n.fret + 12);
          else midi = openMidi + n.fret;
          const note: ImportedNote = { startTick: tick + ev.tick, durationTicks: 0, midi, string };
          if (n.fret !== null) note.fret = n.fret;
          if (n.ghost) note.velocity = 50;
          if (n.techniques.length) note.techniques = n.techniques.map((t) => ({ ...t }));
          notesOut.push(note);
        }
      }
      tick += bar.ticks;
    }
    // Durations: until the next onset, the last one until the end of its bar.
    const uniqueOnsets = [...new Set(onsetTicks)].sort((a, b) => a - b);
    const nextOnset = new Map<number, number>();
    uniqueOnsets.forEach((t, k) => nextOnset.set(t, uniqueOnsets[k + 1] ?? Math.ceil((t + 1) / barTicks) * barTicks));
    for (const n of notesOut) n.durationTicks = Math.max(1, (nextOnset.get(n.startTick) ?? n.startTick + beatTicks) - n.startTick);

    if (!notesOut.length) throw new ImportAbort('no_notes', 'The tab has no notes on it.');
    warnings.unshift('ASCII tab doesn\'t store rhythm. Note timing was guessed from the spacing of the tab, so listen to the song and adjust where it sounds wrong.');
    if (flipped) warnings.push('This tab lists the low E string on top; it was flipped so string 1 is the high E.');
    if (namesUnreadable) warnings.push('The string names in this tab didn\'t make sense as a tuning, so standard tuning was assumed.');
    if (truncated) warnings.push('The song was cut short because the repeats made it very long.');
    const bpm = options.bpm ?? meta.bpm ?? DEFAULT_BPM;
    if (!options.bpm && !meta.bpm) warnings.push(`No tempo was given, so ${DEFAULT_BPM} BPM is used. Change it to match the song.`);
    warnings.push(...rangeWarnings(notesOut, tuning, capo));
    return finalizeSong({
      source: 'tab',
      title: meta.title,
      artist: meta.artist,
      bpm,
      beatsPerBar: meter[0],
      beatUnit: meter[1],
      notes: notesOut,
      chords,
      sections,
      tuning,
      capo,
      warnings,
      minDurationTicks: tick,
    });
  });
}
