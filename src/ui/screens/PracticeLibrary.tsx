import { useEffect, useState } from 'react';
import { BUNDLED_SCORES } from '../../content/scores';
import { loadSongs } from '../../storage/db';
import type { SongRecord } from '../../storage/types';
import { useApp } from '../AppContext';
import { navigate, PageHead } from '../App';
import { Icon } from '../icons';
import { StageArt } from '../art';
import { CHAPTERS } from '../../learning/chapters';
import { findLesson } from '../../learning/lessons';

const FEATURED = ['piece.morning-steps', 'exercise.first-two-strings'];

/** Library of pieces: bundled exercises, then the learner's own songs. */
export function PracticeLibrary() {
  const { summaries, lessons } = useApp();
  const [songs, setSongs] = useState<SongRecord[] | null>(null);
  useEffect(() => {
    loadSongs().then(setSongs, () => setSongs([]));
  }, []);
  const lastFor = (id: string) => summaries.find((s) => s.arrangementId === id);
  const retained = lessons['lesson.first-piece.v1']?.skillState === 'retained';
  const ordered = [...BUNDLED_SCORES].sort((a, b) => (FEATURED.indexOf(b.arrangementId) + 1 || 0) - (FEATURED.indexOf(a.arrangementId) + 1 || 0));
  // Group the bundled pieces by the chapter whose lessons use them.
  const chapterFor = new Map<string, (typeof CHAPTERS)[number]>();
  for (const c of CHAPTERS) for (const id of c.ids) for (const st of findLesson(id)?.steps ?? []) if (st.scoreRef && !chapterFor.has(st.scoreRef)) chapterFor.set(st.scoreRef, c);
  const groups: { title: string; emoji: string; scores: typeof ordered }[] = [];
  for (const c of [...CHAPTERS, null]) {
    const list = ordered.filter((sc) => (chapterFor.get(sc.arrangementId) ?? null) === c);
    if (list.length) groups.push({ title: c ? c.title : 'More pieces', emoji: c ? c.emoji : '🎵', scores: list });
  }

  return (
    <section aria-label="Practice">
      <PageHead title="Practice" />
      <div className="card stage" style={{ marginBottom: 8 }}>
        <StageArt className="stage-art" guitar={false} />
        <div className="stage-body" style={{ minHeight: 180 }}>
          <div className="kicker">Any song, your level</div>
          <h2>Bring a song you love</h2>
          <p>A recording, a tab, chords or a MIDI file. Then play it Easy, Medium or Full.</p>
          <button type="button" className="btn primary big block" onClick={() => navigate('song', 'new')} data-testid="add-song">Add a song</button>
        </div>
      </div>
      {songs && songs.length > 0 && (
        <>
          <div className="section-title">Your songs</div>
          <div className="grid">
            {songs.map((s) => (
              <a key={s.id} href={`#/song/${s.id}`} className="tile">
                <span className={`ic ${s.source === 'recording' || s.assetId ? '' : s.source === 'written' ? 'teal' : 'violet'}`}><Icon name={s.assetId ? 'wave' : s.source === 'written' ? 'edit' : 'practice'} /></span>
                <div className="spacer">
                  <div className="c-title">{s.title}</div>
                  <div className="c-sub">{songStatus(s)}</div>
                </div>
                <Icon name="chevron" size={20} />
              </a>
            ))}
          </div>
        </>
      )}
      {groups.map((g) => (
      <div key={g.title}>
      <div className="section-title"><span aria-hidden="true">{g.emoji} </span>{g.title}</div>
      <div className="grid">
        {g.scores.map((s) => {
          const last = lastFor(s.arrangementId);
          const bars = Math.round(s.durationTicks / 3840);
          return (
            <a key={s.arrangementId} href={`#/practice/${s.arrangementId}`} className="card" style={{ textDecoration: 'none', color: 'inherit' }} data-testid={`piece-${s.arrangementId}`}>
              <div className="row nowrap" style={{ alignItems: 'flex-start' }}>
                <Icon name={s.arrangementId.startsWith('piece.') ? 'practice' : 'guitar'} />
                <div className="spacer">
                  <div className="t-card">{s.title.replace(/ — .*$/, '')}</div>
                  <div className="t-small muted">{bars} bar{bars === 1 ? '' : 's'} · {s.events.length} notes · {s.tempoMap[0]!.bpm} BPM</div>
                </div>
                {s.arrangementId === 'piece.morning-steps' && retained && <span className="badge good">Remembered</span>}
              </div>
              {last && <p className="t-small" style={{ marginTop: 10 }}>Last time: {last.stats.pitch.accuracy === null ? 'not checked' : `${last.stats.pitch.correct}/${last.stats.pitch.assessed} right notes`}{last.simulated ? ' (simulated)' : ''}</p>}
            </a>
          );
        })}
      </div>
      </div>
      ))}
    </section>
  );
}

export function songStatus(s: SongRecord): string {
  if (s.levels) {
    const n = Object.keys(s.levels).length;
    const cand = s.analysis && !s.analysis.reviewed;
    return `${n === 3 ? 'Easy · Medium · Full' : `${n} level${n === 1 ? '' : 's'}`}${cand ? ' — worked out by the app, not reviewed' : ''}${s.analysis ? ` · ${s.analysis.key}` : ''}`;
  }
  const latest = s.versions[s.versions.length - 1];
  if (!latest) return s.assetId ? 'Backing only' : 'Empty';
  if (latest.role === 'transcription_candidate') return 'Candidate notes — review needed';
  if (latest.role === 'reviewed_part') return 'Reviewed part';
  if (latest.role === 'simplified_arrangement') return 'Easy version available';
  return s.assetId ? 'Recording + notes' : 'Your notes';
}
