import { useApp } from '../AppContext';
import { navigate } from '../App';
import { LESSONS } from '../../learning/lessons';

export function Home() {
  const { settings, updateSettings, lessons, summaries } = useApp();
  const nextLesson = LESSONS.find((l) => !lessons[l.lessonId]?.completedAt) ?? LESSONS[0]!;
  const started = Object.keys(lessons).length > 0;

  if (!settings.onboarded) {
    return (
      <section aria-labelledby="welcome-h">
        <h1 id="welcome-h">Welcome — you can start here.</h1>
        <div className="panel">
          <p>Guitar Unhero is a patient practice partner for your real guitar. We will make one clear movement at a time: hear it, see it, play it, and adjust one thing.</p>
          <p className="muted small">No account. Your progress stays in this browser. The microphone is optional and only used when you choose to listen; audio is never uploaded.</p>
          <fieldset>
            <legend>Which hand frets the notes?</legend>
            <label><input type="radio" name="hand" checked={settings.handedness === 'right'} onChange={() => updateSettings({ handedness: 'right' })} /> Left hand frets (right-handed guitar)</label>
            <br />
            <label><input type="radio" name="hand" checked={settings.handedness === 'left'} onChange={() => updateSettings({ handedness: 'left' })} /> Right hand frets (left-handed guitar)</label>
            <p className="small muted">This mirrors diagrams only. String 1 is always the thinnest, highest-pitched E string.</p>
          </fieldset>
          <fieldset>
            <legend>Do you have your guitar with you?</legend>
            <label><input type="radio" name="guitar" checked={settings.hasGuitar === true} onChange={() => updateSettings({ hasGuitar: true })} /> Yes — a standard six-string guitar</label>
            <br />
            <label><input type="radio" name="guitar" checked={settings.hasGuitar === false} onChange={() => updateSettings({ hasGuitar: false })} /> Not right now</label>
          </fieldset>
          <div className="row">
            <button className="primary" onClick={() => { updateSettings({ onboarded: true }); navigate('setup'); }}>Set up listening</button>
            <button onClick={() => { updateSettings({ onboarded: true, inputMode: 'none' }); navigate('learn', LESSONS[0]!.lessonId); }}>Continue without listening</button>
            <button onClick={() => { updateSettings({ onboarded: true, inputMode: 'simulation' }); navigate('learn', LESSONS[0]!.lessonId); }}>Try the simulation (no guitar)</button>
          </div>
          <p className="small muted">Without listening, lessons use self-checks and nothing is scored. The simulation is clearly labeled and never counts as real assessment.</p>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="home-h">
      <h1 id="home-h">{started ? 'Welcome back.' : 'Ready when you are.'}</h1>
      <div className="grid2">
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Continue: {nextLesson.title}</h2>
          <p>{nextLesson.learningObjective}</p>
          <p className="small muted">About {nextLesson.estimatedMinutes} minutes.</p>
          <button className="primary" onClick={() => navigate('learn', nextLesson.lessonId)}>Continue lesson</button>
        </div>
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Quick start</h2>
          <div className="row">
            <button onClick={() => navigate('tuner')}>Tune the guitar</button>
            <button onClick={() => navigate('practice')}>Practice an exercise</button>
            <button onClick={() => navigate('setup')}>Check microphone</button>
          </div>
          {summaries[0] && (
            <p className="small">
              Last practice: <strong>{summaries[0].title}</strong> — {summaries[0].suggestion}
              {summaries[0].simulated && <strong> (simulated)</strong>}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
