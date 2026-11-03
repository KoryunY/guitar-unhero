import { useApp } from '../AppContext';
import { navigate, PageHead } from '../App';
import { LESSONS } from '../../learning/lessons';
import { Icon } from '../icons';
import { ProgressRing } from '../kit';

function greeting(d = new Date()): string {
  const h = d.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/** Today: one clear next step, a warm-up, and last time's suggestion. */
export function Today() {
  const { settings, lessons, summaries } = useApp();
  const next = LESSONS.find((l) => !lessons[l.lessonId]?.completedAt) ?? null;
  const p = next ? lessons[next.lessonId] : undefined;
  const doneSteps = p?.completedSteps.length ?? 0;
  const progress = next ? doneSteps / next.steps.length : 1;
  const completed = LESSONS.filter((l) => lessons[l.lessonId]?.completedAt).length;

  const weekAgo = Date.now() - 7 * 864e5;
  const days = new Set(
    [...summaries.map((s) => s.finishedAt), ...Object.values(lessons).flatMap((l) => l.completedSteps.map((c) => c.at))]
      .filter((t) => Date.parse(t) > weekAgo)
      .map((t) => t.slice(0, 10)),
  ).size;
  const last = summaries[0];
  const piece = lessons['lesson.first-piece.v1'];
  const recallDue = piece?.completedAt && piece.skillState !== 'retained';

  return (
    <section className="stack" aria-labelledby="today-h">
      <PageHead title={`${greeting()}`} />
      <p className="muted" style={{ marginTop: -12 }}>
        {days === 0 ? 'A few minutes today is plenty.' : `You practised on ${days} day${days === 1 ? '' : 's'} this week.`} {completed > 0 && `${completed} of ${LESSONS.length} lessons done.`}
      </p>

      {next ? (
        <div className="card hero">
          <div className="row nowrap" style={{ alignItems: 'flex-start' }}>
            <div className="spacer">
              <div className="t-caption" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Next up</div>
              <h2 className="t-card" id="today-h">{next.title}</h2>
              <p className="t-small muted" style={{ marginTop: 4 }}>{next.learningObjective}</p>
              <p className="t-caption">About {next.estimatedMinutes.replace(/ \(.*\)/, '')} minutes</p>
            </div>
            <ProgressRing value={progress} label={`${doneSteps} of ${next.steps.length} steps done`} />
          </div>
          <button type="button" className="btn primary block" onClick={() => navigate('learn', next.lessonId)} style={{ marginTop: 12 }}>
            {doneSteps > 0 ? 'Continue' : 'Start'}
          </button>
        </div>
      ) : (
        <div className="card hero">
          <h2 className="t-card" id="today-h">You finished every lesson 🎉</h2>
          <p>Keep Morning Steps alive by playing it from memory, or add your own song.</p>
          <button type="button" className="btn primary block" onClick={() => navigate('practice')}>Practise</button>
        </div>
      )}

      <div className="section-title">Warm up</div>
      <div className="grid">
        <button type="button" className="choice" onClick={() => navigate('tune')}>
          <Icon name="tune" />
          <div><div className="c-title">Tune up</div><div className="c-sub">About 1 minute</div></div>
        </button>
        {recallDue && (
          <button type="button" className="choice" onClick={() => navigate('practice', 'piece.morning-steps')}>
            <Icon name="sparkle" />
            <div><div className="c-title">Play Morning Steps from memory</div><div className="c-sub">A from-memory play on a new day makes it stick</div></div>
          </button>
        )}
        <button type="button" className="choice" onClick={() => navigate('practice')}>
          <Icon name="practice" />
          <div><div className="c-title">Your songs</div><div className="c-sub">Practise pieces or add your own</div></div>
        </button>
      </div>

      {last && (
        <>
          <div className="section-title">Last time</div>
          <div className="card">
            <div className="row nowrap">
              <div className="spacer">
                <div className="t-card">{last.title}</div>
                <p className="t-small" style={{ marginTop: 6 }}>{last.suggestion}</p>
                {last.simulated && <span className="badge sim">Simulation</span>}
              </div>
            </div>
            <button type="button" className="btn tonal" onClick={() => navigate('practice', last.arrangementId)}>Practise again</button>
          </div>
        </>
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
    </section>
  );
}
