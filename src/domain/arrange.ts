/**
 * Derive simpler arrangements from a reviewed monophonic part (master spec §7.5).
 * Each derivation is a new arrangement (role simplified_arrangement) with a parent
 * link and a transformation entry for every change, plus plain-language
 * disclosures. Only octave shifts and omissions change pitch content, so the
 * key — and therefore a backing recording — stays compatible.
 */
import { isUnreviewedCandidate, PPQ, sortEvents, type NoteEvent, type Score, type Transformation } from './score';
import { BEGINNER_PROFILE, planFingering, positionsFor, type FingeringProfile } from './fingering';

export type DerivationLevel = 'pulse' | 'strong-beats' | 'easy-melody';

export interface Derivation {
  ok: boolean;
  score: Score | null;
  level: DerivationLevel;
  disclosures: string[];
  reason: string | null;
}

export const LEVEL_INFO: Record<DerivationLevel, { title: string; disclose: string }> = {
  pulse: { title: 'Pulse', disclose: 'Plays the beat on one open string. It does not reproduce the melody or harmony.' },
  'strong-beats': { title: 'Strong beats', disclose: 'Keeps only the notes that start on beats 1 and 3, held longer. Rhythm and some notes are omitted.' },
  'easy-melody': { title: 'Easy melody', disclose: 'Keeps the melody, moved into open position (frets 0–3) with octave shifts where needed; very short off-beat notes are dropped.' },
};

function derived(src: Score, level: DerivationLevel, events: NoteEvent[], log: Transformation[]): Score {
  const id = `${src.arrangementId}.${level}`.slice(0, 120);
  return {
    ...src,
    arrangementId: id,
    version: 1,
    parent: { arrangementId: src.arrangementId, version: src.version },
    title: `${src.title} — ${LEVEL_INFO[level].title.toLowerCase()} version`.slice(0, 200),
    role: 'simplified_arrangement',
    events: sortEvents(events),
    // A version made from unreviewed machine notes stays a candidate (never assessed).
    provenance: { ...src.provenance, method: isUnreviewedCandidate(src) ? 'model_candidate' : 'derived', reviewStatus: 'unreviewed', reviewer: null, notes: `Derived automatically (${level}). ${LEVEL_INFO[level].disclose}` },
    transformations: log.slice(0, 1000),
  };
}

export function derive(src: Score, level: DerivationLevel, profile: FingeringProfile = BEGINNER_PROFILE): Derivation {
  const evs = sortEvents(src.events);
  if (!evs.length) return { ok: false, score: null, level, disclosures: [], reason: 'The part has no notes yet.' };
  const log: Transformation[] = [];

  if (level === 'pulse') {
    const events: NoteEvent[] = [];
    for (let t = 0, i = 1; t < src.durationTicks; t += PPQ, i++) {
      events.push({ id: `p${i}`, kind: 'note', startTick: t, durationTicks: PPQ, pitchMidi: 64, string: 1, fret: 0, finger: null, sourceEventIds: [], assessment: { pitch: true, attack: true, sustain: false } });
    }
    log.push({ kind: 'rhythm_simplify', description: 'Replaced the part with one open high-E note per beat (pulse only).', sourceEventIds: evs.map((e) => e.id), resultEventIds: events.map((e) => e.id) });
    return { ok: true, score: derived(src, level, events, log), level, disclosures: [LEVEL_INFO.pulse.disclose], reason: null };
  }

  let events: NoteEvent[];
  if (level === 'strong-beats') {
    const keep = evs.filter((e) => e.startTick % (2 * PPQ) === 0);
    const omitted = evs.filter((e) => !keep.includes(e));
    if (!keep.length) return { ok: false, score: null, level, disclosures: [], reason: 'No notes start on beats 1 or 3.' };
    if (omitted.length) log.push({ kind: 'omit', description: `Omitted ${omitted.length} note(s) that do not start on beats 1 or 3.`, sourceEventIds: omitted.map((e) => e.id), resultEventIds: [] });
    events = keep.map((e, i) => {
      const next = keep[i + 1];
      const maxEnd = Math.min(next ? next.startTick : src.durationTicks, e.startTick + 2 * PPQ);
      return { ...e, id: `${e.id}s`, durationTicks: Math.max(e.durationTicks, maxEnd - e.startTick), sourceEventIds: [e.id] };
    });
    const lengthened = events.filter((e, i) => e.durationTicks !== keep[i]!.durationTicks);
    if (lengthened.length) log.push({ kind: 'rhythm_simplify', description: `Held ${lengthened.length} kept note(s) longer to fill the gaps.`, sourceEventIds: lengthened.map((e) => e.sourceEventIds[0]!), resultEventIds: lengthened.map((e) => e.id) });
  } else {
    const short = evs.filter((e) => e.durationTicks < PPQ / 2 && e.startTick % PPQ !== 0);
    if (short.length) log.push({ kind: 'omit', description: `Dropped ${short.length} very short off-beat note(s).`, sourceEventIds: short.map((e) => e.id), resultEventIds: [] });
    events = evs.filter((e) => !short.includes(e)).map((e) => ({ ...e, id: `${e.id}m`, sourceEventIds: [e.id] }));
  }

  // Octave-shift notes into the profile's range (key unchanged), then refinger.
  const shifted: string[] = [];
  const dropped: string[] = [];
  events = events.flatMap((e) => {
    if (positionsFor(e.pitchMidi, profile).length) return [e];
    for (const d of [12, -12, 24, -24]) {
      if (positionsFor(e.pitchMidi + d, profile).length) {
        shifted.push(e.id);
        return [{ ...e, pitchMidi: e.pitchMidi + d }];
      }
    }
    dropped.push(e.id);
    return [];
  });
  if (shifted.length) log.push({ kind: 'octave_shift', description: `Moved ${shifted.length} note(s) by an octave to fit frets ${profile.minFret}–${profile.maxFret}.`, sourceEventIds: shifted.map((id) => id.slice(0, -1)), resultEventIds: shifted });
  if (dropped.length) log.push({ kind: 'omit', description: `Omitted ${dropped.length} note(s) with no playable position in frets ${profile.minFret}–${profile.maxFret}.`, sourceEventIds: dropped.map((id) => id.slice(0, -1)), resultEventIds: [] });
  if (!events.length) return { ok: false, score: null, level, disclosures: [], reason: 'no_playable_fingering' };
  const plan = planFingering(events.map((e) => e.pitchMidi), profile);
  if (!plan.ok) return { ok: false, score: null, level, disclosures: [], reason: 'no_playable_fingering' };
  const changed: string[] = [];
  events = events.map((e, i) => {
    const p = plan.positions[i]!;
    if (p.string !== e.string || p.fret !== e.fret) changed.push(e.id);
    return { ...e, string: p.string, fret: p.fret, finger: p.finger };
  });
  if (changed.length) log.push({ kind: 'fingering_change', description: `Chose open-position strings/frets for ${changed.length} note(s) (profile ${profile.id}).`, sourceEventIds: changed.map((id) => id.slice(0, -1)), resultEventIds: changed });
  const disclosures = [LEVEL_INFO[level].disclose];
  if (shifted.length) disclosures.push(`${shifted.length} note(s) moved by an octave; the key is unchanged, so a backing recording still fits.`);
  if (dropped.length) disclosures.push(`${dropped.length} note(s) could not be placed and were left out.`);
  return { ok: true, score: derived(src, level, events, log), level, disclosures, reason: null };
}
