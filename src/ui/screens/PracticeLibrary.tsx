import { useEffect, useState } from 'react';
import { BUNDLED_SCORES } from '../../content/scores';
import { loadSongs } from '../../storage/db';
import type { SongRecord } from '../../storage/types';
import { useApp } from '../AppContext';
import { navigate, PageHead } from '../App';
import { Icon } from '../icons';

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

  return (
    <section aria-label="Practice">
      <PageHead title="Practice" />
      <div className="section-title">Pieces and exercises</div>
      <div className="grid">
        {ordered.map((s) => {
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

      <div className="section-title">Your songs</div>
      <p className="t-small muted">Add a recording to play along with, write your own notes, or (experimental) turn a clean guitar recording into notes. Everything stays on this device.</p>
      <div className="grid">
        <button type="button" className="choice" onClick={() => navigate('song', 'new')} data-testid="add-song">
          <Icon name="plus" />
          <div><div className="c-title">Add a song</div><div className="c-sub">Recording, your own notes, or a score file</div></div>
        </button>
        {(songs ?? []).map((s) => (
          <a key={s.id} href={`#/song/${s.id}`} className="choice" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Icon name={s.assetId ? 'wave' : 'edit'} />
            <div className="spacer">
              <div className="c-title">{s.title}</div>
              <div className="c-sub">{songStatus(s)}</div>
            </div>
            <Icon name="chevron" size={20} />
          </a>
        ))}
      </div>
    </section>
  );
}

export function songStatus(s: SongRecord): string {
  const latest = s.versions[s.versions.length - 1];
  if (!latest) return s.assetId ? 'Backing only' : 'Empty';
  if (latest.role === 'transcription_candidate') return 'Candidate notes — review needed';
  if (latest.role === 'reviewed_part') return 'Reviewed part';
  if (latest.role === 'simplified_arrangement') return 'Easy version available';
  return s.assetId ? 'Recording + notes' : 'Your notes';
}
