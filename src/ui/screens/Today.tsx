import { useApp } from '../AppContext';
import { navigate, PageHead } from '../App';
import { LESSONS } from '../../learning/lessons';
import { Icon } from '../icons';
import { Coach, Flame, RankBadge, StageArt, VenueArt, TIER_INFO, type Mood } from '../art';
import { chapterOf, completedLessonIds, daySeed, lessonNumber, rankProgress, streakDays, useJoke } from '../coach';
import { useCountUp } from '../kit';

function greeting(d = new Date()): string {
  const h = d.getHours();
  return h < 5 ? 'Late-night session' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/** Today: the next gig on the journey, your rank, a warm-up, and last time's suggestion. */
export function Today() {
  const { settings, lessons, summaries } = useApp();
  const next = LESSONS.find((l) => !lessons[l.lessonId]?.completedAt) ?? null;
  const p = next ? lessons[next.lessonId] : undefined;
  const doneSteps = p?.completedSteps.length ?? 0;
  const done = completedLessonIds(lessons);
  const streak = streakDays(summaries, lessons);
  const rank = rankProgress(done);
  const chapter = next ? chapterOf(next.lessonId) : null;
  const last = summaries[0];
  const piece = lessons['lesson.first-piece.v1'];
  const recallDue = piece?.completedAt && piece.skillState !== 'retained';
  const firstTime = done.size === 0 && doneSteps === 0;
  const mood: Mood = firstTime ? 'happy' : streak >= 3 ? 'rock' : streak === 0 ? 'sleepy' : 'proud';
  const joke = useJoke(firstTime ? 'first_launch' : streak === 0 ? 'welcome_back' : 'lesson_start', daySeed());
  const shownStreak = useCountUp(streak);
  const shownDone = useCountUp(done.size);
  const shownSessions = useCountUp(summaries.length);

  return (
    <section className="stack" aria-labelledby="today-h">
      <PageHead title={greeting()} />
      <div className="dash">
        <div className="stack">
          {next ? (
            <div className="card stage">
              <StageArt className="stage-art" />
              <div className="stage-body">
                <div className="kicker">Next up · lesson {lessonNumber(next.lessonId)}{chapter ? ` · ${chapter.title}` : ''}</div>
                <h2 id="today-h">{next.title}</h2>
                <p>{next.learningObjective}</p>
                <div className="meta">
                  <span>About {next.estimatedMinutes.replace(/ \(.*\)/, '')} min</span>
                  <span>{doneSteps} of {next.steps.length} steps</span>
                </div>
                <div className="xp" role="progressbar" aria-label="Lesson progress" aria-valuemin={0} aria-valuemax={next.steps.length} aria-valuenow={doneSteps}>
                  <i style={{ width: `${(100 * doneSteps) / next.steps.length}%` }} />
                </div>
                <button type="button" className="btn primary big block" onClick={() => navigate('learn', next.lessonId)} style={{ marginTop: 6 }}>
                  {doneSteps > 0 ? 'Continue' : 'Start'}
                </button>
              </div>
            </div>
          ) : (
            <div className="card stage">
              <StageArt className="stage-art" />
              <div className="stage-body">
                <div className="kicker">Encore</div>
                <h2 id="today-h">Every lesson done 🤘</h2>
                <p>Keep the pieces alive from memory, or bring in a song you love.</p>
                <button type="button" className="btn primary big block" onClick={() => navigate('practice')}>Play songs</button>
              </div>
            </div>
          )}

          <Coach mood={mood} joke={joke}>
            <p>
              {streak === 0 ? 'A few minutes today is plenty.' : `${streak} day${streak === 1 ? '' : 's'} in a row. Short and often beats long and rare.`}
              {done.size > 0 && ` ${done.size} of ${LESSONS.length} lessons done.`}
            </p>
          </Coach>

          <div className="section-title">Warm up</div>
          <div className="grid">
            <button type="button" className="tile" onClick={() => navigate('tune')}>
              <span className="ic gold"><Icon name="tune" /></span>
              <div><div className="c-title">Tune up</div><div className="c-sub">About 1 minute · always first</div></div>
            </button>
            {recallDue && (
              <button type="button" className="tile" onClick={() => navigate('practice', 'piece.morning-steps')}>
                <span className="ic teal"><Icon name="sparkle" /></span>
                <div><div className="c-title">Play Morning Steps from memory</div><div className="c-sub">A from-memory play on a new day makes it stick</div></div>
              </button>
            )}
            <button type="button" className="tile" onClick={() => navigate('practice')}>
              <span className="ic violet"><Icon name="practice" /></span>
              <div><div className="c-title">Your songs</div><div className="c-sub">Play pieces, or bring any song: easy, medium or full</div></div>
            </button>
          </div>

          {last && (
            <>
              <div className="section-title">Last time</div>
              <div className="card">
                <div className="t-card">{last.title}</div>
                <p className="t-small" style={{ marginTop: 6 }}>{last.suggestion}</p>
                {last.simulated && <span className="badge sim">Simulation</span>}
                <div><button type="button" className="btn tonal" onClick={() => { const m = /^song\.(song-[^.]+)\./.exec(last.arrangementId); if (m) navigate('song', m[1]!); else navigate('practice', last.arrangementId); }} style={{ marginTop: 8 }}>Practise again</button></div>
              </div>
            </>
          )}
        </div>

        <aside className="stack" aria-label="Your progress">
          <div className="card stack" style={{ gap: 12 }}>
            <div className="rank-card">
              <RankBadge level={rank.level} max={rank.max} />
              <div className="spacer">
                <div className="t-caption" style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rank {rank.level}</div>
                <div className="rank-title">{rank.title}</div>
                <div className="t-small muted">{rank.blurb}</div>
              </div>
            </div>
            {rank.nextTitle && (
              <>
                <div className="xp" role="progressbar" aria-label={`Progress to ${rank.nextTitle}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(rank.fraction * 100)}>
                  <i style={{ width: `${Math.round(rank.fraction * 100)}%` }} />
                </div>
                <div className="t-caption">Next: <b>{rank.nextTitle}</b></div>
              </>
            )}
          </div>
          <div className="stat-row">
            <div className="stat"><Flame lit={streak > 0} /><span className="v num">{shownStreak}</span><span className="k">day streak</span></div>
            <div className="stat"><Icon name="check" /><span className="v num">{shownDone}</span><span className="k">lessons</span></div>
            <div className="stat"><Icon name="practice" /><span className="v num">{shownSessions}</span><span className="k">sessions</span></div>
          </div>
          {chapter && (
            <a className="venue" href="#/learn" style={{ margin: 0, textDecoration: 'none' }}>
              <VenueArt tier={chapter.tier} />
              <div className="v-body">
                <div>
                  <div className="v-kicker">You are playing</div>
                  <h2>{TIER_INFO[chapter.tier].venue}</h2>
                  <div className="v-sub">{TIER_INFO[chapter.tier].tag}</div>
                </div>
              </div>
            </a>
          )}
          {settings.inputMode === 'none' && (
            <div className="card tight">
              <div className="row nowrap">
                <Icon name="mic" />
                <div className="spacer t-small">Let the app hear you play and it will tell you which note it heard.</div>
                <a className="btn tonal" href="#/settings/mic">Set up</a>
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
