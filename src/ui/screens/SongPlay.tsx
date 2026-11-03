import { useEffect, useMemo, useRef, useState } from 'react';
import type { SongAnalysis } from '../../audio/song';
import { analysisPcm } from '../../audio/importAudio';
import { isUnreviewedCandidate, type Score } from '../../domain/score';
import { buildLevels, LEVEL_TEXT, LEVELS, partView, type Level, type LevelResult } from '../../domain/songArrange';
import { analysisToSource } from '../../domain/fromAnalysis';
import { practiceRightsIssue, validateScore } from '../../domain/validate';
import { saveArrangement } from '../../storage/db';
import type { AssetRecord, SongRecord, SongVersionRef } from '../../storage/types';
import { AnchorTimeMap } from '../../transport/timemap';
import { useApp } from '../AppContext';
import { navigate } from '../App';
import { ChordBox, Coach } from '../art';
import { Callout, Segmented, toast } from '../kit';
import { PracticePlayer } from '../practice/PracticePlayer';
import { useJoke } from '../coach';

export const ANALYZER_ID = 'guitar-unhero.song-analysis';
export const ANALYZER_VERSION = '1.0.0';

/** Save the three level arrangements and point the song at them. */
export async function saveLevels(song: SongRecord, results: LevelResult[], note: string): Promise<SongRecord> {
  const versions: SongVersionRef[] = [...song.versions];
  const levels: NonNullable<SongRecord['levels']> = { ...(song.levels ?? {}) };
  for (const r of results) {
    const prev = song.versions.filter((v) => v.arrangementId === r.score.arrangementId).length;
    const score: Score = { ...r.score, version: prev + 1, parent: prev ? { arrangementId: r.score.arrangementId, version: prev } : null };
    // Never store a level that does not validate (e.g. nothing was found).
    const check = validateScore(JSON.parse(JSON.stringify(score)));
    if (!check.ok) continue;
    await saveArrangement(score);
    versions.push({ arrangementId: score.arrangementId, version: score.version, role: score.role, title: score.title, createdAt: new Date().toISOString(), note });
    levels[r.level] = { arrangementId: score.arrangementId, version: score.version };
  }
  if (!Object.keys(levels).length) throw new Error('Nothing playable was found.');
  return { ...song, versions, levels, mainArrangementId: levels.full?.arrangementId ?? song.mainArrangementId, updatedAt: new Date().toISOString() };
}

function timeMap(song: SongRecord): AnchorTimeMap | undefined {
  if (song.anchors.length < 2) return undefined;
  try {
    return new AnchorTimeMap(song.anchors);
  } catch {
    return undefined;
  }
}

/** Easy / Medium / Full picker, melody-or-chords part, chord preview and the player. */
export function LevelPlay({ song, scores, buffer, onReview }: { song: SongRecord; scores: Map<string, Score>; buffer: AudioBuffer | null; onReview: (levels: Score[]) => Promise<void> }) {
  const { settings } = useApp();
  const available = LEVELS.filter((l) => song.levels?.[l] && scores.has(`${song.levels[l]!.arrangementId}@${song.levels[l]!.version}`));
  // Scores load after the song record: pick the default level once they are there.
  const [chosen, setLevel] = useState<Level | null>(null);
  const level: Level = chosen && available.includes(chosen) ? chosen : available.includes('easy') ? 'easy' : available[0] ?? 'full';
  const ref = song.levels?.[level];
  const score = ref ? scores.get(`${ref.arrangementId}@${ref.version}`) ?? null : null;
  const hasMelody = !!score?.events.length;
  const hasChords = !!score?.chords?.length;
  const [part, setPart] = useState<'melody' | 'chords'>('chords');
  const effectivePart = part === 'chords' && !hasChords ? 'melody' : part === 'melody' && !hasMelody ? 'chords' : part;
  const map = useMemo(() => timeMap(song), [song]);
  const joke = useJoke('song_imported', song.title.length);
  const [reviewing, setReviewing] = useState(false);
  const [section, setSection] = useState<number>(-1);
  // Memoised: a new object every render would rebuild the player and restart playback.
  const view = useMemo(() => (score ? partView(score, effectivePart) : null), [score, effectivePart]);
  if (!score || !view) return <Callout kind="info">No playable version yet.</Callout>;
  const candidate = isUnreviewedCandidate(score);
  const rightsIssue = practiceRightsIssue(score);
  const unique = new Map<string, NonNullable<Score['chords']>[number]>();
  for (const c of score.chords ?? []) if (!unique.has(JSON.stringify(c.frets))) unique.set(JSON.stringify(c.frets), c);
  const levelScores = available.map((l) => scores.get(`${song.levels![l]!.arrangementId}@${song.levels![l]!.version}`)!).filter(Boolean);

  return (
    <div className="stack">
      <div className="level-pills" role="group" aria-label="Difficulty" data-testid="level-pills">
        {LEVELS.map((l) => (
          <button key={l} type="button" aria-pressed={level === l} disabled={!available.includes(l)} onClick={() => setLevel(l)} data-testid={`level-${l}`}>
            <b>{LEVEL_TEXT[l].title}</b>
            <small>{LEVEL_TEXT[l].sub}</small>
          </button>
        ))}
      </div>
      {hasMelody && hasChords && (
        <Segmented label="What do you want to play?" value={effectivePart} onChange={setPart} testId="part"
          options={[{ value: 'chords', label: 'Strum the chords' }, { value: 'melody', label: 'Play the tune' }]} />
      )}
      {candidate && (
        <div className="callout warn stack" style={{ display: 'flex' }} data-testid="candidate-banner">
          <span>The app worked these chords and notes out from the recording. They can be wrong (singers, drums and effects confuse it). Play along and listen: when it sounds right, tell the app and it will start checking the tune you play.</span>
          <div className="row">
            <button type="button" className="btn tonal" disabled={reviewing} data-testid="sounds-right" onClick={() => { setReviewing(true); void onReview(levelScores).finally(() => setReviewing(false)); }}>Sounds right — check my playing</button>
            <a className="btn text" href={`#/song/${song.id}/notes`}>Fix notes</a>
          </div>
        </div>
      )}
      {!!song.importWarnings?.length && (
        <details className="card tight t-small">
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Notes about this import ({song.importWarnings.length})</summary>
          <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>{song.importWarnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </details>
      )}
      {score.instrument.capo > 0 && (
        <Callout kind="info">Put a capo on fret {score.instrument.capo}. Frets below are counted from the capo, so the easy shapes sound like the real chords.</Callout>
      )}
      {unique.size > 0 && (
        <div>
          <div className="t-small muted" style={{ fontWeight: 700 }}>Chords in this version ({unique.size})</div>
          <div className="chord-strip" data-testid="chord-strip">
            {[...unique.values()].slice(0, 24).map((c) => (
              <ChordBox key={c.id} name={c.name} frets={c.frets} fingers={c.fingers} leftHanded={settings.handedness === 'left'} size={96} />
            ))}
          </div>
        </div>
      )}
      {score.provenance.notes && <p className="t-caption" style={{ margin: 0 }}>{score.provenance.notes}</p>}
      {(score.sections?.length ?? 0) > 1 && (
        <label className="field">
          <span>Practise a part on repeat</span>
          <select className="input" value={section} onChange={(e) => setSection(Number(e.target.value))} data-testid="section-select">
            <option value={-1}>The whole song</option>
            {score.sections!.map((sec, i) => {
              const end = score.sections![i + 1]?.tick ?? score.durationTicks;
              return <option key={sec.tick} value={i}>{sec.name} (bars {Math.floor(sec.tick / 3840) + 1}–{Math.ceil(end / 3840)})</option>;
            })}
          </select>
        </label>
      )}
      {rightsIssue ? <Callout kind="bad">{rightsIssue}</Callout> : (
        <PracticePlayer key={`${score.arrangementId}@${score.version}:${effectivePart}:${section}`} score={view} map={map && buffer ? map : undefined} backing={map ? buffer : null} assessmentAllowed={!candidate && effectivePart === 'melody'}
          notCheckedText={effectivePart === 'chords' ? 'Strum along — chords are not checked' : undefined}
          initial={section >= 0 && score.sections?.[section] ? { loop: { aTick: score.sections[section]!.tick, bTick: score.sections[section + 1]?.tick ?? score.durationTicks } } : undefined} />
      )}
      {joke && <Coach mood="rock" joke={joke}><p>Pick a level, start slow, and loop the hard bits.</p></Coach>}
    </div>
  );
}

const STAGES: Record<string, string> = { onsets: 'Finding the beat', beats: 'Finding the beat', tuning: 'Checking the tuning', chroma: 'Listening for chords', chords: 'Listening for chords', key: 'Working out the key', melody: 'Following the tune', bass: 'Following the bass', sections: 'Finding verses and choruses', done: 'Done' };

/** Runs the on-device song analysis, then builds the three levels. */
export function AnalyzeView({ song, asset, buffer, onDone }: { song: SongRecord; asset: AssetRecord; buffer: AudioBuffer | null; onDone: (next: SongRecord) => Promise<void> }) {
  const [state, setState] = useState<{ fraction: number; stage: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SongAnalysis | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const joke = useJoke('song_imported', asset.bytes);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const run = async () => {
    if (!buffer) return;
    setError(null);
    setState({ fraction: 0, stage: 'Preparing' });
    try {
      const { pcm, sampleRate } = await analysisPcm(buffer);
      const w = new Worker(new URL('../../audio/song/analysis.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = w;
      const analysis = await new Promise<SongAnalysis>((resolve, reject) => {
        w.onmessage = (e: MessageEvent) => {
          const m = e.data as { type: string; fraction?: number; stage?: string; analysis?: SongAnalysis; message?: string };
          if (m.type === 'progress') setState({ fraction: m.fraction ?? 0, stage: m.stage ?? '' });
          else if (m.type === 'result') resolve(m.analysis!);
          else if (m.type === 'error') reject(new Error(m.message));
        };
        w.onerror = (e) => reject(new Error(e.message || 'Analysis failed'));
        const copy = pcm.slice();
        w.postMessage({ type: 'analyze', pcm: copy, sampleRate }, [copy.buffer]);
      });
      w.terminate();
      workerRef.current = null;
      setResult(analysis);
      const { source, anchors, warnings } = analysisToSource(analysis, {
        arrangementId: `song.${song.id}`,
        title: song.title,
        rights: asset.rights,
        createdBy: 'Guitar Unhero song analysis (on this device)',
        sourceAudio: { assetId: asset.id, sha256: asset.sha256, durationSec: Math.min(1800, asset.durationSec), rights: asset.rights },
        providerId: ANALYZER_ID,
        providerVersion: ANALYZER_VERSION,
      });
      const levels = buildLevels(source).filter((l) => l.score.events.length || l.score.chords?.length);
      if (!levels.length) throw new Error('no clear beat, chords or tune were found in this recording. Try a song with a steady beat and clear chords, or paste a chord sheet instead.');
      let next = await saveLevels(song, levels, 'Worked out from the recording (unreviewed)');
      const keyName = `${['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'][analysis.key.tonic]} ${analysis.key.mode}`;
      next = {
        ...next,
        source: 'recording',
        anchors: anchors.length >= 2 ? anchors : next.anchors,
        alignment: anchors.length >= 2 ? 'auto' : next.alignment,
        analysis: { bpm: Math.round(analysis.bpm), key: keyName, chordCount: source.chords.length, noteCount: source.notes.length, warnings: warnings.slice(0, 6), analyzedAt: new Date().toISOString(), reviewed: false },
      };
      await onDone(next);
      setState({ fraction: 1, stage: 'done' });
      toast('Your song is ready: easy, medium and full');
      navigate('song', song.id, 'play');
    } catch (e) {
      workerRef.current?.terminate();
      workerRef.current = null;
      setState(null);
      setError(`The analysis stopped: ${(e as Error).message}`);
    }
  };

  const cancel = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setState(null);
  };

  return (
    <div className="stack">
      <Coach mood={state ? 'think' : 'happy'} joke={joke}>
        <p>{state ? `${STAGES[state.stage] ?? state.stage}…` : 'The app will listen to the whole song on this device and work out the beat, the chords and the tune. Then you pick Easy, Medium or Full.'}</p>
      </Coach>
      {state && (
        <div className="stack" style={{ gap: 6 }}>
          <div className="xp" role="progressbar" aria-label="Analysis progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(state.fraction * 100)}><i style={{ width: `${Math.round(state.fraction * 100)}%` }} /></div>
          <button type="button" className="btn outline" onClick={cancel}>Cancel</button>
        </div>
      )}
      {!state && (
        <button type="button" className="btn primary big block" disabled={!buffer} onClick={() => void run()} data-testid="analyze">
          {song.levels ? 'Listen again' : 'Work it out'}
        </button>
      )}
      {!buffer && <p className="t-small muted">Loading the recording…</p>}
      {result && <p className="t-small">About {Math.round(result.bpm)} BPM · key of {['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'][result.key.tonic]} {result.key.mode}.</p>}
      {error && <Callout kind="bad">{error}</Callout>}
      <p className="t-caption">Works best on songs with a clear beat and guitar or piano chords. Everything happens on this device — nothing is uploaded.</p>
    </div>
  );
}
