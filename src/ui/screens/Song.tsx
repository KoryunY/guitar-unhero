import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { engine, type Handle } from '../../audio/engine';
import { decodeImport, IMPORT_FAILURE_TEXT, MAX_IMPORT_SECONDS, monoMix, waveformPeaks } from '../../audio/importAudio';
import { buildCandidate, estimateTempo, quantize, type RawTranscription } from '../../audio/transcribe';
import type { Rights, Score } from '../../domain/score';
import { blankScore, commitVersion, setTempo } from '../../domain/edit';
import { derive, LEVEL_INFO, type DerivationLevel } from '../../domain/arrange';
import { anchorsFromFit, checkAnchors, fitTaps, type TapFit } from '../../domain/alignment';
import { parseScoreJson, practiceRightsIssue, validateScore } from '../../domain/validate';
import { AnchorTimeMap } from '../../transport/timemap';
import { deleteSong, loadArrangement, loadAsset, loadSongs, saveArrangement, saveAsset, saveSong } from '../../storage/db';
import type { AssetRecord, SongRecord, SongVersionRef } from '../../storage/types';
import { useApp } from '../AppContext';
import { navigate, SoundToggle, StatusChip } from '../App';
import { Icon } from '../icons';
import { Callout, Segmented, toast, TopBar } from '../kit';
import { ScoreEditor } from '../components/ScoreEditor';
import { PracticePlayer } from '../practice/PracticePlayer';
import { songStatus } from './PracticeLibrary';

type RightsChoice = 'own' | 'permission' | 'unsure';
const RIGHTS: Record<RightsChoice, { title: string; sub: string; rights: () => Rights }> = {
  own: {
    title: 'My own playing or my own song',
    sub: 'You recorded it or wrote it.',
    rights: () => ({ status: 'user_declared', author: 'the learner', license: null, allowedUses: ['local_practice', 'modify'], sourceUri: null, evidence: 'Declared by the learner as their own recording/composition.' }),
  },
  permission: {
    title: 'I have permission to use it',
    sub: 'For example a teacher gave it to you.',
    rights: () => ({ status: 'user_declared', author: null, license: null, allowedUses: ['local_practice', 'modify'], sourceUri: null, evidence: 'Learner declared they have permission for private practice.' }),
  },
  unsure: {
    title: 'Not sure — keep it private on this device',
    sub: 'Fine for personal practice here. It is never shared.',
    rights: () => ({ status: 'unknown', author: null, license: null, allowedUses: ['local_practice'], sourceUri: null, evidence: 'Rights unknown; kept for private local practice only.' }),
  },
};

const bufferCache = new Map<string, AudioBuffer>();
const newId = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function SongScreen({ songId, view }: { songId: string | null; view: string | null }) {
  if (!songId || songId === 'new') return <NewSong />;
  return <SongWorkspace songId={songId} view={view ?? 'play'} />;
}

// ---------------------------------------------------------------- new song
function NewSong() {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'recording' | 'notes' | 'file'>('recording');
  const [rightsChoice, setRightsChoice] = useState<RightsChoice>('own');
  const [bpm, setBpm] = useState(80);
  const [bars, setBars] = useState(4);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const create = async () => {
    setError(null);
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const id = newId('song-');
      const rights = RIGHTS[rightsChoice].rights();
      const song: SongRecord = { id, title: title.trim() || 'My song', assetId: null, mainArrangementId: null, versions: [], anchors: [], alignment: 'none', uncertain: [], createdAt: now, updatedAt: now };
      if (kind === 'recording') {
        const file = fileRef.current?.files?.[0];
        if (!file) throw new Error('Choose an audio file first.');
        const ctx = await engine.ensureContext();
        const r = await decodeImport(ctx, file);
        if (!r.ok) throw new Error(IMPORT_FAILURE_TEXT[r.reason]);
        const asset: AssetRecord = {
          id: newId('asset-'), name: file.name.slice(0, 200), mime: r.value.mime, bytes: r.value.bytes, durationSec: r.value.buffer.duration,
          sampleRate: r.value.buffer.sampleRate, channels: r.value.buffer.numberOfChannels, sha256: r.value.sha256, createdAt: now, rights, blob: file,
        };
        await saveAsset(asset);
        bufferCache.set(asset.id, r.value.buffer);
        song.assetId = asset.id;
        if (!title.trim()) song.title = file.name.replace(/\.[a-z0-9]+$/i, '').slice(0, 80);
      } else if (kind === 'notes') {
        const score = blankScore({ arrangementId: `user.${id}`, title: song.title, bpm, bars, rights, now: new Date() });
        await saveArrangement(score);
        song.mainArrangementId = score.arrangementId;
        song.versions.push({ arrangementId: score.arrangementId, version: 1, role: score.role, title: score.title, createdAt: now, note: 'Empty part created' });
      } else {
        const file = fileRef.current?.files?.[0];
        if (!file) throw new Error('Choose a .json score file first.');
        const parsed = parseScoreJson(await file.text());
        if (!parsed.ok) throw new Error(`This score can't be used: ${parsed.issues.slice(0, 3).map((i) => i.message).join(' ')}`);
        // Keep the file's own provenance/rights; the learner's declaration is recorded alongside.
        const score: Score = { ...parsed.score, arrangementId: `user.${id}`.slice(0, 120), provenance: { ...parsed.score.provenance, method: 'imported', notes: `Imported from ${file.name}. ${parsed.score.provenance.notes ?? ''}`.slice(0, 4000) } };
        const check = validateScore(JSON.parse(JSON.stringify(score)));
        if (!check.ok) throw new Error(check.issues[0]!.message);
        await saveArrangement(score);
        song.mainArrangementId = score.arrangementId;
        song.title = title.trim() || score.title;
        song.versions.push({ arrangementId: score.arrangementId, version: score.version, role: score.role, title: score.title, createdAt: now, note: `Imported ${file.name}` });
      }
      await saveSong(song);
      navigate('song', song.id, kind === 'recording' ? 'timing' : kind === 'notes' ? 'notes' : 'play');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="stack" style={{ maxWidth: 640, margin: '0 auto' }}>
      <TopBar title="Add a song" back={() => navigate('practice')} />
      <label className="field"><span>Name</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="My song" maxLength={80} data-testid="song-title" /></label>
      <div className="field"><span>Start from</span>
        <div className="stack" role="radiogroup" aria-label="Start from">
          {([
            ['recording', 'A recording', 'Play along with it, line it up with the beat, or try turning clean guitar into notes.', 'wave'],
            ['notes', 'Write my own notes', 'An empty part you fill in on the string grid.', 'edit'],
            ['file', 'A score file (.json)', 'A Guitar Unhero score you were given.', 'folder'],
          ] as const).map(([k, t, sub, icon]) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} className="choice" onClick={() => setKind(k)} data-testid={`new-${k}`}>
              <Icon name={icon} />
              <div><div className="c-title">{t}</div><div className="c-sub">{sub}</div></div>
            </button>
          ))}
        </div>
      </div>
      {kind !== 'notes' && (
        <label className="field">
          <span>{kind === 'recording' ? `Audio file (WAV or MP3, up to 25 MB and ${MAX_IMPORT_SECONDS / 60} minutes)` : 'Score file'}</span>
          <input ref={fileRef} type="file" className="input" style={{ paddingTop: 10 }} accept={kind === 'recording' ? 'audio/*,.wav,.mp3,.m4a,.ogg,.flac' : 'application/json,.json'} data-testid="song-file" />
        </label>
      )}
      {kind === 'notes' && (
        <div className="row">
          <label className="field" style={{ flex: 1 }}><span>Tempo (BPM)</span><input className="input" type="number" min={30} max={200} value={bpm} onChange={(e) => setBpm(Number(e.target.value) || 80)} /></label>
          <label className="field" style={{ flex: 1 }}><span>Bars</span><input className="input" type="number" min={1} max={64} value={bars} onChange={(e) => setBars(Math.max(1, Math.min(64, Number(e.target.value) || 4)))} /></label>
        </div>
      )}
      <div className="field"><span>Whose music is it?</span>
        <div className="stack" role="radiogroup" aria-label="Whose music is it?">
          {(Object.keys(RIGHTS) as RightsChoice[]).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={rightsChoice === k} className="choice" onClick={() => setRightsChoice(k)}>
              <div><div className="c-title">{RIGHTS[k].title}</div><div className="c-sub">{RIGHTS[k].sub}</div></div>
            </button>
          ))}
        </div>
        <span className="t-caption">Everything stays on this device. Nothing is uploaded or shared, and the app does not download songs from the internet.</span>
      </div>
      {error && <Callout kind="bad">{error}</Callout>}
      <button type="button" className="btn primary block" onClick={create} disabled={busy} data-testid="create-song">{busy ? 'Working…' : 'Create'}</button>
    </section>
  );
}

// ---------------------------------------------------------------- workspace
function SongWorkspace({ songId, view }: { songId: string; view: string }) {
  const [song, setSong] = useState<SongRecord | null | undefined>(undefined);
  const [asset, setAsset] = useState<AssetRecord | null>(null);
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [scores, setScores] = useState<Map<string, Score>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const all = await loadSongs();
    const s = all.find((x) => x.id === songId) ?? null;
    setSong(s);
    if (!s) return;
    const m = new Map<string, Score>();
    for (const v of s.versions) {
      const sc = await loadArrangement(v.arrangementId, v.version);
      if (sc) m.set(`${v.arrangementId}@${v.version}`, sc);
    }
    setScores(m);
    if (s.assetId) {
      const a = await loadAsset(s.assetId);
      setAsset(a);
      if (a) {
        let b = bufferCache.get(a.id);
        if (!b) {
          try {
            const ctx = await engine.ensureContext();
            b = await ctx.decodeAudioData(await a.blob.arrayBuffer());
            bufferCache.set(a.id, b);
          } catch {
            setError('The saved recording could not be decoded in this browser.');
          }
        }
        setBuffer(b ?? null);
      }
    }
  }, [songId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const update = async (patch: Partial<SongRecord>) => {
    if (!song) return;
    const next = { ...song, ...patch, updatedAt: new Date().toISOString() };
    setSong(next);
    await saveSong(next);
  };
  const addVersion = async (score: Score, note: string, main = true) => {
    if (!song) return;
    await saveArrangement(score);
    const ref: SongVersionRef = { arrangementId: score.arrangementId, version: score.version, role: score.role, title: score.title, createdAt: new Date().toISOString(), note };
    const versions = [...song.versions, ref];
    setScores((m) => new Map(m).set(`${score.arrangementId}@${score.version}`, score));
    await update({ versions, mainArrangementId: main ? score.arrangementId : song.mainArrangementId });
  };

  if (song === undefined) return <p className="muted">Loading…</p>;
  if (song === null) return <Callout kind="bad">This song was not found. <a href="#/practice">Back to Practice</a></Callout>;

  const mainVersions = song.versions.filter((v) => v.arrangementId === song.mainArrangementId);
  const mainRef = mainVersions[mainVersions.length - 1] ?? null;
  const main = mainRef ? scores.get(`${mainRef.arrangementId}@${mainRef.version}`) ?? null : null;
  const tabs = [
    { value: 'play', label: 'Play' },
    { value: 'notes', label: 'Notes' },
    ...(asset ? [{ value: 'timing', label: 'Timing' }] : []),
    { value: 'easy', label: 'Easy' },
    ...(asset ? [{ value: 'transcribe', label: 'To notes' }] : []),
    { value: 'more', label: 'More' },
  ];

  return (
    <section className="stack">
      <TopBar title={song.title} back={() => navigate('practice')}>
        <StatusChip />
        <SoundToggle />
      </TopBar>
      <div className="row">
        <span className="badge">{songStatus(song)}</span>
        {asset && <span className="badge"><Icon name="wave" size={12} /> {asset.durationSec.toFixed(0)} s recording</span>}
        {song.alignment !== 'none' && <span className="badge good">Lined up with the beat</span>}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <Segmented label="Song sections" value={tabs.some((t) => t.value === view) ? view : 'play'} options={tabs} onChange={(v) => navigate('song', song.id, v)} testId="song-tabs" />
      </div>
      {error && <Callout kind="bad">{error}</Callout>}
      {view === 'play' && <PlayView song={song} scores={scores} buffer={buffer} />}
      {view === 'notes' && <NotesView song={song} main={main} buffer={buffer} asset={asset} onCreate={addVersion} />}
      {view === 'timing' && asset && <TimingView song={song} asset={asset} buffer={buffer} main={main} update={update} addVersion={addVersion} />}
      {view === 'easy' && <EasyView main={main} onSave={addVersion} />}
      {view === 'transcribe' && asset && <TranscribeView song={song} asset={asset} buffer={buffer} update={update} addVersion={addVersion} />}
      {view === 'more' && <MoreView song={song} main={main} asset={asset} />}
    </section>
  );
}

function timeMapFor(song: SongRecord, buffer: AudioBuffer | null): AnchorTimeMap | undefined {
  if (!buffer || song.anchors.length < 2) return undefined;
  try {
    return new AnchorTimeMap(song.anchors);
  } catch {
    return undefined;
  }
}

function PlayView({ song, scores, buffer }: { song: SongRecord; scores: Map<string, Score>; buffer: AudioBuffer | null }) {
  const keys = song.versions.map((v) => `${v.arrangementId}@${v.version}`).filter((k) => scores.has(k));
  const latestPerArrangement = [...new Map(song.versions.map((v) => [v.arrangementId, `${v.arrangementId}@${v.version}`])).values()].filter((k) => scores.has(k));
  const [key, setKey] = useState<string | null>(null);
  const chosen = key && scores.has(key) ? key : latestPerArrangement.find((k) => k.startsWith(`${song.mainArrangementId}@`)) ?? latestPerArrangement[0] ?? null;
  const score = chosen ? scores.get(chosen)! : null;
  const map = useMemo(() => timeMapFor(song, buffer), [song, buffer]);
  if (!score) {
    return (
      <div className="card stack">
        <p>This song has no notes yet{buffer ? ' — you can still listen to the recording in “Timing”.' : '.'}</p>
        <div className="row">
          <a className="btn tonal" href={`#/song/${song.id}/notes`}>Write notes</a>
          {buffer && <a className="btn tonal" href={`#/song/${song.id}/transcribe`}>Turn the recording into notes</a>}
        </div>
      </div>
    );
  }
  const candidate = score.role === 'transcription_candidate' && score.provenance.reviewStatus === 'unreviewed';
  const rightsIssue = practiceRightsIssue(score);
  // An easy version derived from the main part keeps its timing, so the recording still lines up.
  const usesRecording = map && (score.arrangementId === song.mainArrangementId || score.parent?.arrangementId === song.mainArrangementId);
  return (
    <div className="stack">
      {latestPerArrangement.length > 1 && (
        <label className="field"><span>Version</span>
          <select className="input" value={chosen!} onChange={(e) => setKey(e.target.value)}>
            {latestPerArrangement.map((k) => <option key={k} value={k}>{scores.get(k)!.title} (v{scores.get(k)!.version})</option>)}
          </select>
        </label>
      )}
      {candidate && <Callout kind="warn">These notes came from the experimental transcriber and haven’t been reviewed. They play, but nothing is checked until you review them in “Notes”.</Callout>}
      {!usesRecording && buffer && <Callout kind="info">Line the recording up with the beat in “Timing” to hear it while you play.</Callout>}
      {rightsIssue ? <Callout kind="bad">{rightsIssue}</Callout> : (
        <PracticePlayer key={`${chosen}:${usesRecording ? 'rec' : 'norec'}`} score={score} map={usesRecording ? map : undefined} backing={usesRecording ? buffer : null} assessmentAllowed={!candidate} />
      )}
      <p className="t-caption">{keys.length} saved version{keys.length === 1 ? '' : 's'}.</p>
    </div>
  );
}

function NotesView({ song, main, buffer, asset, onCreate }: { song: SongRecord; main: Score | null; buffer: AudioBuffer | null; asset: AssetRecord | null; onCreate: (s: Score, note: string, main?: boolean) => Promise<void> }) {
  const [draft, setDraft] = useState<Score | null>(main);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => setDraft(main), [main]);

  if (!main) {
    const start = async () => {
      const rights = asset?.rights ?? RIGHTS.own.rights();
      const s = blankScore({ arrangementId: `user.${song.id}`, title: song.title, bpm: 80, bars: 4, rights });
      await onCreate(s, 'Empty part created');
    };
    return (
      <div className="card stack">
        <p>No notes yet. Start an empty part{buffer ? ', or try turning the recording into notes' : ''}.</p>
        <button type="button" className="btn primary" onClick={() => void start()} data-testid="start-notes">Start writing notes</button>
      </div>
    );
  }
  const candidate = main.role === 'transcription_candidate' && main.provenance.reviewStatus === 'unreviewed';
  const save = async (s: Score, reviewed = false) => {
    setSaving(true);
    let next = commitVersion(main, s, { kind: 'manual_edit', description: reviewed ? 'Reviewed and corrected by the learner' : 'Edited in the notes grid', sourceEventIds: main.events.map((e) => e.id) });
    if (reviewed) next = { ...next, role: 'reviewed_part', provenance: { ...next.provenance, reviewStatus: 'user_reviewed', reviewer: 'the learner (self-review)' } };
    const v = validateScore(JSON.parse(JSON.stringify(next)));
    if (!v.ok) {
      setMsg(`Not saved: ${v.issues[0]!.message}`);
      setSaving(false);
      return;
    }
    await onCreate(next, reviewed ? 'Reviewed by the learner' : 'Edited');
    setSaving(false);
    toast(reviewed ? 'Reviewed — notes will now be checked' : `Saved version ${next.version}`);
  };
  const tick0 = song.anchors[0];
  const uncertainTicks = tick0 && song.anchors[1]
    ? song.uncertain.map((u) => ((u.onsetSec - tick0.sourceSec) / (song.anchors[1]!.sourceSec - tick0.sourceSec)) * (song.anchors[1]!.tick - tick0.tick))
    : [];
  return (
    <div className="stack">
      {candidate && (
        <Callout kind="warn">
          Candidate notes from the recording. Listen, fix anything that’s wrong (orange squares were unclear), then mark them as reviewed. Until then they aren’t used to check your playing.
        </Callout>
      )}
      <div className="row">
        <span className="t-small muted spacer">Version {main.version} · {main.tempoMap[0]!.bpm} BPM</span>
        <label className="row t-small">Tempo <input className="input" type="number" min={20} max={300} style={{ width: 90 }} value={draft?.tempoMap[0]!.bpm ?? 80} onChange={(e) => draft && setDraft(setTempo(draft, Number(e.target.value) || 80))} aria-label="Tempo in BPM" /></label>
      </div>
      {draft && <ScoreEditor score={draft} onChange={setDraft} uncertainTicks={candidate ? uncertainTicks : []} onSave={(s) => void save(s)} saving={saving} />}
      {candidate && draft && <button type="button" className="btn tonal block" onClick={() => void save(draft, true)} data-testid="mark-reviewed">I listened and checked these notes — mark as reviewed</button>}
      {msg && <Callout kind="bad">{msg}</Callout>}
    </div>
  );
}

function Waveform({ buffer, positionSec, beats, onSeek }: { buffer: AudioBuffer; positionSec: number | null; beats: number[]; onSeek?: (sec: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const peaks = useMemo(() => waveformPeaks(monoMix(buffer), 600), [buffer]);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = c.clientWidth * dpr;
    c.height = c.clientHeight * dpr;
    const g = c.getContext('2d')!;
    g.scale(dpr, dpr);
    const W = c.clientWidth, H = c.clientHeight;
    const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    g.clearRect(0, 0, W, H);
    g.fillStyle = css('--muted');
    const max = Math.max(0.01, ...peaks);
    peaks.forEach((p, i) => {
      const h = (p / max) * (H / 2 - 4);
      g.fillRect((i / peaks.length) * W, H / 2 - h, Math.max(1, W / peaks.length - 0.5), 2 * h);
    });
    g.fillStyle = css('--primary');
    for (const b of beats) g.fillRect((b / buffer.duration) * W, 0, 1.5, H);
    if (positionSec !== null) {
      g.fillStyle = css('--incorrect');
      g.fillRect((positionSec / buffer.duration) * W - 1, 0, 3, H);
    }
  }, [peaks, positionSec, beats, buffer]);
  return (
    <canvas
      ref={ref}
      className="waveform"
      role="img"
      aria-label={`Recording waveform, ${buffer.duration.toFixed(1)} seconds${beats.length ? `, ${beats.length} beat markers` : ''}`}
      onPointerDown={(e) => {
        if (!onSeek) return;
        const r = (e.target as HTMLCanvasElement).getBoundingClientRect();
        onSeek(((e.clientX - r.left) / r.width) * buffer.duration);
      }}
    />
  );
}

/** Play the recording from `from` and report the heard position; returns a stop function. */
function useRecordingPlayer(buffer: AudioBuffer | null) {
  const [pos, setPos] = useState<number | null>(null);
  const state = useRef<{ handle: Handle | null; startC: number; offset: number; raf: number }>({ handle: null, startC: 0, offset: 0, raf: 0 });
  const stop = useCallback(() => {
    state.current.handle?.stop();
    state.current.handle = null;
    cancelAnimationFrame(state.current.raf);
    setPos(null);
  }, []);
  const play = useCallback(async (from = 0) => {
    if (!buffer) return;
    stop();
    const ctx = await engine.ensureContext();
    const startC = ctx.currentTime + 0.1;
    state.current = { handle: engine.playBacking(buffer, startC, from, startC + (buffer.duration - from)), startC, offset: from, raf: 0 };
    const tick = () => {
      const heard = state.current.offset + (engine.audibleNow() - state.current.startC);
      if (heard >= buffer.duration) return stop();
      setPos(Math.max(state.current.offset, heard));
      state.current.raf = requestAnimationFrame(tick);
    };
    state.current.raf = requestAnimationFrame(tick);
  }, [buffer, stop]);
  useEffect(() => stop, [stop]);
  /** Recording second heard at a performance.now() timestamp (e.g. a tap). */
  const heardAt = (perfMs: number) => {
    const ctx = engine.ctx;
    if (!ctx) return 0;
    const c = ctx.currentTime - (performance.now() - perfMs) / 1000 - ((ctx.outputLatency || 0) + (ctx.baseLatency || 0));
    return state.current.offset + (c - state.current.startC);
  };
  return { pos, play, stop, heardAt, playing: pos !== null };
}

function TimingView({ song, asset, buffer, main, update, addVersion }: { song: SongRecord; asset: AssetRecord; buffer: AudioBuffer | null; main: Score | null; update: (p: Partial<SongRecord>) => Promise<void>; addVersion: (s: Score, note: string, main?: boolean) => Promise<void> }) {
  const rec = useRecordingPlayer(buffer);
  const [taps, setTaps] = useState<number[]>([]);
  const [fit, setFit] = useState<TapFit | null>(null);
  const tapping = rec.playing;
  useEffect(() => {
    if (!tapping) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 't' || e.key === 'T') {
        e.preventDefault();
        setTaps((t) => [...t, rec.heardAt(e.timeStamp)]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tapping, rec]);
  if (!buffer) return <p className="muted">Loading the recording…</p>;
  const beatTimes = song.anchors.length >= 2 ? (() => {
    const m = new AnchorTimeMap(song.anchors);
    const out: number[] = [];
    for (let k = 0; out.length < 400; k++) {
      const s = m.tickToSec(k * 960);
      if (s > buffer.duration) break;
      if (s >= 0) out.push(s);
    }
    return out;
  })() : [];
  const ticks = main?.durationTicks ?? 3840 * 8;
  const check = song.anchors.length ? checkAnchors(song.anchors, asset.durationSec) : null;

  const useFit = async () => {
    if (!fit?.ok) return;
    const anchors = anchorsFromFit(fit, ticks);
    await update({ anchors, alignment: 'tapped' });
    if (main && Math.abs(main.tempoMap[0]!.bpm - fit.bpm!) > 0.01) {
      await addVersion(commitVersion(main, setTempo(main, fit.bpm!), { kind: 'manual_edit', description: `Tempo set to ${fit.bpm} BPM from tapping along with the recording`, sourceEventIds: [] }), 'Tempo from tapping');
    }
    toast('Timing saved');
  };
  const nudge = async (ms: number) => {
    await update({ anchors: song.anchors.map((a) => ({ ...a, sourceSec: Math.max(0, a.sourceSec + ms / 1000) })) });
  };

  return (
    <div className="stack">
      <p>Line the recording up with the beat: press <strong>Play and tap</strong>, then tap the big button (or Space) on every beat for at least 8 beats, starting on the first beat of the first bar.</p>
      <Waveform buffer={buffer} positionSec={rec.pos} beats={beatTimes} onSeek={(s) => void rec.play(s)} />
      <div className="row">
        {!rec.playing ? (
          <button type="button" className="btn primary" onClick={() => { setTaps([]); setFit(null); void rec.play(0); }} data-testid="tap-start"><Icon name="play" size={20} /> Play and tap</button>
        ) : (
          <button type="button" className="btn outline" onClick={() => { rec.stop(); setFit(fitTaps(taps)); }}>Stop</button>
        )}
        <button
          type="button"
          className="btn tonal"
          style={{ minHeight: 72, minWidth: 140, fontSize: 20 }}
          disabled={!rec.playing}
          onPointerDown={(e) => setTaps((t) => [...t, rec.heardAt(e.timeStamp)])}
          data-testid="tap"
        >
          Tap ({taps.length})
        </button>
      </div>
      {fit && (fit.ok ? (
        <div className="card stack">
          <div className="t-card">{Math.round(fit.bpm!)} beats per minute</div>
          <p className="t-small">First beat at {fit.firstBeatSec!.toFixed(2)} s. Your taps were within about {fit.residualMs} ms of a steady beat.</p>
          {fit.warnings.map((w) => <Callout key={w} kind="warn">{w}</Callout>)}
          <button type="button" className="btn primary" onClick={() => void useFit()} data-testid="use-timing">Use this timing</button>
        </div>
      ) : <Callout kind="warn">{fit.reason}</Callout>)}
      {song.anchors.length >= 2 && (
        <div className="card tight stack">
          <div className="row"><strong className="spacer">Fine-tune</strong><span className="t-small muted">Blue lines should sit on the beats.</span></div>
          <div className="row">
            <button type="button" className="btn outline" onClick={() => void nudge(-20)}>Earlier 20 ms</button>
            <button type="button" className="btn outline" onClick={() => void nudge(20)}>Later 20 ms</button>
          </div>
          {check?.warnings.map((w) => <Callout key={w} kind="warn">{w}</Callout>)}
          <p className="t-caption">Linear timing from {song.anchors.length} anchors. If the recording speeds up, slows down, repeats or cuts a section, one tempo won’t stay in sync — practise a shorter section.</p>
        </div>
      )}
    </div>
  );
}

function EasyView({ main, onSave }: { main: Score | null; onSave: (s: Score, note: string, main?: boolean) => Promise<void> }) {
  const [level, setLevel] = useState<DerivationLevel>('easy-melody');
  const d = useMemo(() => (main ? derive(main, level) : null), [main, level]);
  if (!main) return <p className="muted">Write or import notes first.</p>;
  return (
    <div className="stack">
      <p>Make an easier version of your part. Each change is explained, and your original stays as it is.</p>
      <Segmented label="Kind of easy version" value={level} options={(Object.keys(LEVEL_INFO) as DerivationLevel[]).map((l) => ({ value: l, label: LEVEL_INFO[l].title }))} onChange={setLevel} />
      {d && (d.ok && d.score ? (
        <div className="card stack" data-testid="easy-result">
          <div className="t-card">{d.score.title}</div>
          {d.disclosures.map((x) => <p key={x} className="t-small" style={{ margin: 0 }}>• {x}</p>)}
          <details><summary className="t-small">What changed ({d.score.transformations.length})</summary>
            <ul className="t-small">{d.score.transformations.map((t, i) => <li key={i}>{t.description}</li>)}</ul>
          </details>
          <button type="button" className="btn primary" onClick={() => void onSave(d.score!, `Easy version (${level})`, false).then(() => toast('Easy version saved — choose it under Play'))} data-testid="save-easy">Save this version</button>
        </div>
      ) : <Callout kind="warn">{d.reason === 'no_playable_fingering' ? 'No playable version found within frets 0–3.' : d.reason}</Callout>)}
    </div>
  );
}

function TranscribeView({ song, asset, buffer, update, addVersion }: { song: SongRecord; asset: AssetRecord; buffer: AudioBuffer | null; update: (p: Partial<SongRecord>) => Promise<void>; addVersion: (s: Score, note: string, main?: boolean) => Promise<void> }) {
  const [progress, setProgress] = useState<number | null>(null);
  const [raw, setRaw] = useState<RawTranscription | null>(null);
  const [bpm, setBpm] = useState<number | null>(null);
  const [division, setDivision] = useState<1 | 2 | 4>(2);
  const [error, setError] = useState<string | null>(null);
  const worker = useRef<Worker | null>(null);
  useEffect(() => () => worker.current?.terminate(), []);
  const tempo = useMemo(() => (raw ? estimateTempo(raw.notes.map((n) => n.onsetSec)) : null), [raw]);
  const aligned = song.anchors.length >= 2;
  const alignedBpm = aligned ? (60 * (song.anchors[1]!.tick - song.anchors[0]!.tick)) / 960 / (song.anchors[1]!.sourceSec - song.anchors[0]!.sourceSec) : null;
  const useBpm = bpm ?? (alignedBpm ? Math.round(alignedBpm * 100) / 100 : tempo?.bpm ?? 80);
  const firstBeat = aligned ? song.anchors[0]!.sourceSec : tempo?.firstBeatSec ?? raw?.notes[0]?.onsetSec ?? 0;

  const run = () => {
    if (!buffer) return;
    setError(null);
    setRaw(null);
    setProgress(0);
    const w = new Worker(new URL('../../audio/transcribe.worker.ts', import.meta.url), { type: 'module' });
    worker.current = w;
    const pcm = monoMix(buffer);
    w.onmessage = (e: MessageEvent<{ type: string; fraction?: number; result?: RawTranscription; message?: string }>) => {
      if (e.data.type === 'progress') setProgress(e.data.fraction ?? 0);
      else if (e.data.type === 'done') {
        setRaw(e.data.result!);
        setProgress(null);
        w.terminate();
      } else {
        setError(e.data.message ?? 'internal_error');
        setProgress(null);
        w.terminate();
      }
    };
    w.postMessage({ pcm, sampleRate: buffer.sampleRate }, [pcm.buffer]);
  };
  const cancel = () => {
    worker.current?.terminate();
    setProgress(null);
  };
  const create = async () => {
    if (!raw) return;
    const q = quantize(raw.notes, { bpm: useBpm, firstBeatSec: firstBeat, division });
    const c = buildCandidate({
      arrangementId: `user.${song.id}.take${song.versions.length + 1}`.slice(0, 120),
      title: `${song.title} — notes from recording`,
      quantized: q, bpm: useBpm, firstBeatSec: firstBeat, rights: asset.rights,
      source: { assetId: asset.id, sha256: asset.sha256, durationSec: asset.durationSec },
    });
    if (!c.score) {
      setError(c.reason === 'low_signal' ? 'No clear single notes were found. This works best on a clean recording of one guitar playing one note at a time.' : 'No playable fingering was found for these notes.');
      return;
    }
    const v = validateScore(JSON.parse(JSON.stringify(c.score)));
    if (!v.ok) {
      setError(`The candidate could not be saved: ${v.issues[0]!.message}`);
      return;
    }
    await addVersion(c.score, `Experimental transcription (${raw.notes.length} notes, ${raw.uncertain.length} unclear)`, true);
    const anchors = c.score.sourceAudio?.anchors;
    await update({ uncertain: raw.uncertain, ...(anchors && !aligned ? { anchors, alignment: 'tapped' as const } : {}) });
    toast('Candidate notes created — review them in Notes');
    navigate('song', song.id, 'notes');
  };

  return (
    <div className="stack">
      <Callout kind="sim">
        <strong>Experimental.</strong> Works on a clean recording of one guitar playing one note at a time (15–30 seconds is ideal). It does not work on full band mixes or chords. The result is a draft you must check — it isn’t used to grade you until you review it.
      </Callout>
      {asset.durationSec > 30 && <Callout kind="info">This recording is {Math.round(asset.durationSec)} s long. Shorter excerpts give better results.</Callout>}
      {progress === null && <button type="button" className="btn primary" onClick={run} disabled={!buffer} data-testid="transcribe">Find the notes</button>}
      {progress !== null && (
        <div className="stack">
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label="Analysing"><i style={{ width: `${progress * 100}%` }} /></div>
          <button type="button" className="btn outline" onClick={cancel}>Cancel</button>
        </div>
      )}
      {raw && (
        <div className="card stack" data-testid="transcribe-result">
          <div className="t-card">Found {raw.notes.length} clear notes{raw.uncertain.length ? ` and ${raw.uncertain.length} unclear sounds` : ''}</div>
          <p className="t-small muted">Analysis took {(raw.elapsedMs / 1000).toFixed(1)} s on this device.</p>
          <div className="field"><span>Tempo {aligned ? '(from your tapping)' : '(estimated — pick the one that feels right)'}</span>
            <div className="row">
              {[...(alignedBpm ? [Math.round(alignedBpm * 100) / 100] : []), ...(tempo ? [tempo.bpm, ...tempo.alternatives] : [])].filter((x, i, a) => a.indexOf(x) === i).map((b) => (
                <button key={b} type="button" className={`chip${useBpm === b ? ' on' : ''}`} onClick={() => setBpm(b)}>{Math.round(b)} BPM</button>
              ))}
            </div>
          </div>
          <div className="field"><span>Shortest note</span>
            <Segmented label="Shortest note" value={division} options={[{ value: 1, label: 'Quarter' }, { value: 2, label: 'Eighth' }, { value: 4, label: 'Sixteenth' }]} onChange={(d) => setDivision(d as 1 | 2 | 4)} />
          </div>
          <button type="button" className="btn primary" onClick={() => void create()} data-testid="create-candidate">Create draft notes to review</button>
        </div>
      )}
      {error && <Callout kind="bad">{error}</Callout>}
    </div>
  );
}

function MoreView({ song, main, asset }: { song: SongRecord; main: Score | null; asset: AssetRecord | null }) {
  const { settings } = useApp();
  const [confirm, setConfirm] = useState(false);
  const exportScore = () => {
    if (!main) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(main, null, 2)], { type: 'application/json' }));
    a.download = `${song.title.replace(/[^\w-]+/g, '-').slice(0, 40) || 'song'}.gu-score.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  return (
    <div className="stack">
      <div className="list">
        {main && <button type="button" className="listrow" onClick={exportScore}><Icon name="download" /><div className="lr-main"><div className="lr-title">Save the notes as a file</div><div className="lr-sub">A .json score you can keep or give to someone. The recording is not included.</div></div></button>}
      </div>
      <div className="section-title">History</div>
      <div className="list">
        {song.versions.length === 0 && <div className="listrow">No versions yet.</div>}
        {[...song.versions].reverse().map((v) => (
          <div key={`${v.arrangementId}@${v.version}`} className="listrow" style={{ cursor: 'default' }}>
            <div className="lr-main"><div className="lr-title">{v.title} · v{v.version}</div><div className="lr-sub">{v.note} · {new Date(v.createdAt).toLocaleString()}</div></div>
          </div>
        ))}
      </div>
      {settings.advanced && asset && (
        <p className="t-caption">Recording: {asset.name} · {(asset.bytes / 1048576).toFixed(1)} MB · {asset.sampleRate} Hz · {asset.channels} ch · SHA-256 {asset.sha256.slice(0, 16)}… · rights {asset.rights.status.replace('_', ' ')}</p>
      )}
      {!confirm ? (
        <button type="button" className="btn danger" onClick={() => setConfirm(true)}><Icon name="trash" size={18} /> Delete this song</button>
      ) : (
        <div className="callout bad">
          <div className="stack">
            <span>Delete “{song.title}”, its recording and all versions from this device? This can’t be undone.</span>
            <div className="row">
              <button type="button" className="btn danger" onClick={() => void deleteSong(song).then(() => navigate('practice'))} data-testid="confirm-delete-song">Delete</button>
              <button type="button" className="btn outline" onClick={() => setConfirm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
