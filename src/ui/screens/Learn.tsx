import { useEffect, useRef, useState } from 'react';
import { engine, type Handle } from '../../audio/engine';
import { LESSONS, attemptFeedback, findLesson, type Lesson, type LessonStep } from '../../learning/lessons';
import { findBundledScore } from '../../content/scores';
import type { Evidence } from '../../storage/types';
import { useApp } from '../AppContext';
import { navigate } from '../App';
import { FretDiagram } from '../components/FretDiagram';
import { InputMeter } from '../components/InputMeter';
import { ListenControl } from '../components/ListenControl';
import { PracticePlayer } from '../practice/PracticePlayer';
import { EarComparePanel, QuizPanel, SequencePanel, StrumAlongPanel, TapPulsePanel } from '../components/StepPanels';

export function Learn({ lessonId }: { lessonId: string | null }) {
  const { lessons } = useApp();
  const lesson = lessonId ? findLesson(lessonId) : undefined;
  if (lesson) return <LessonRunner key={lesson.lessonId} lesson={lesson} />;
  return (
    <section aria-labelledby="learn-h">
      <h1 id="learn-h">Lessons</h1>
      <p className="muted">Draft lessons written for this prototype. They have not yet been reviewed by a guitar teacher.</p>
      {LESSONS.map((l) => {
        const p = lessons[l.lessonId];
        return (
          <div className="panel" key={l.lessonId}>
            <h2 style={{ marginTop: 0 }}>{l.title}</h2>
            <p>{l.learningObjective}</p>
            <p className="small muted">
              About {l.estimatedMinutes} min ·{' '}
              {p?.completedAt
                ? `Completed (${p.completionEvidence === 'sensor' ? 'heard by the microphone' : p.completionEvidence === 'simulated' ? 'simulation only' : 'self-check'})`
                : p
                  ? `${p.completedSteps.length} of ${l.steps.length} steps done`
                  : 'Not started'}
            </p>
            <button className={p?.completedAt ? '' : 'primary'} onClick={() => navigate('learn', l.lessonId)}>{p ? (p.completedAt ? 'Repeat' : 'Continue') : 'Start'}</button>
          </div>
        );
      })}
    </section>
  );
}

function LessonRunner({ lesson }: { lesson: Lesson }) {
  const { lessons, settings, recordStep, completeLesson } = useApp();
  const progress = lessons[lesson.lessonId];
  const done = new Set(progress?.completedSteps.map((s) => s.stepId) ?? []);
  const firstOpen = lesson.steps.findIndex((s) => !done.has(s.id));
  const [idx, setIdx] = useState(firstOpen < 0 ? 0 : firstOpen);
  const step = lesson.steps[idx]!;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const evidenceSource: Evidence = settings.inputMode === 'simulation' ? 'simulated' : 'sensor';

  useEffect(() => {
    headingRef.current?.focus();
  }, [idx]);

  const finishStep = (evidence: Evidence) => {
    recordStep(lesson.lessonId, step.id, evidence);
  };
  const next = () => setIdx((i) => Math.min(lesson.steps.length - 1, i + 1));

  return (
    <section aria-labelledby="lesson-h">
      <p className="small"><a href="#/learn">← All lessons</a></p>
      <h1 id="lesson-h">{lesson.title}</h1>
      <nav className="steps-nav" aria-label="Lesson steps">
        {lesson.steps.map((s, i) => (
          <button key={s.id} className={`dot ${i === idx ? 'current' : done.has(s.id) ? 'done' : ''}`} onClick={() => setIdx(i)} aria-current={i === idx ? 'step' : undefined}>
            {i + 1}. {s.title}{done.has(s.id) ? ' ✓' : ''}
          </button>
        ))}
      </nav>
      <div className="panel">
        <h2 ref={headingRef} tabIndex={-1} style={{ marginTop: 0 }}>Step {idx + 1}: {step.title}</h2>
        {step.body.map((p, i) => <p key={i}>{p}</p>)}
        {step.diagram && <FretDiagram diagram={step.diagram} leftHanded={settings.handedness === 'left'} />}
        {step.phases && (
          <ol className="phases" aria-label="Movement phases">
            {step.phases.map((ph) => <li key={ph.label}><strong>{ph.label}</strong>{ph.text}</li>)}
          </ol>
        )}
        {step.demoMidis && <DemoButton midis={step.demoMidis} label={step.demoLabel ?? 'Hear it'} />}

        {step.kind === 'attempt' && step.attempt && (
          <AttemptPanel step={step} onComplete={(ev) => { finishStep(ev); }} evidenceSource={evidenceSource} />
        )}
        {step.kind === 'stop-ringing' && <StopRingingPanel step={step} onComplete={finishStep} evidenceSource={evidenceSource} />}
        {step.kind === 'practice' && step.scoreRef && (
          <div style={{ marginTop: 12 }}>
            <PracticePlayer
              key={`${lesson.lessonId}:${step.id}`}
              score={findBundledScore(step.scoreRef)!}
              compact
              initial={step.practice}
              onSummary={(r) => {
                if (r.stats.pitch.accuracy !== null && r.stats.pitch.accuracy >= 0.6) finishStep(r.simulated ? 'simulated' : 'sensor');
              }}
            />
            {step.selfCheckLabel && <button onClick={() => finishStep('self_reported')} style={{ marginTop: 8 }}>{step.selfCheckLabel}</button>}
          </div>
        )}
        {step.kind === 'quiz' && step.quiz && <QuizPanel key={step.id} quiz={step.quiz} onComplete={() => finishStep('sensor')} />}
        {step.kind === 'tap-pulse' && step.pulse && <TapPulsePanel key={step.id} bpm={step.pulse.bpm} beats={step.pulse.beats} onComplete={() => finishStep('sensor')} />}
        {step.kind === 'sequence' && step.sequence && <SequencePanel key={step.id} step={step} onComplete={finishStep} evidenceSource={evidenceSource} />}
        {step.kind === 'strum-along' && step.strum && <StrumAlongPanel key={step.id} strum={step.strum} leftHanded={settings.handedness === 'left'} />}
        {step.kind === 'ear-compare' && step.ear && <EarComparePanel key={step.id} ear={step.ear} onComplete={() => finishStep('sensor')} />}
        {step.selfCheckLabel && (step.kind === 'tap-pulse' || step.kind === 'strum-along') && (
          <button onClick={() => finishStep('self_reported')} style={{ marginTop: 8 }}>{step.selfCheckLabel}</button>
        )}
        {step.kind === 'choice' && (
          <div className="row">
            {lesson.nextLessonId && (
              <button className="primary" onClick={() => { completeLesson(lesson.lessonId, bestEvidence()); navigate('learn', lesson.nextLessonId!); }}>
                Next: {findLesson(lesson.nextLessonId)?.title ?? 'next lesson'}
              </button>
            )}
            {!lesson.nextLessonId && (
              <button className="primary" onClick={() => { completeLesson(lesson.lessonId, bestEvidence()); navigate('practice', 'piece.morning-steps'); }}>Practice “Morning Steps”</button>
            )}
            <button onClick={() => setIdx(0)}>Repeat this lesson</button>
            <button onClick={() => { completeLesson(lesson.lessonId, bestEvidence()); navigate('home'); }}>Finish for today</button>
          </div>
        )}
        {done.has(step.id) && step.kind !== 'choice' && <p className="callout good small">Step saved{progress?.completedSteps.find((s) => s.stepId === step.id)?.evidence === 'simulated' ? ' (simulation only — not real assessment)' : progress?.completedSteps.find((s) => s.stepId === step.id)?.evidence === 'self_reported' ? ' (self-check)' : ''}.</p>}
      </div>
      <div className="row">
        <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>Back</button>
        {step.kind === 'info' || step.kind === 'demo' ? (
          <button className="primary" onClick={() => { finishStep('self_reported'); next(); }}>Got it — next</button>
        ) : step.kind !== 'choice' ? (
          <button className={done.has(step.id) ? 'primary' : ''} onClick={next}>{done.has(step.id) ? 'Next step' : 'Skip for now'}</button>
        ) : null}
      </div>
    </section>
  );

  function bestEvidence(): Evidence {
    // Sensor evidence only if every listening step was actually heard; any simulated
    // step keeps the lesson labeled simulated; otherwise it is a self-report.
    const attemptIds = lesson.steps.filter((s) => s.kind === 'attempt' || s.kind === 'sequence').map((s) => s.id);
    const attemptEvs = progress?.completedSteps.filter((s) => attemptIds.includes(s.stepId)).map((s) => s.evidence) ?? [];
    if (attemptEvs.length === attemptIds.length && attemptEvs.every((e) => e === 'sensor')) return 'sensor';
    if (progress?.completedSteps.some((s) => s.evidence === 'simulated')) return 'simulated';
    return 'self_reported';
  }
}

function DemoButton({ midis, label }: { midis: number[]; label: string }) {
  const [playing, setPlaying] = useState(false);
  const h = useRef<Handle | null>(null);
  useEffect(() => () => h.current?.stop(), []);
  return (
    <div className="row" style={{ margin: '8px 0' }}>
      <button onClick={async () => {
        h.current?.stop();
        const d = await engine.demonstrate(midis, 0.9, 'reference');
        h.current = d.handle;
        setPlaying(true);
        window.setTimeout(() => setPlaying(false), (d.end - d.start) * 1000);
      }} disabled={playing}>{playing ? 'Playing… (listening paused)' : `▶ ${label}`}</button>
      {playing && <button onClick={() => { h.current?.stop(); setPlaying(false); }}>Stop</button>}
      <span className="small muted">Synthesized demonstration. Listening is paused while it plays.</span>
    </div>
  );
}

function AttemptPanel({ step, onComplete, evidenceSource }: { step: LessonStep; onComplete: (e: Evidence) => void; evidenceSource: Evidence }) {
  const { settings, mic } = useApp();
  const spec = step.attempt!;
  const [count, setCount] = useState(0);
  const countRef = useRef(0);
  const [msg, setMsg] = useState<string | null>(null);
  const lastEvent = useRef(performance.now());
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  const sim = settings.inputMode === 'simulation';
  const listening = sim || mic === 'on';

  useEffect(() => {
    countRef.current = 0;
    setCount(0);
    setMsg(null);
  }, [step.id]);

  useEffect(() => {
    if (!listening) return;
    lastEvent.current = performance.now();
    const off = engine.on('attack', (a) => {
      if (a.simulated !== sim) return;
      lastEvent.current = performance.now();
      if (a.quality !== 'good' || a.pitchMidiFloat === null) {
        setMsg(a.reasonCodes.includes('clipping') ? 'That was too loud for the microphone (clipping). Pluck a little softer or move the mic back.' : 'I heard a sound but not one clear note. Pluck once and let it ring.');
        return;
      }
      const fb = attemptFeedback(spec, a.pitchMidiFloat);
      const prefix = sim ? 'Simulated: ' : '';
      if (!fb.correct) {
        setMsg(`${prefix}${fb.text}`);
        return;
      }
      countRef.current += 1;
      const n = countRef.current;
      setCount(n);
      setMsg(`${prefix}${fb.text} ${n >= spec.required ? 'That’s it — step complete.' : 'Try it once more.'}`);
      if (n === spec.required) completeRef.current(evidenceSource);
    });
    const silence = window.setInterval(() => {
      if (performance.now() - lastEvent.current > 9000) {
        lastEvent.current = performance.now();
        setMsg("I couldn't hear a clear note. Check the input meter and pluck once.");
      }
    }, 1000);
    return () => {
      off();
      window.clearInterval(silence);
    };
  }, [listening, sim, spec, evidenceSource]);

  return (
    <div style={{ marginTop: 12 }}>
      {!sim && <ListenControl purpose="hear your note and tell you what I heard" />}
      {mic === 'on' && <InputMeter compact />}
      <p className="small">Target: <strong>{spec.fret === 0 ? `open string ${spec.string}` : `string ${spec.string}, fret ${spec.fret}`}</strong>. Heard correctly: {Math.min(count, spec.required)} of {spec.required}.</p>
      <p role="status" aria-live="polite" className="feedback" data-testid="lesson-feedback">{msg ?? (listening ? 'Listening… take your time.' : 'Listening is off — use the self-check when you have played it.')}</p>
      <div className="row">
        {sim && (
          <>
            <button onClick={() => engine.simulateAttack(spec.targetMidi)} data-testid="sim-correct">Simulate: right note</button>
            <button onClick={() => engine.simulateAttack(spec.targetMidi + (spec.fret > 0 ? -spec.fret : 1))}>Simulate: wrong note</button>
          </>
        )}
        {step.selfCheckLabel && <button onClick={() => onComplete('self_reported')}>{step.selfCheckLabel}</button>}
      </div>
    </div>
  );
}

function StopRingingPanel({ step, onComplete, evidenceSource }: { step: LessonStep; onComplete: (e: Evidence) => void; evidenceSource: Evidence }) {
  const { settings, mic } = useApp();
  const [msg, setMsg] = useState<string | null>(null);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  const sim = settings.inputMode === 'simulation';
  useEffect(() => {
    if (mic !== 'on' || sim) return;
    let ringingSince: number | null = null;
    let quietSince: number | null = null;
    let done = false;
    const offA = engine.on('attack', (a) => {
      if (a.quality === 'good' && !done) {
        ringingSince = a.onsetContextSec;
        quietSince = null;
        setMsg('I hear it ringing. Now stop it gently.');
      }
    });
    const offF = engine.on('frame', (f) => {
      if (ringingSince === null || done) return;
      const quiet = f.reasonCodes.includes('below_gate');
      if (quiet) {
        quietSince ??= f.centerSec;
        if (f.centerSec - quietSince > 0.25) {
          done = true;
          const ringFor = quietSince - ringingSince;
          setMsg(`I heard the sound stop${ringFor < 4 ? '' : ' (it may also have faded naturally)'}. Nice.`);
          completeRef.current(evidenceSource);
        }
      } else quietSince = null;
    });
    return () => {
      offA();
      offF();
    };
  }, [mic, sim, evidenceSource]);
  return (
    <div style={{ marginTop: 12 }}>
      {!sim && <ListenControl purpose="hear when the sound stops" />}
      <p role="status" aria-live="polite" className="feedback">{msg ?? (sim ? 'Simulation cannot check this step — use the self-check.' : mic === 'on' ? 'Pluck string 1, let it ring, then stop it.' : 'Use the self-check when you have stopped the sound.')}</p>
      {step.selfCheckLabel && <button onClick={() => onComplete('self_reported')}>{step.selfCheckLabel}</button>}
    </div>
  );
}
